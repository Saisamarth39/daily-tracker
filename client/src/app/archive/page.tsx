'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore } from '../../store/useTaskStore';
import Sidebar from '../../components/Sidebar';
import TimerFloat from '../../components/TimerFloat';
import { 
  Archive, 
  History, 
  RotateCcw, 
  Trash2, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2,
} from 'lucide-react';

export default function ArchivePage() {
  const router = useRouter();
  const { user, isGuest, checkSession } = useAuthStore();
  const { archivedTasks, fetchArchive, updateTaskStatus, deleteTask } = useTaskStore();

  const [activeTab, setActiveTab] = useState<'archive' | 'history'>('archive');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // History logs state
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Deletion confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const authAndFetch = async () => {
      await checkSession();
      if (!useAuthStore.getState().user) {
        router.push('/auth');
      } else {
        await fetchArchive();
      }
    };
    authAndFetch();
  }, [checkSession, fetchArchive, router]);

  // Fetch or calculate Daily History
  useEffect(() => {
    if (!user) return;

    if (isGuest) {
      // Mock history logs for Guest Mode
      const mockHistory = [
        { date: '2026-06-10', formattedDate: 'Jun 10', totalTasks: 7, completedTasks: 6, completionRate: 85 },
        { date: '2026-06-09', formattedDate: 'Jun 09', totalTasks: 5, completedTasks: 3, completionRate: 60 },
        { date: '2026-06-08', formattedDate: 'Jun 08', totalTasks: 9, completedTasks: 8, completionRate: 88 },
        { date: '2026-06-07', formattedDate: 'Jun 07', totalTasks: 6, completedTasks: 4, completionRate: 66 },
        { date: '2026-06-06', formattedDate: 'Jun 06', totalTasks: 4, completedTasks: 4, completionRate: 100 },
      ];
      setHistoryLogs(mockHistory);
      setLoadingHistory(false);
    } else {
      // Fetch from backend
      const token = localStorage.getItem('orbit_token');
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/analytics/history`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setHistoryLogs(Array.isArray(data) ? [...data].reverse() : []);
          setLoadingHistory(false);
        })
        .catch(err => {
          console.error('Failed to fetch daily history:', err);
          setLoadingHistory(false);
        });
    }
  }, [user, isGuest]);

  const handleRestore = async (id: string) => {
    await updateTaskStatus(id, 'NOT_STARTED');
    await fetchArchive();
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteTask(deleteConfirmId);
      setDeleteConfirmId(null);
      await fetchArchive();
    }
  };

  // Filter archived tasks
  const filteredArchive = archivedTasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(search.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(search.toLowerCase()));
    
    const matchesCategory = categoryFilter === 'All' || task.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(archivedTasks.map((t) => t.category)))];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <Sidebar />

      {/* Main Panel Content */}
      <main className="flex-1 md:ml-64 p-6 md:p-8 pt-[85px] md:pt-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="pb-3 border-b border-border">
          <h1 className="font-outfit font-extrabold text-2xl tracking-tight text-foreground">
            Archive & History
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">
            Audit completion metrics, view past daily ratings, and restore completed work.
          </p>
        </div>

        {/* Tabs switcher */}
        <div className="flex items-center gap-1.5 border-b border-border">
          <button
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2.5 border-b-2 font-outfit font-bold text-xs transition-all duration-150 flex items-center gap-2 ${
              activeTab === 'archive'
                ? 'border-violet-550 dark:border-violet-500 text-foreground font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Archive className="w-3.5 h-3.5" /> Archive System ({filteredArchive.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 border-b-2 font-outfit font-bold text-xs transition-all duration-150 flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-violet-550 dark:border-violet-500 text-foreground font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Daily History Log
          </button>
        </div>

        {/* Tab contents */}
        <div className="flex-1">
          {activeTab === 'archive' ? (
            /* Archive Tab */
            <div className="flex flex-col gap-4">
              {/* Filters */}
              <div className="glass-panel border border-border/80 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 w-full">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3.5 top-3 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search archive..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      Category: {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Archived Task List */}
              <div className="flex flex-col gap-2.5">
                {filteredArchive.length === 0 ? (
                  <div className="glass-panel border border-border rounded-xl p-12 text-center text-zinc-500 flex flex-col items-center">
                    <Archive className="w-8 h-8 mb-2 stroke-1 text-zinc-500" />
                    <span className="text-xs font-semibold">No Archived Items</span>
                    <p className="text-[10px] mt-0.5 text-zinc-500">Archived tasks will appear here for lookup.</p>
                  </div>
                ) : (
                  filteredArchive.map((task) => {
                    const focusHours = (task.actualDuration / 60).toFixed(1);
                    const completedDate = task.archivedAt || task.completedAt || task.updatedAt;

                    return (
                      <div
                        key={task.id}
                        className="glass-panel border border-border hover:border-border/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition duration-200"
                      >
                        <div className="flex flex-col gap-0.5 overflow-hidden max-w-xl">
                          <span className="text-xs font-bold text-foreground truncate">
                            {task.name}
                          </span>
                          {task.description && (
                            <p className="text-zinc-400 text-[11px] leading-relaxed pr-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded bg-secondary border border-border text-[8px] font-bold text-zinc-400 uppercase">
                              {task.category}
                            </span>
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Focus: {task.actualDuration}m
                            </span>
                            {task.dueDate && (
                              <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" /> Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-500">
                              Completed: {new Date(completedDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Restore/Delete Actions */}
                        <div className="flex items-center gap-2 border-t md:border-t-0 border-border/60 pt-3 md:pt-0">
                          <button
                            onClick={() => handleRestore(task.id)}
                            className="px-2.5 py-1.5 bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 text-violet-400 hover:text-violet-300 rounded-xl text-[10px] font-bold transition flex items-center gap-0.5"
                          >
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                          <button
                            onClick={() => handleDeleteClick(task.id)}
                            className="p-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="flex flex-col gap-4">
              {loadingHistory ? (
                <div className="py-10 text-center text-zinc-500 text-xs">Loading execution logs...</div>
              ) : historyLogs.length === 0 ? (
                <div className="glass-panel border border-border rounded-xl p-12 text-center text-zinc-500 flex flex-col items-center">
                  <CheckCircle2 className="w-6 h-6 mb-2 stroke-1 text-zinc-500" />
                  <span className="text-xs font-semibold">No Historical Logs</span>
                  <p className="text-[10px] mt-0.5 text-zinc-500">Daily summaries will register here automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historyLogs.map((log) => (
                    <div
                      key={log.date}
                      className="glass-panel border border-border rounded-xl p-5 flex flex-col justify-between glow-blue relative overflow-hidden"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-border/60">
                        <div className="flex items-center gap-1 text-zinc-400">
                          <Calendar className="w-3.5 h-3.5 text-violet-450" />
                          <span className="text-xs font-bold font-outfit text-foreground">{log.formattedDate}</span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-555 font-bold">{log.date}</span>
                      </div>

                      <div className="my-4 flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] uppercase font-bold tracking-widest text-zinc-500">Completion</span>
                          <span className="text-2xl font-extrabold text-foreground">{log.completionRate}%</span>
                        </div>
                        <div className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-[10px] ${
                          log.completionRate >= 85 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400 glow-green'
                            : log.completionRate >= 50 
                              ? 'bg-violet-500/10 border-violet-500/20 text-violet-400 glow-blue'
                              : 'bg-red-500/10 border-red-500/20 text-red-400 glow-red'
                        }`}>
                          {log.completedTasks}/{log.totalTasks}
                        </div>
                      </div>

                      <div className="w-full h-1 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-300"
                          style={{ width: `${log.completionRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setDeleteConfirmId(null)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="w-full max-w-sm glass-panel border border-border rounded-xl p-6 relative z-10 text-center flex flex-col items-center">
            <Trash2 className="w-10 h-10 text-red-500 mb-3 bg-red-500/10 p-2 rounded-xl" />
            <h4 className="font-outfit font-bold text-foreground text-base mb-1">Delete Task permanently?</h4>
            <p className="text-zinc-400 text-xs mb-4">
              Are you sure you want to delete this task? This action is irreversible.
            </p>
            <div className="flex gap-2.5 w-full">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 border border-border hover:bg-secondary/40 text-muted-foreground rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timer */}
      <TimerFloat />
    </div>
  );
}
