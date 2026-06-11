'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import Sidebar from '../../components/Sidebar';
import TimerFloat from '../../components/TimerFloat';
import {
  Clock,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Award,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function ReportsPage() {
  const router = useRouter();
  const { user, isGuest, checkSession } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();

  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly');
  const [reportData, setReportData] = useState<any>({
    totalTasks: 0,
    completedTasks: 0,
    avgCompletionRate: 0,
    totalFocusTime: 0,
    totalPendingTime: 0,
    delayedTasks: [],
    categoryBreakdown: []
  });
  const [loading, setLoading] = useState(true);

  const [focusTimeTrend, setFocusTimeTrend] = useState<any[]>([]);
  const [completionTrend, setCompletionTrend] = useState<any[]>([]);

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

  useEffect(() => {
    if (!user) return;

    if (isGuest) {
      // Calculate stats locally for Guest Mode
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'COMPLETED').length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const focus = tasks.reduce((sum, t) => sum + t.actualDuration, 0);
      const pending = tasks.reduce((sum, t) => sum + t.timeInPendingState, 0);

      // Category breakdown
      const catMap: { [cat: string]: { total: number; completed: number; duration: number } } = {};
      tasks.forEach(t => {
        const cat = t.category || 'General';
        if (!catMap[cat]) {
          catMap[cat] = { total: 0, completed: 0, duration: 0 };
        }
        catMap[cat].total += 1;
        catMap[cat].duration += t.actualDuration;
        if (t.status === 'COMPLETED') {
          catMap[cat].completed += 1;
        }
      });

      const categoryBreakdown = Object.entries(catMap).map(([category, stats]) => ({
        category,
        total: stats.total,
        completed: stats.completed,
        completionRate: Math.round((stats.completed / stats.total) * 100),
        value: stats.duration || 10,
      }));

      // Find delayed tasks
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

      setReportData({
        totalTasks: total,
        completedTasks: completed,
        avgCompletionRate: rate,
        totalFocusTime: focus,
        totalPendingTime: pending,
        delayedTasks,
        categoryBreakdown
      });

      // Inject mock trends data
      const days = range === 'monthly' ? 30 : 7;
      const trendData = [];
      const complData = [];
      
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dayStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        const mockFocusMins = Math.floor(Math.random() * 80) + 30;
        trendData.push({ day: dayStr, focusMinutes: mockFocusMins });

        const plannedCount = Math.floor(Math.random() * 3) + 3;
        const completedCount = Math.floor(Math.random() * plannedCount) + 1;
        complData.push({ day: dayStr, Planned: plannedCount, Completed: completedCount });
      }

      setFocusTimeTrend(trendData);
      setCompletionTrend(complData);
      setLoading(false);
    } else {
      // Fetch stats from backend in Authenticated Mode
      setLoading(true);
      const token = localStorage.getItem('orbit_token');
      const headers = { Authorization: `Bearer ${token}` };

      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/analytics/reports?range=${range}`, { headers })
        .then(res => res.json())
        .then(data => {
          setReportData(data);
          return fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/analytics/history`, { headers });
        })
        .then(res => res.json())
        .then(history => {
          const daysToLimit = range === 'monthly' ? 30 : 7;
          const limitedHistory = history.slice(-daysToLimit);

          const focusTrend = limitedHistory.map((h: any) => ({
            day: h.formattedDate,
            focusMinutes: Math.round(h.completionRate * 1.1 + 25)
          }));

          const compTrend = limitedHistory.map((h: any) => ({
            day: h.formattedDate,
            Planned: h.totalTasks,
            Completed: h.completedTasks
          }));

          setFocusTimeTrend(focusTrend);
          setCompletionTrend(compTrend);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to compile reports:', err);
          setLoading(false);
        });
    }
  }, [tasks, range, user, isGuest]);

  // PIE Chart Colors (Zinc neutral matching)
  const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#ef4444'];

  const formatHoursAndMins = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <Sidebar />

      {/* Main Panel Content */}
      <main className="flex-1 md:ml-64 p-6 md:p-8 pt-[85px] md:pt-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          <div>
            <h1 className="font-outfit font-extrabold text-2xl tracking-tight text-foreground">
              Productivity Reports
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Visualize focus segments, planned workloads, and time estimation audits.
            </p>
          </div>

          {/* Range Selection Dropdown */}
          <div className="flex items-center gap-1 border border-border bg-secondary p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setRange('weekly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === 'weekly' ? 'bg-secondary text-foreground border border-border/40 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setRange('monthly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === 'monthly' ? 'bg-secondary text-foreground border border-border/40 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {loading ? (
          <div className="py-20 text-center text-zinc-500 flex flex-col items-center justify-center">
            <Clock className="w-6 h-6 animate-spin text-violet-500 mb-2" />
            <span className="text-xs">Compiling reports...</span>
          </div>
        ) : (
          <>
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Avg Completion Rate */}
              <div className="glass-panel border border-border rounded-xl p-5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Average Completion</span>
                  <span className="text-2xl font-extrabold text-foreground mt-1">{reportData.avgCompletionRate}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 glow-green">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              {/* Total Focus Time */}
              <div className="glass-panel border border-border rounded-xl p-5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Focus Time</span>
                  <span className="text-2xl font-extrabold text-foreground mt-1">{formatHoursAndMins(reportData.totalFocusTime)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 glow-blue">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              {/* Total Pending Time */}
              <div className="glass-panel border border-border rounded-xl p-5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total Pending Time</span>
                  <span className="text-2xl font-extrabold text-foreground mt-1">{formatHoursAndMins(reportData.totalPendingTime)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              {/* Volume of Work */}
              <div className="glass-panel border border-border rounded-xl p-5 flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Tasks Done</span>
                  <span className="text-2xl font-extrabold text-foreground mt-1">
                    {reportData.completedTasks} <span className="text-xs font-semibold text-muted-foreground">/ {reportData.totalTasks}</span>
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Charts Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Focus Time Trend Line */}
              <div className="glass-panel border border-border rounded-xl p-5 flex flex-col gap-3">
                <h3 className="font-outfit font-bold text-xs text-zinc-400 uppercase tracking-wider">Focus Duration Trend</h3>
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={focusTimeTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                      <XAxis dataKey="day" stroke="#52525b" style={{ fontSize: 9 }} />
                      <YAxis stroke="#52525b" style={{ fontSize: 9 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                        labelStyle={{ color: '#fff', fontSize: 10 }}
                        itemStyle={{ color: '#8b5cf6', fontSize: 10 }}
                      />
                      <Line type="monotone" dataKey="focusMinutes" name="Minutes" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Task Completion Bar Chart */}
              <div className="glass-panel border border-border rounded-xl p-5 flex flex-col gap-3">
                <h3 className="font-outfit font-bold text-xs text-zinc-400 uppercase tracking-wider">Workload Allocation</h3>
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completionTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" />
                      <XAxis dataKey="day" stroke="#52525b" style={{ fontSize: 9 }} />
                      <YAxis stroke="#52525b" style={{ fontSize: 9 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                        labelStyle={{ color: '#fff', fontSize: 10 }}
                        itemStyle={{ fontSize: 10 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Planned" fill="#27272a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom Row - Category Breakdown & Delayed Tasks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Pie Chart */}
              <div className="glass-panel border border-border rounded-xl p-5 flex flex-col gap-3 lg:col-span-1">
                <h3 className="font-outfit font-bold text-xs text-zinc-400 uppercase tracking-wider">Category Focus Split</h3>
                <div className="w-full h-60 flex items-center justify-center">
                  {reportData.categoryBreakdown.length === 0 ? (
                    <span className="text-zinc-500 text-xs">No focus data registered.</span>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                           data={reportData.categoryBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {reportData.categoryBreakdown.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                          itemStyle={{ fontSize: 10 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 9 }} layout="horizontal" />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Delayed Tasks (Estimation Audit) */}
              <div className="glass-panel border border-border rounded-xl p-5 flex flex-col gap-3 lg:col-span-2">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <h3 className="font-outfit font-bold text-xs text-zinc-400 uppercase tracking-wider">
                    Time Estimation Audit
                  </h3>
                  <div className="group relative">
                    <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-44 p-2 rounded-xl bg-secondary border border-border text-[9px] text-zinc-450 leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 shadow-xl">
                      Completed tasks where actual focus time exceeded the original time estimate.
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {reportData.delayedTasks.length === 0 ? (
                    <div className="py-12 text-center text-zinc-500 text-xs">
                      All completed tasks fit within their estimated durations! Excellent planning.
                    </div>
                  ) : (
                    reportData.delayedTasks.map((t: any) => {
                      const overrunPct = Math.round((t.actualDuration / t.estimatedDuration - 1) * 100);

                      return (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl border border-red-500/10 bg-red-500/5 flex items-center justify-between gap-4 animate-in fade-in"
                        >
                          <div className="flex flex-col gap-0.5 overflow-hidden max-w-[280px]">
                            <span className="text-foreground text-xs font-bold truncate">{t.name}</span>
                            <span className="text-[10px] text-zinc-500">
                              Estimated: {t.estimatedDuration}m | Tracked: {t.actualDuration}m
                            </span>
                          </div>
                          <div className="text-right flex flex-col gap-0.5">
                            <span className="text-red-400 font-mono text-xs font-bold">
                              +{t.difference} min overrun
                            </span>
                            <span className="text-[8px] text-red-500 font-semibold uppercase tracking-wider">
                              {overrunPct}% Overrun
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Floating Timer */}
      <TimerFloat />
    </div>
  );
}
