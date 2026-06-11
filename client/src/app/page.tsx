'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/useAuthStore';
import { useTaskStore, Task } from '../store/useTaskStore';
import Sidebar from '../components/Sidebar';
import TimerFloat from '../components/TimerFloat';
import NotificationCenter from '../components/NotificationCenter';
import { 
  Play, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Zap, 
  TrendingUp,
  Brain,
  Lightbulb,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isGuest, checkSession } = useAuthStore();
  const { tasks, fetchTasks, startTimer, updateTaskStatus } = useTaskStore();
  
  // Dashboard stats state
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    notStartedTasks: 0,
    overdueTasks: 0,
    completionRate: 0,
    plannedHours: 0,
    actualHours: 0,
    productivityScore: 0,
  });

  const [insights, setInsights] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Authenticate session on load
  useEffect(() => {
    const authAndFetch = async () => {
      await checkSession();
      if (!useAuthStore.getState().user) {
        router.push('/auth');
      } else {
        await fetchTasks();
      }
    };
    authAndFetch();
  }, [checkSession, fetchTasks, router]);

  // Compute or fetch stats when tasks array changes
  useEffect(() => {
    if (!user) return;

    if (isGuest) {
      // Calculate Stats locally in Guest Mode
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'COMPLETED').length;
      const pending = tasks.filter(t => t.status === 'PENDING').length;
      const notStarted = tasks.filter(t => t.status === 'NOT_STARTED').length;
      
      const overdue = tasks.filter(t => {
        return (
          ['NOT_STARTED', 'IN_PROGRESS', 'PENDING'].includes(t.status) &&
          t.dueDate &&
          new Date(t.dueDate).getTime() < new Date().getTime()
        );
      }).length;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const totalEst = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);
      const totalAct = tasks.reduce((sum, t) => sum + t.actualDuration, 0);
      const plannedHours = Number((totalEst / 60).toFixed(1));
      const actualHours = Number((totalAct / 60).toFixed(1));

      const timeRatio = totalEst > 0 ? Math.min(1, totalAct / totalEst) : 1;
      const timeScore = Math.round(timeRatio * 100);

      let score = total > 0 ? Math.round(0.6 * completionRate + 0.4 * timeScore) : 100;
      score -= overdue * 5;
      score -= pending * 2;
      const productivityScore = Math.max(0, Math.min(100, score));

      setStats({
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending,
        notStartedTasks: notStarted,
        overdueTasks: overdue,
        completionRate,
        plannedHours,
        actualHours,
        productivityScore,
      });

      // Generate local Insights
      const localInsights = [
        'Focus Hotspot: Your focus peaks between 10 AM and 1 PM.',
        'Postponement warning: You frequently postpone "Legal" tasks.',
        'Estimation variance: Complex work takes 15% longer than planned.'
      ];
      const localRecommendations = [
        'Buffer focus: Factor in a 1.2x time multiplier when scheduling tasks.',
        'Habit automation: Build recurring checklist blocks for administrative work.'
      ];
      setInsights(localInsights);
      setRecommendations(localRecommendations);
      setLoadingStats(false);
    } else {
      // Fetch from API in Authenticated Mode
      const token = localStorage.getItem('orbit_token');
      const headers = { Authorization: `Bearer ${token}` };

      Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/analytics/dashboard`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/analytics/insights`, { headers })
      ])
        .then(async ([statsRes, insightsRes]) => {
          if (statsRes.ok && insightsRes.ok) {
            const statsData = await statsRes.json();
            const insightsData = await insightsRes.json();
            setStats(statsData);
            setInsights(insightsData.insights);
            setRecommendations(insightsData.recommendations);
          }
          setLoadingStats(false);
        })
        .catch(err => {
          console.error('Failed to load dashboard metrics:', err);
          setLoadingStats(false);
        });
    }
  }, [tasks, user, isGuest]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Clock className="w-5 h-5 animate-spin text-violet-500 mr-2" />
        <span>Authenticating session...</span>
      </div>
    );
  }

  // Calculate task age strings and styling
  const getTaskAgingBadge = (task: Task) => {
    const now = new Date();
    
    // Overdue check
    if (['NOT_STARTED', 'IN_PROGRESS', 'PENDING'].includes(task.status) && task.dueDate) {
      const due = new Date(task.dueDate);
      if (due.getTime() < now.getTime()) {
        const diffMs = now.getTime() - due.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return (
          <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold flex items-center gap-1 glow-red">
            <Zap className="w-3 h-3 animate-pulse" /> Overdue by {diffDays > 0 ? `${diffDays}d` : 'hours'}
          </span>
        );
      }
    }

    // Pending check
    if (task.status === 'PENDING') {
      const mins = task.timeInPendingState;
      if (mins >= 1440) {
        const days = Math.floor(mins / 1440);
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1 glow-yellow">
            <AlertTriangle className="w-3 h-3" /> Pending {days}d
          </span>
        );
      } else if (mins > 0) {
        return (
          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center gap-1 glow-yellow">
            <AlertTriangle className="w-3 h-3" /> Pending {mins}m
          </span>
        );
      }
    }

    // Age since creation check
    const created = new Date(task.createdAt);
    const ageMs = now.getTime() - created.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    if (ageDays >= 3) {
      return (
        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] font-semibold">
          Age: {ageDays}d
        </span>
      );
    }

    return null;
  };

  const getStatusColorClass = (status: Task['status']) => {
    switch (status) {
      case 'IN_PROGRESS': return 'bg-violet-500/10 border-violet-500/20 text-violet-400 glow-blue';
      case 'PENDING': return 'bg-amber-500/10 border-amber-500/20 text-amber-400 glow-yellow';
      case 'COMPLETED': return 'bg-green-500/10 border-green-500/20 text-green-400 glow-green';
      default: return 'bg-zinc-900/80 border-zinc-800 text-zinc-400';
    }
  };

  const activeFocusTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <Sidebar />

      {/* Main Panel Content */}
      <main className="flex-1 md:ml-64 p-6 md:p-8 pt-[85px] md:pt-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Welcome Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h1 className="font-outfit font-extrabold text-2xl tracking-tight text-foreground flex items-center gap-2">
              Workspace Dashboard <Sparkles className="w-4.5 h-4.5 text-violet-550 dark:text-violet-400 animate-pulse" />
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Review focus analytics and execute priority workloads.
            </p>
          </div>
          {isGuest && (
            <div className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1.5 self-start">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Sandbox Workspace Mode
            </div>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radial Productivity Meter card */}
          <div className="glass-panel border border-border rounded-2xl p-6 flex flex-col items-center justify-center glow-blue text-center relative overflow-hidden">
            <h3 className="font-outfit font-bold text-xs text-zinc-400 uppercase tracking-wider mb-5">
              Productivity Rating
            </h3>

            {/* Radial SVG Dial */}
            <div className="relative w-36 h-36 flex items-center justify-center mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="56"
                  className="stroke-zinc-800/40"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="56"
                  className={`${
                    stats.productivityScore >= 80 
                      ? 'stroke-green-500' 
                      : stats.productivityScore >= 50 
                        ? 'stroke-violet-500' 
                        : 'stroke-red-500'
                  } transition-all duration-1000 ease-out`}
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 - (stats.productivityScore / 100) * (2 * Math.PI * 56)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="font-outfit font-extrabold text-3xl text-foreground">
                  {stats.productivityScore}%
                </span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
                  Rating
                </span>
              </div>
            </div>

            <p className="text-zinc-450 text-[11px] leading-relaxed max-w-[210px]">
              Daily aggregate calculated from completed workloads and timer accuracy.
            </p>
          </div>

          {/* Core Daily Statistics Widgets */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {/* Completion Rate Widget */}
            <div className="glass-panel border border-border rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Completion Rate</span>
                <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400"><CheckCircle2 className="w-4 h-4" /></div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-extrabold text-foreground">{stats.completionRate}%</span>
                <div className="w-full h-1 bg-zinc-800/80 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.completionRate}%` }} />
                </div>
              </div>
            </div>

            {/* Focus Hours Widget */}
            <div className="glass-panel border border-border rounded-2xl p-5 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Focus Duration</span>
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400"><Clock className="w-4 h-4" /></div>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground">{stats.actualHours}h</span>
                  <span className="text-[10px] text-zinc-500">/ {stats.plannedHours}h estimated</span>
                </div>
                <div className="w-full h-1 bg-zinc-800/80 rounded-full mt-2 overflow-hidden">
                  <div 
                    className="h-full bg-violet-500 rounded-full" 
                    style={{ width: `${stats.plannedHours > 0 ? Math.min(100, (stats.actualHours / stats.plannedHours) * 100) : 100}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Overdue Count */}
            <div className="glass-panel border border-border rounded-2xl p-5 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Overdue Alerts</span>
                <span className={`text-2xl font-extrabold ${stats.overdueTasks > 0 ? 'text-red-550 dark:text-red-400 animate-pulse' : 'text-foreground'}`}>
                  {stats.overdueTasks}
                </span>
              </div>
              <div className={`p-2.5 rounded-xl ${stats.overdueTasks > 0 ? 'bg-red-500/10 text-red-400 glow-red' : 'bg-zinc-900 border border-border'}`}>
                <Zap className="w-4.5 h-4.5" />
              </div>
            </div>

            {/* Active Task Balance */}
            <div className="glass-panel border border-border rounded-2xl p-5 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Pending Work</span>
                <span className="text-2xl font-extrabold text-foreground">{stats.pendingTasks}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Mid-level content row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Tasks Feed */}
          <div className="lg:col-span-2 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 className="font-outfit font-bold text-base text-foreground">Focus Roadmap Checklist ({activeFocusTasks.length})</h2>
              <button 
                onClick={() => router.push('/planner')}
                className="text-xs text-violet-400 hover:text-violet-300 font-bold flex items-center gap-0.5"
              >
                Planner View <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {activeFocusTasks.length === 0 ? (
                <div className="glass-panel border border-border rounded-xl p-8 text-center text-zinc-500">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 stroke-1 text-zinc-550" />
                  <span className="text-xs font-semibold">Workspace Clear!</span>
                  <p className="text-[10px] mt-0.5 text-zinc-500">All tasks completed or archived.</p>
                </div>
              ) : (
                activeFocusTasks.map((task) => (
                  <div
                    key={task.id}
                    className="glass-panel border border-border/80 hover:border-border rounded-xl p-3.5 flex items-center justify-between gap-4 transition duration-200"
                  >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      {/* Circle checkbox */}
                      <button
                        onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                        title="Mark Complete"
                        className="w-4.5 h-4.5 rounded-full border border-zinc-600 hover:border-green-500 flex items-center justify-center group flex-shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-transparent group-hover:text-green-500 transition" />
                      </button>

                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <span className="text-foreground text-xs font-bold truncate">
                          {task.name}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold border ${getStatusColorClass(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${
                            task.priority === 'HIGH' ? 'text-red-400' : task.priority === 'MEDIUM' ? 'text-amber-400' : 'text-zinc-500'
                          }`}>
                            {task.priority}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            Planned: {task.estimatedDuration}m | Tracked: {task.actualDuration}m
                          </span>
                          {getTaskAgingBadge(task)}
                        </div>
                      </div>
                    </div>

                    {/* Timer trigger */}
                    <button
                      onClick={() => startTimer(task.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold shadow-md active:scale-95 transition"
                    >
                      <Play className="w-3 h-3 fill-white" /> Start
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Productivity Insights Feed */}
          <div className="flex flex-col gap-3.5">
            <h2 className="font-outfit font-bold text-base text-foreground flex items-center gap-2">
              <Brain className="w-4.5 h-4.5 text-violet-400" /> Executive Insights
            </h2>

            <div className="glass-panel border border-border rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden">
              {loadingStats ? (
                <div className="py-8 text-center text-zinc-500 text-xs">Analyzing focus logs...</div>
              ) : (
                <>
                  {/* Smart Insights list */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Patterns</span>
                    {insights.map((insight, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/90 dark:text-zinc-400 text-[11px] leading-relaxed font-medium">{insight}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  <div className="flex flex-col gap-2.5 border-t border-border/60 pt-4">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Recommendations</span>
                    {recommendations.map((rec, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <TrendingUp className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/90 dark:text-zinc-400 text-[11px] leading-relaxed font-medium">{rec}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Quick alert notifications link */}
            <NotificationCenter />
          </div>
        </div>
      </main>

      {/* Floating Timer Widget */}
      <TimerFloat />
    </div>
  );
}
