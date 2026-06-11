import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding OrbitTrack database...');

  const email = 'demo@orbit-track.com';
  
  // Clean up existing demo user
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    await prisma.user.delete({
      where: { email }
    });
    console.log('Cleared existing demo user and related data.');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create demo user
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Demo User',
      password: hashedPassword
    }
  });

  console.log(`Created user: ${user.name} (${user.email})`);

  const now = new Date();

  // Helper to subtract days
  const subDays = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() - days);
    return res;
  };

  // Helper to add days
  const addDays = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() + days);
    return res;
  };

  // Helper to set hours
  const setHours = (d: Date, hour: number, minute: number = 0) => {
    const res = new Date(d);
    res.setHours(hour, minute, 0, 0);
    return res;
  };

  // Seeding tasks and timer logs
  console.log('Creating tasks and focus sessions...');

  // Task 1: Completed task from 3 days ago
  const task1 = await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Partnership Outreach',
      description: 'Email potential business development partners for integrated integrations.',
      category: 'Outreach',
      priority: 'HIGH',
      status: 'COMPLETED',
      estimatedDuration: 60,
      actualDuration: 48,
      remainingDuration: 0,
      dueDate: subDays(now, 3),
      completedAt: setHours(subDays(now, 3), 16, 30),
      createdAt: setHours(subDays(now, 3), 9, 0)
    }
  });

  await prisma.timerLog.create({
    data: {
      taskId: task1.id,
      startTime: setHours(subDays(now, 3), 10, 0),
      endTime: setHours(subDays(now, 3), 10, 48),
      duration: 48
    }
  });

  // Task 2: Completed task from 2 days ago (Underestimated)
  const task2 = await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Proposal Review',
      description: 'Review the proposal document for the quarterly project contract.',
      category: 'Proposal',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      estimatedDuration: 45,
      actualDuration: 60,
      remainingDuration: 0,
      dueDate: subDays(now, 2),
      completedAt: setHours(subDays(now, 2), 15, 15),
      createdAt: setHours(subDays(now, 2), 10, 0)
    }
  });

  await prisma.timerLog.create({
    data: {
      taskId: task2.id,
      startTime: setHours(subDays(now, 2), 11, 0),
      endTime: setHours(subDays(now, 2), 12, 0),
      duration: 60
    }
  });

  // Task 3: Completed task from 1 day ago (Recurring)
  const task3 = await prisma.task.create({
    data: {
      userId: user.id,
      name: 'LinkedIn Posting',
      description: 'Draft and publish weekly productivity tips on LinkedIn.',
      category: 'Social',
      priority: 'LOW',
      status: 'COMPLETED',
      estimatedDuration: 20,
      actualDuration: 15,
      remainingDuration: 0,
      dueDate: subDays(now, 1),
      isRecurring: true,
      recurrenceRule: 'DAILY',
      completedAt: setHours(subDays(now, 1), 11, 30),
      createdAt: setHours(subDays(now, 1), 9, 30)
    }
  });

  await prisma.timerLog.create({
    data: {
      taskId: task3.id,
      startTime: setHours(subDays(now, 1), 11, 15),
      endTime: setHours(subDays(now, 1), 11, 30),
      duration: 15
    }
  });

  // Task 4: Incomplete task with active timer (Today)
  const task4 = await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Design UI Components',
      description: 'Build dashboard UI cards, timer progress bar, and navigation sidebar.',
      category: 'Design',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      estimatedDuration: 120,
      actualDuration: 40,
      remainingDuration: 80,
      isTimerRunning: true,
      lastStartedAt: new Date(now.getTime() - 40 * 60000), // Started 40 mins ago
      dueDate: now,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      createdAt: setHours(now, 8, 30)
    }
  });

  await prisma.timerLog.create({
    data: {
      taskId: task4.id,
      startTime: new Date(now.getTime() - 40 * 60000),
      endTime: null,
      duration: 0
    }
  });

  // Task 5: Pending task (Created 4 days ago, pending for 3 days)
  await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Draft Sales Contract',
      description: 'Send contract draft to legal department for feedback.',
      category: 'Legal',
      priority: 'MEDIUM',
      status: 'PENDING',
      estimatedDuration: 90,
      actualDuration: 30,
      remainingDuration: 60,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      timeInPendingState: 4320, // 3 days in minutes
      dueDate: subDays(now, 1),
      createdAt: setHours(subDays(now, 4), 14, 0)
    }
  });

  // Task 6: Overdue Task (Created 3 days ago, never started, due 2 days ago)
  await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Refactor Auth Middleware',
      description: 'Incorporate Google login OAuth and session cookie checks in backend.',
      category: 'Development',
      priority: 'HIGH',
      status: 'NOT_STARTED',
      estimatedDuration: 75,
      remainingDuration: 75,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      dueDate: subDays(now, 2),
      createdAt: setHours(subDays(now, 3), 11, 0)
    }
  });

  // Task 7: Future Task (Database Migration)
  await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Setup PostgreSQL Server',
      description: 'Deploy PostgreSQL instance on staging docker and run Prisma migrations.',
      category: 'Database',
      priority: 'HIGH',
      status: 'NOT_STARTED',
      estimatedDuration: 120,
      remainingDuration: 120,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      dueDate: addDays(now, 1),
      createdAt: setHours(now, 10, 0)
    }
  });

  // Task 8: Completed Task 4 days ago
  const task8 = await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Gym Workout Session',
      description: 'Cardio and weight training.',
      category: 'Health',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      estimatedDuration: 60,
      actualDuration: 60,
      remainingDuration: 0,
      dueDate: subDays(now, 4),
      completedAt: setHours(subDays(now, 4), 19, 0),
      createdAt: setHours(subDays(now, 4), 17, 30)
    }
  });

  await prisma.timerLog.create({
    data: {
      taskId: task8.id,
      startTime: setHours(subDays(now, 4), 18, 0),
      endTime: setHours(subDays(now, 4), 19, 0),
      duration: 60
    }
  });

  // Task 9: Archived Task
  await prisma.task.create({
    data: {
      userId: user.id,
      name: 'Old Meeting Sync Notes',
      description: 'Archive obsolete notes.',
      category: 'Management',
      priority: 'LOW',
      status: 'ARCHIVED',
      estimatedDuration: 30,
      actualDuration: 25,
      remainingDuration: 5,
      dueDate: subDays(now, 6),
      completedAt: setHours(subDays(now, 6), 11, 25),
      archivedAt: setHours(subDays(now, 5), 9, 0),
      createdAt: setHours(subDays(now, 6), 11, 0)
    }
  });

  // Seed notification history
  console.log('Creating alert logs...');
  
  await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Timer Expired!',
      message: 'Time allocated for "Proposal Review" has ended.',
      type: 'TIMER_EXPIRED',
      read: true,
      createdAt: subDays(now, 2)
    }
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Task Accountability Reminder',
      message: '"Refactor Auth Middleware" has been pending/not started for 2 days.',
      type: 'PENDING_REMINDER',
      read: false,
      createdAt: subDays(now, 1)
    }
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      title: 'Overdue Task Alert',
      message: '"Draft Sales Contract" is overdue by 1 day!',
      type: 'OVERDUE_ALERT',
      read: false,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
