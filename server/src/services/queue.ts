import prisma from './db';
import { sendPushNotification } from './push';

class TaskScheduler {
  private activeTimers = new Map<string, NodeJS.Timeout>();
  private reminderInterval: NodeJS.Timeout | null = null;

  constructor() {}

  // Load and resume timers that were active when the server stopped/restarted
  async resumeTimers() {
    try {
      const runningTasks = await prisma.task.findMany({
        where: {
          isTimerRunning: true,
          status: 'IN_PROGRESS',
        },
      });

      const now = new Date();
      for (const task of runningTasks) {
        if (!task.lastStartedAt) continue;
        const elapsedMs = now.getTime() - new Date(task.lastStartedAt).getTime();
        // remainingDuration is in minutes, convert to ms
        const remainingMs = (task.remainingDuration * 60 * 1000) - elapsedMs;

        if (remainingMs <= 0) {
          // Timer expired while server was offline! Trigger immediately
          await this.triggerExpiry(task.id);
        } else {
          // Schedule remainder
          this.schedule(task.id, remainingMs);
        }
      }
      console.log(`Resumed ${runningTasks.length} active task timers.`);
    } catch (err) {
      console.error('Failed to resume timers:', err);
    }
  }

  schedule(taskId: string, delayMs: number) {
    // Cancel existing if any
    this.cancel(taskId);

    const timer = setTimeout(async () => {
      await this.triggerExpiry(taskId);
    }, delayMs);

    this.activeTimers.set(taskId, timer);
  }

  cancel(taskId: string) {
    const timer = this.activeTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(taskId);
    }
  }

  // Triggered when allocated time expires
  async triggerExpiry(taskId: string) {
    this.activeTimers.delete(taskId);

    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { user: { include: { subscriptions: true } } },
      });

      if (!task || !task.isTimerRunning) return;

      const now = new Date();
      const elapsedMinutes = task.lastStartedAt
        ? Math.round((now.getTime() - new Date(task.lastStartedAt).getTime()) / 60000)
        : 0;

      const newActualDuration = task.actualDuration + elapsedMinutes;

      // Update task: stop running, set status to PENDING on timer expiry
      await prisma.task.update({
        where: { id: taskId },
        data: {
          isTimerRunning: false,
          remainingDuration: 0,
          actualDuration: newActualDuration,
          status: 'PENDING', 
        },
      });

      // Save a log entry for this timer
      if (task.lastStartedAt) {
        await prisma.timerLog.create({
          data: {
            taskId,
            startTime: task.lastStartedAt,
            endTime: now,
            duration: elapsedMinutes,
          },
        });
      }

      // Create a database notification
      const notification = await prisma.notification.create({
        data: {
          userId: task.userId,
          title: 'Timer Expired!',
          message: `Time allocated for "${task.name}" has ended.`,
          type: 'TIMER_EXPIRED',
        },
      });

      // Send Web Push notifications
      const payload = JSON.stringify({
        title: 'Timer Expired!',
        body: `Time allocated for "${task.name}" has ended.`,
        tag: `timer-expired-${taskId}`,
        data: {
          taskId,
          notificationId: notification.id,
          actions: [
            { action: 'complete', title: 'Mark Complete' },
            { action: 'extend_15', title: 'Extend 15 Min' },
            { action: 'extend_30', title: 'Extend 30 Min' },
            { action: 'continue', title: 'Continue Working' },
            { action: 'pending', title: 'Mark Pending' }
          ]
        }
      });

      const failedSubs: string[] = [];
      for (const sub of task.user.subscriptions) {
        const success = await sendPushNotification(sub, payload);
        if (!success) {
          failedSubs.push(sub.endpoint);
        }
      }

      // Clean up invalid subscriptions
      if (failedSubs.length > 0) {
        await prisma.subscription.deleteMany({
          where: { endpoint: { in: failedSubs } },
        });
      }

    } catch (err) {
      console.error(`Failed to handle timer expiry for task ${taskId}:`, err);
    }
  }

  // Start the periodic scheduler for reminders & aging calculation
  startReminderEngine() {
    if (this.reminderInterval) return;

    console.log('Starting Smart Pending Task Reminder Engine...');
    this.reminderInterval = setInterval(async () => {
      try {
        await this.runPendingRemindersCheck();
        await this.updateAgingMetrics();
      } catch (err) {
        console.error('Error in reminder engine interval:', err);
      }
    }, 60 * 1000); // Check every 60 seconds
  }

  stopReminderEngine() {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }
  }

  // Check database for tasks that need smart alerts
  private async runPendingRemindersCheck() {
    const now = new Date();
    
    // Find all active users
    const users = await prisma.user.findMany({
      include: { subscriptions: true }
    });

    for (const user of users) {
      if (user.subscriptions.length === 0) continue;

      // Find tasks that are not completed or archived
      const tasks = await prisma.task.findMany({
        where: {
          userId: user.id,
          status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'PENDING'] }
        }
      });

      for (const task of tasks) {
        let reminderText = '';
        let type = 'PENDING_REMINDER';

        const timeSinceCreationMs = now.getTime() - new Date(task.createdAt).getTime();
        const timeSinceCreationHours = timeSinceCreationMs / (1000 * 60 * 60);

        // Check 1: Overdue due date
        if (task.dueDate && new Date(task.dueDate).getTime() < now.getTime()) {
          const overdueDays = Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24));
          if (overdueDays >= 1) {
            reminderText = `"${task.name}" is overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}!`;
            type = 'OVERDUE_ALERT';
          }
        }

        // Check 2: Planned/Created hours ago and not started
        if (!reminderText && task.status === 'NOT_STARTED' && timeSinceCreationHours >= 2) {
          reminderText = `You planned to start "${task.name}" ${Math.floor(timeSinceCreationHours)} hours ago.`;
        }

        // Check 3: Pending state for days
        if (!reminderText && task.status === 'PENDING') {
          // If task has been pending, calculate age of pending status
          // For simplicity, we can use the timeSinceCreation or update date
          const pendingDays = Math.floor(timeSinceCreationHours / 24);
          if (pendingDays >= 1) {
            reminderText = `"${task.name}" has been pending for ${pendingDays} day${pendingDays > 1 ? 's' : ''}.`;
          }
        }

        // Check 4: Not completed for 3 days
        if (!reminderText && timeSinceCreationHours >= 72) {
          reminderText = `"${task.name}" has not been completed for 3 days.`;
        }

        if (reminderText) {
          // Check if we already sent this exact reminder recently to prevent notification fatigue (e.g. within 6 hours)
          const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          const existingNotification = await prisma.notification.findFirst({
            where: {
              userId: user.id,
              message: reminderText,
              createdAt: { gte: sixHoursAgo }
            }
          });

          if (!existingNotification) {
            // Create in DB
            const dbNotif = await prisma.notification.create({
              data: {
                userId: user.id,
                title: type === 'OVERDUE_ALERT' ? 'Overdue Task Alert' : 'Task Accountability Reminder',
                message: reminderText,
                type
              }
            });

            // Send push
            const payload = JSON.stringify({
              title: type === 'OVERDUE_ALERT' ? 'Overdue Task Alert' : 'Task Reminder',
              body: reminderText,
              tag: `reminder-${task.id}`,
              data: {
                taskId: task.id,
                notificationId: dbNotif.id,
                actions: [
                  { action: 'start', title: 'Start Now' },
                  { action: 'reschedule', title: 'Reschedule' },
                  { action: 'complete', title: 'Mark Complete' }
                ]
              }
            });

            const failedSubs: string[] = [];
            for (const sub of user.subscriptions) {
              const success = await sendPushNotification(sub, payload);
              if (!success) {
                failedSubs.push(sub.endpoint);
              }
            }

            if (failedSubs.length > 0) {
              await prisma.subscription.deleteMany({
                where: { endpoint: { in: failedSubs } },
              });
            }
          }
        }
      }
    }
  }

  // Periodic calculation of aging state
  private async updateAgingMetrics() {
    try {
      const activeTasks = await prisma.task.findMany({
        where: {
          status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'PENDING'] }
        }
      });

      const now = new Date();
      for (const task of activeTasks) {
        if (task.status === 'PENDING') {
          // Increment pending state minutes (checked every minute, so add 1 minute)
          await prisma.task.update({
            where: { id: task.id },
            data: {
              timeInPendingState: { increment: 1 }
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to update aging metrics:', err);
    }
  }
}

export const taskScheduler = new TaskScheduler();
export default taskScheduler;
