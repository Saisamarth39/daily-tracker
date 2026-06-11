import { Response } from 'express';
import prisma from '../services/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Get daily dashboard stats
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const endOfToday = new Date(now.setHours(23, 59, 59, 999));

    // Find all tasks created or active today (due today or incomplete)
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        OR: [
          // Tasks created today
          {
            createdAt: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
          // Or tasks due today
          {
            dueDate: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
          // Or active/incomplete tasks from previous days carried forward
          {
            status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'PENDING'] },
          },
        ],
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const pendingTasks = tasks.filter(t => t.status === 'PENDING').length;
    const notStartedTasks = tasks.filter(t => t.status === 'NOT_STARTED').length;
    
    // Overdue tasks: incomplete and due date has passed
    const overdueTasks = tasks.filter(t => {
      return (
        ['NOT_STARTED', 'IN_PROGRESS', 'PENDING'].includes(t.status) &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < new Date().getTime()
      );
    }).length;

    // Metrics calculations
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const totalEstimatedMinutes = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
    const totalActualMinutes = tasks.reduce((sum, t) => sum + t.actualDuration, 0);
    
    const plannedHours = Number((totalEstimatedMinutes / 60).toFixed(1));
    const actualHours = Number((totalActualMinutes / 60).toFixed(1));

    // Productivity Score calculation:
    // Base is completion rate (60%) + focus time target ratio (40%) minus penalties
    const timeRatio = totalEstimatedMinutes > 0 ? Math.min(1, totalActualMinutes / totalEstimatedMinutes) : 1;
    const timeScore = Math.round(timeRatio * 100);

    let productivityScore = totalTasks > 0 
      ? Math.round(0.6 * completionRate + 0.4 * timeScore) 
      : 100;

    // Apply penalties
    productivityScore -= overdueTasks * 5;
    productivityScore -= pendingTasks * 2;

    // Cap between 0 and 100
    productivityScore = Math.max(0, Math.min(100, productivityScore));

    res.status(200).json({
      totalTasks,
      completedTasks,
      pendingTasks,
      notStartedTasks,
      overdueTasks,
      completionRate,
      plannedHours,
      actualHours,
      productivityScore,
    });
  } catch (err: any) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Daily History (Completion rates for past days)
export const getDailyHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // We look at tasks created or completed in the last 7 days and group by day
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Group tasks by date string (YYYY-MM-DD)
    const dailyMap: { [date: string]: { total: number; completed: number } } = {};

    // Initialize map with last 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap[dateStr] = { total: 0, completed: 0 };
    }

    tasks.forEach(task => {
      const dateStr = new Date(task.createdAt).toISOString().split('T')[0];
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].total += 1;
        if (task.status === 'COMPLETED') {
          dailyMap[dateStr].completed += 1;
        }
      }
    });

    const history = Object.entries(dailyMap).map(([date, stats]) => {
      const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
      
      // format date as "June 10"
      const dateObj = new Date(date + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        date,
        formattedDate,
        totalTasks: stats.total,
        completedTasks: stats.completed,
        completionRate: rate,
      };
    }).sort((a, b) => a.date.localeCompare(b.date)); // Oldest first

    res.status(200).json(history);
  } catch (err: any) {
    console.error('Get daily history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Weekly & Monthly Reports
export const getReports = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { range } = req.query; // 'weekly' or 'monthly'
    const daysToLookBack = range === 'monthly' ? 30 : 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToLookBack);
    startDate.setHours(0, 0, 0, 0);

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const avgCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const totalFocusTime = tasks.reduce((sum, t) => sum + t.actualDuration, 0);
    const totalPendingTime = tasks.reduce((sum, t) => sum + t.timeInPendingState, 0);

    // Find most delayed tasks (Completed tasks where actual duration exceeded estimated duration, sorted by difference)
    const delayedTasks = tasks
      .filter(t => t.status === 'COMPLETED' && t.actualDuration > t.estimatedDuration)
      .map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        estimatedDuration: t.estimatedDuration,
        actualDuration: t.actualDuration,
        difference: t.actualDuration - t.estimatedDuration,
      }))
      .sort((a, b) => b.difference - a.difference)
      .slice(0, 5);

    // Group tasks by category
    const categoryMap: { [cat: string]: { total: number; completed: number } } = {};
    tasks.forEach(t => {
      const cat = t.category || 'General';
      if (!categoryMap[cat]) {
        categoryMap[cat] = { total: 0, completed: 0 };
      }
      categoryMap[cat].total += 1;
      if (t.status === 'COMPLETED') {
        categoryMap[cat].completed += 1;
      }
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([category, stats]) => ({
      category,
      total: stats.total,
      completed: stats.completed,
      completionRate: Math.round((stats.completed / stats.total) * 100),
    }));

    res.status(200).json({
      range,
      totalTasks,
      completedTasks,
      avgCompletionRate,
      totalFocusTime,
      totalPendingTime,
      delayedTasks,
      categoryBreakdown,
    });
  } catch (err: any) {
    console.error('Get reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate Smart Productivity Insights & Actionable Recommendations
export const getProductivityInsights = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Load recent tasks (past 30 days) and active timer logs to analyze patterns
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tasks = await prisma.task.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        timerLogs: true,
      },
    });

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (tasks.length === 0) {
      res.status(200).json({
        insights: ['Not enough task data yet. Start tracking focus time to generate productivity insights.'],
        recommendations: ['Create your first task and start the countdown timer to build up focus data.'],
      });
      return;
    }

    // 1. Analyze Peak Productivity Hours
    // Group all TimerLogs by hour of day
    const hourlyFocus: { [hour: number]: number } = {};
    for (let i = 0; i < 24; i++) hourlyFocus[i] = 0;

    tasks.forEach(task => {
      task.timerLogs.forEach(log => {
        const startHour = new Date(log.startTime).getHours();
        hourlyFocus[startHour] += log.duration;
      });
    });

    // Find peak 3-hour window
    let peakHour = 9;
    let maxFocus = 0;
    for (let i = 0; i < 22; i++) {
      const windowSum = hourlyFocus[i] + hourlyFocus[i + 1] + hourlyFocus[i + 2];
      if (windowSum > maxFocus) {
        maxFocus = windowSum;
        peakHour = i;
      }
    }

    if (maxFocus > 0) {
      const startAmPm = peakHour >= 12 ? `${peakHour === 12 ? 12 : peakHour - 12} PM` : `${peakHour} AM`;
      const endHourVal = peakHour + 3;
      const endAmPm = endHourVal >= 12 ? `${endHourVal === 12 ? 12 : endHourVal - 12} PM` : `${endHourVal} AM`;
      insights.push(`Most productive focus window: ${startAmPm} – ${endAmPm}.`);
      recommendations.push(`Schedule your most complex high-priority work between ${startAmPm} and ${endAmPm} when your focus is highest.`);
    } else {
      insights.push('Most productive hours: Morning (9 AM - 12 PM) is typical. Track focus segments to map your custom peak hours.');
      recommendations.push('Click "Start" on your timer whenever you work to begin mapping your focus timeline.');
    }

    // 2. Analyze Frequent Postponements / Categories
    const categoryStats: { [cat: string]: { total: number; pendingCount: number; completedCount: number } } = {};
    tasks.forEach(t => {
      const cat = t.category || 'General';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, pendingCount: 0, completedCount: 0 };
      }
      categoryStats[cat].total += 1;
      if (t.status === 'PENDING') {
        categoryStats[cat].pendingCount += 1;
      }
      if (t.status === 'COMPLETED') {
        categoryStats[cat].completedCount += 1;
      }
    });

    let highestPendingCat = '';
    let maxPendingRatio = 0;

    Object.entries(categoryStats).forEach(([cat, stats]) => {
      const pendingRatio = stats.pendingCount / stats.total;
      if (pendingRatio > maxPendingRatio && stats.total >= 2) {
        maxPendingRatio = pendingRatio;
        highestPendingCat = cat;
      }
    });

    if (highestPendingCat && maxPendingRatio > 0.3) {
      insights.push(`You frequently postpone "${highestPendingCat}" related tasks.`);
      recommendations.push(`Break down "${highestPendingCat}" tasks into smaller sub-tasks (15-30 min) to lower the barrier to entry.`);
    }

    // 3. Analyze Underestimation / Overestimation Accuracy
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED' && t.estimatedDuration > 0);
    let totalEstimated = 0;
    let totalActual = 0;
    let underestimatedCount = 0;

    completedTasks.forEach(t => {
      totalEstimated += t.estimatedDuration;
      totalActual += t.actualDuration;
      if (t.actualDuration > t.estimatedDuration * 1.25) {
        underestimatedCount += 1;
      }
    });

    if (completedTasks.length >= 3) {
      const ratio = totalActual / totalEstimated;
      const pctDiff = Math.abs(Math.round((ratio - 1) * 100));

      if (ratio > 1.1) {
        insights.push(`You underestimate work by approximately ${pctDiff}%.`);
        recommendations.push(`When planning, multiply your time estimates by 1.2 to buffer for unexpected delays.`);
      } else if (ratio < 0.9) {
        insights.push(`You overestimate task durations by ${pctDiff}%. You finish tasks faster than planned.`);
        recommendations.push(`Schedule tighter focus blocks to fit more work, or plan shorter timer durations.`);
      } else {
        insights.push('Your planning time estimation is highly accurate! (within 10% of actual work).');
        recommendations.push('Maintain your current planning method; your estimates are reliable.');
      }
    }

    // 4. Category-Based Success
    let highestCompletedCat = '';
    let maxCompletionRatio = 0;

    Object.entries(categoryStats).forEach(([cat, stats]) => {
      const completionRatio = stats.completedCount / stats.total;
      if (completionRatio > maxCompletionRatio && stats.total >= 2) {
        maxCompletionRatio = completionRatio;
        highestCompletedCat = cat;
      }
    });

    if (highestCompletedCat && maxCompletionRatio > 0.8) {
      insights.push(`"${highestCompletedCat}" tasks are completed ${Math.round(maxCompletionRatio * 100)}% of the time.`);
      recommendations.push(`Leverage your momentum in "${highestCompletedCat}" by tackling those tasks early in the week.`);
    }

    // Default Insights if insufficient indicators triggered
    if (insights.length < 2) {
      insights.push('Consistency check: Routine recurrence helps form solid work habits.');
      recommendations.push('Set up recurring task triggers for daily routines (e.g. gym, emails, standups).');
    }

    res.status(200).json({ insights, recommendations });
  } catch (err: any) {
    console.error('Get productivity insights error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
