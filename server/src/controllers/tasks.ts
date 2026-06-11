import { Response } from 'express';
import prisma from '../services/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { taskScheduler } from '../services/queue';

// Create a Task
export const createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      name,
      description,
      category,
      priority,
      estimatedDuration, // in minutes
      dueDate,
      isRecurring,
      recurrenceRule,
    } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Task name is required' });
      return;
    }

    const task = await prisma.task.create({
      data: {
        userId,
        name,
        description,
        category: category || 'General',
        priority: priority || 'MEDIUM',
        estimatedDuration: Number(estimatedDuration) || 0,
        remainingDuration: Number(estimatedDuration) || 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        isRecurring: isRecurring !== undefined ? !!isRecurring : true,
        recurrenceRule: (isRecurring !== undefined ? !!isRecurring : true) ? recurrenceRule || 'DAILY' : null,
        status: 'NOT_STARTED',
      },
    });

    res.status(201).json(task);
  } catch (err: any) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Active Tasks (Filterable & Searchable)
export const getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, priority, category, date, search } = req.query;

    const whereClause: any = {
      userId,
      status: { not: 'ARCHIVED' }, // default exclude archived
    };

    if (status) {
      whereClause.status = status as string;
    }
    if (priority) {
      whereClause.priority = priority as string;
    }
    if (category) {
      whereClause.category = category as string;
    }

    if (date) {
      const queryDate = new Date(date as string);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));
      whereClause.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Add age metadata dynamically
    const now = new Date();
    const tasksWithAge = tasks.map(task => {
      const ageInMs = now.getTime() - new Date(task.createdAt).getTime();
      const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));
      return {
        ...task,
        ageInDays,
      };
    });

    res.status(200).json(tasksWithAge);
  } catch (err: any) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Edit Task
export const updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { name, description, category, priority, estimatedDuration, dueDate, isRecurring, recurrenceRule } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // If estimated duration changed and task timer is not running, adjust remaining duration
    let remainingDuration = task.remainingDuration;
    if (estimatedDuration !== undefined && !task.isTimerRunning) {
      remainingDuration = Number(estimatedDuration);
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        name: name !== undefined ? name : task.name,
        description: description !== undefined ? description : task.description,
        category: category !== undefined ? category : task.category,
        priority: priority !== undefined ? priority : task.priority,
        estimatedDuration: estimatedDuration !== undefined ? Number(estimatedDuration) : task.estimatedDuration,
        remainingDuration,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : task.dueDate,
        isRecurring: isRecurring !== undefined ? !!isRecurring : task.isRecurring,
        recurrenceRule: isRecurring ? (recurrenceRule !== undefined ? recurrenceRule : task.recurrenceRule) : null,
      },
    });

    res.status(200).json(updatedTask);
  } catch (err: any) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Task (Permanent)
export const deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Cancel timer if running
    taskScheduler.cancel(id);

    await prisma.task.delete({
      where: { id },
    });

    res.status(200).json({ message: 'Task permanently deleted' });
  } catch (err: any) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update Task Status & Trigger Recurring Duplication if Completed
export const updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { status } = req.body; // NOT_STARTED, IN_PROGRESS, PENDING, COMPLETED, ARCHIVED

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const prevStatus = task.status;
    let isTimerRunning = task.isTimerRunning;
    let lastStartedAt = task.lastStartedAt;
    let actualDuration = task.actualDuration;
    let remainingDuration = task.remainingDuration;
    let completedAt = task.completedAt;
    const now = new Date();

    // If task was running and status transitions, we stop the timer first
    if (isTimerRunning && status !== 'IN_PROGRESS') {
      isTimerRunning = false;
      taskScheduler.cancel(id);
      
      if (lastStartedAt) {
        const elapsedMinutes = Math.round((now.getTime() - new Date(lastStartedAt).getTime()) / 60000);
        actualDuration += elapsedMinutes;
        remainingDuration = Math.max(0, remainingDuration - elapsedMinutes);
        
        await prisma.timerLog.create({
          data: {
            taskId: id,
            startTime: lastStartedAt,
            endTime: now,
            duration: elapsedMinutes,
          },
        });
      }
      lastStartedAt = null;
    }

    if (status === 'COMPLETED') {
      completedAt = now;
      remainingDuration = 0;
    } else {
      completedAt = null;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status,
        isTimerRunning,
        lastStartedAt,
        actualDuration,
        remainingDuration,
        completedAt,
      },
    });

    // If completed and is recurring, spawn next instance
    if (status === 'COMPLETED' && prevStatus !== 'COMPLETED' && task.isRecurring && task.recurrenceRule) {
      let nextDueDate: Date | null = null;
      const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();

      if (task.recurrenceRule === 'DAILY') {
        nextDueDate = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
      } else if (task.recurrenceRule === 'WEEKLY') {
        nextDueDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (task.recurrenceRule === 'MONTHLY') {
        nextDueDate = new Date(baseDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      await prisma.task.create({
        data: {
          userId,
          name: task.name,
          description: task.description,
          category: task.category,
          priority: task.priority,
          estimatedDuration: task.estimatedDuration,
          remainingDuration: task.estimatedDuration,
          dueDate: nextDueDate,
          isRecurring: true,
          recurrenceRule: task.recurrenceRule,
          status: 'NOT_STARTED',
        },
      });
    }

    res.status(200).json(updatedTask);
  } catch (err: any) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Timer Actions (Start, Pause, Resume, Stop, Actions from notifications)
export const handleTimer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { action } = req.body; // start, pause, resume, stop, extend_15, extend_30, continue, pending

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const now = new Date();
    let isTimerRunning = task.isTimerRunning;
    let lastStartedAt = task.lastStartedAt;
    let actualDuration = task.actualDuration;
    let remainingDuration = task.remainingDuration;
    let status = task.status;

    if (action === 'start' || action === 'resume' || action === 'continue') {
      if (!isTimerRunning) {
        isTimerRunning = true;
        lastStartedAt = now;
        status = 'IN_PROGRESS';
        
        // If remaining time is 0, reset to estimated duration (or default to 30 mins if estimated is 0)
        if (remainingDuration <= 0) {
          remainingDuration = task.estimatedDuration > 0 ? task.estimatedDuration : 30;
        }

        // Schedule timer expiry
        taskScheduler.schedule(id, remainingDuration * 60 * 1000);
      }
    } else if (action === 'pause') {
      if (isTimerRunning && lastStartedAt) {
        isTimerRunning = false;
        const elapsedMinutes = Math.round((now.getTime() - new Date(lastStartedAt).getTime()) / 60000);
        actualDuration += elapsedMinutes;
        remainingDuration = Math.max(0, remainingDuration - elapsedMinutes);
        status = 'PENDING';
        lastStartedAt = null;

        // Cancel running scheduler timer
        taskScheduler.cancel(id);

        // Save segment log
        await prisma.timerLog.create({
          data: {
            taskId: id,
            startTime: lastStartedAt || now, // safety
            endTime: now,
            duration: elapsedMinutes,
          },
        });
      }
    } else if (action === 'stop') {
      if (isTimerRunning && lastStartedAt) {
        const elapsedMinutes = Math.round((now.getTime() - new Date(lastStartedAt).getTime()) / 60000);
        actualDuration += elapsedMinutes;
        
        await prisma.timerLog.create({
          data: {
            taskId: id,
            startTime: lastStartedAt,
            endTime: now,
            duration: elapsedMinutes,
          },
        });
      }
      isTimerRunning = false;
      lastStartedAt = null;
      status = 'NOT_STARTED';
      remainingDuration = task.estimatedDuration; // Reset remaining time

      taskScheduler.cancel(id);
    } else if (action === 'extend_15' || action === 'extend_30') {
      const extendMin = action === 'extend_15' ? 15 : 30;
      isTimerRunning = true;
      lastStartedAt = now;
      remainingDuration = extendMin;
      status = 'IN_PROGRESS';

      // Schedule timer expiry
      taskScheduler.schedule(id, remainingDuration * 60 * 1000);
    } else if (action === 'pending') {
      isTimerRunning = false;
      lastStartedAt = null;
      status = 'PENDING';
      taskScheduler.cancel(id);
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        isTimerRunning,
        lastStartedAt,
        actualDuration,
        remainingDuration,
        status,
      },
    });

    res.status(200).json(updatedTask);
  } catch (err: any) {
    console.error('Timer action error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Archive Task
export const archiveTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    res.status(200).json(updatedTask);
  } catch (err: any) {
    console.error('Archive task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Archive
export const getArchive = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const archivedTasks = await prisma.task.findMany({
      where: {
        userId,
        status: 'ARCHIVED',
      },
      orderBy: { archivedAt: 'desc' },
    });

    res.status(200).json(archivedTasks);
  } catch (err: any) {
    console.error('Get archive error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// End-of-Day Automation Carry Forward
export const carryForwardTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { actions } = req.body; // map of taskId -> 'move_tomorrow' | 'archive' | 'delete'

    if (!actions || typeof actions !== 'object') {
      res.status(400).json({ error: 'Actions object required' });
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // default due time tomorrow 9 AM

    const results = [];

    for (const [taskId, action] of Object.entries(actions)) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId },
      });

      if (!task) continue;

      // Stop running timer if active
      if (task.isTimerRunning) {
        taskScheduler.cancel(taskId);
      }

      if (action === 'move_tomorrow') {
        const updated = await prisma.task.update({
          where: { id: taskId },
          data: {
            dueDate: tomorrow,
            status: 'NOT_STARTED',
            isTimerRunning: false,
            lastStartedAt: null,
          },
        });
        results.push({ id: taskId, action, status: 'success', data: updated });
      } else if (action === 'archive') {
        const updated = await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'ARCHIVED',
            archivedAt: new Date(),
            isTimerRunning: false,
            lastStartedAt: null,
          },
        });
        results.push({ id: taskId, action, status: 'success', data: updated });
      } else if (action === 'delete') {
        await prisma.task.delete({
          where: { id: taskId },
        });
        results.push({ id: taskId, action, status: 'success' });
      }
    }

    res.status(200).json({ message: 'End-of-day task actions processed', results });
  } catch (err: any) {
    console.error('Carry forward tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
