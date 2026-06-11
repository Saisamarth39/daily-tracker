'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { useTaskStore, Task } from '../../store/useTaskStore';
import Sidebar from '../../components/Sidebar';
import TimerFloat from '../../components/TimerFloat';
import {
  Plus,
  Search,
  Kanban as KanbanIcon,
  List as ListIcon,
  CalendarDays,
  Clock,
  AlertTriangle,
  Play,
  CheckCircle2,
  Trash2,
  Edit,
  X,
  History,
  Calendar,
  AlertCircle,
  Zap
} from 'lucide-react';

export default function PlannerPage() {
  const router = useRouter();
  const { user, checkSession } = useAuthStore();
  const {
    tasks,
    fetchTasks,
    addTask,
    updateTaskDetails,
    deleteTask,
    updateTaskStatus,
    carryForward,
    startTimer
  } = useTaskStore();

  // View settings
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'timeline'>('kanban');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Form states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCat, setTaskCat] = useState('General');
  const [taskPriority, setTaskPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [taskDurationHours, setTaskDurationHours] = useState(0);
  const [taskDurationMins, setTaskDurationMins] = useState(30);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskIsRecurring, setTaskIsRecurring] = useState(false);
  const [taskRecurRule, setTaskRecurRule] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');

  // Deletion confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // EOD Automation state
  const [isEODModalOpen, setIsEODModalOpen] = useState(false);
  const [eodSelections, setEodSelections] = useState<{ [taskId: string]: 'move_tomorrow' | 'archive' | 'delete' }>({});

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

  // Sync edits
  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setTaskName(task.name);
    setTaskDesc(task.description || '');
    setTaskCat(task.category);
    setTaskPriority(task.priority);
    setTaskDurationHours(Math.floor(task.estimatedDuration / 60));
    setTaskDurationMins(task.estimatedDuration % 60);
    setTaskDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setTaskIsRecurring(task.isRecurring);
    setTaskRecurRule(task.recurrenceRule || 'DAILY');
    setIsDrawerOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setTaskName('');
    setTaskDesc('');
    setTaskCat('General');
    setTaskPriority('MEDIUM');
    setTaskDurationHours(0);
    setTaskDurationMins(30);
    setTaskDueDate(new Date().toISOString().split('T')[0]);
    setTaskIsRecurring(true);
    setTaskRecurRule('DAILY');
    setIsDrawerOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    const estimatedDuration = taskDurationHours * 60 + Number(taskDurationMins);
    const dueDate = taskDueDate ? new Date(taskDueDate).toISOString() : undefined;

    const payload = {
      name: taskName,
      description: taskDesc,
      category: taskCat,
      priority: taskPriority,
      estimatedDuration,
      dueDate,
      isRecurring: taskIsRecurring,
      recurrenceRule: taskIsRecurring ? taskRecurRule : undefined,
    };

    if (editingTask) {
      await updateTaskDetails(editingTask.id, payload);
    } else {
      await addTask(payload);
    }

    setIsDrawerOpen(false);
    setEditingTask(null);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteTask(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  // HTML5 Drag and Drop Handlers for Kanban
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      await updateTaskStatus(taskId, targetStatus);
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(search.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === 'All' || task.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter;
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;

    return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
  });

  const categories = ['All', ...Array.from(new Set(tasks.map((t) => t.category)))];

  // EOD Check
  const incompleteTasks = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'ARCHIVED');
  
  const handleOpenEOD = () => {
    const initialSelections: { [taskId: string]: 'move_tomorrow' | 'archive' | 'delete' } = {};
    incompleteTasks.forEach((t) => {
      initialSelections[t.id] = 'move_tomorrow'; // default selection
    });
    setEodSelections(initialSelections);
    setIsEODModalOpen(true);
  };

  const handleSaveEOD = async () => {
    await carryForward(eodSelections);
    setIsEODModalOpen(false);
  };

  const getPriorityColorClass = (p: Task['priority']) => {
    switch (p) {
      case 'HIGH': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'MEDIUM': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-zinc-400 bg-zinc-900 border-zinc-800';
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-6 md:p-8 pt-[85px] md:pt-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          <div>
            <h1 className="font-outfit font-extrabold text-2xl tracking-tight text-foreground">
              Daily Planner
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5">
              Draft, organize, and execute focus sessions. Drag cards between statuses.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreate}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-600/15 flex items-center gap-1.5 active:scale-95 transition-all duration-200"
            >
              <Plus className="w-4 h-4" /> Create Task
            </button>
          </div>
        </div>

        {/* End of Day Automation Banner */}
        {incompleteTasks.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-2.5 items-start md:items-center">
              <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-400 flex-shrink-0">
                <AlertCircle className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground text-xs font-semibold">Unfinished Tasks Pending</span>
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  You have {incompleteTasks.length} incomplete tasks today. Use the roll-over wizard to carry them forward.
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenEOD}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl text-[10px] font-bold active:scale-95 transition-all duration-250 whitespace-nowrap self-start md:self-auto"
            >
              Roll-over Wizard
            </button>
          </div>
        )}

        {/* Filters and View Toggles Bar */}
        <div className="glass-panel border border-border/80 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 flex-1 w-full">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground transition-all"
              />
            </div>

            {/* Category Filter */}
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

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
            >
              <option value="All">Priority: All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Status Filter */}
            {viewMode !== 'kanban' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-background border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
              >
                <option value="All">Status: All</option>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option>
                <option value="COMPLETED">Completed</option>
              </select>
            )}
          </div>

          {/* View Mode Switches */}
          <div className="flex items-center gap-1 border border-border bg-background p-1 rounded-xl self-end lg:self-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'list' ? 'bg-secondary text-foreground border border-border/40 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'kanban' ? 'bg-secondary text-foreground border border-border/40 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Kanban Board"
            >
              <KanbanIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-lg flex items-center justify-center transition-all ${
                viewMode === 'timeline' ? 'bg-secondary text-foreground border border-border/40 shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Timeline Gantt"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Visual Board Area */}
        <div className="flex-1">
          {viewMode === 'kanban' ? (
            /* Kanban Board */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(['NOT_STARTED', 'IN_PROGRESS', 'PENDING', 'COMPLETED'] as const).map((colStatus) => {
                const columnTasks = filteredTasks.filter((t) => t.status === colStatus);
                const colTitle = colStatus.replace('_', ' ');
                let colColor = 'border-border';
                let glowColor = '';
                
                if (colStatus === 'IN_PROGRESS') {
                  colColor = 'border-violet-500/20';
                  glowColor = 'bg-violet-950/5';
                } else if (colStatus === 'PENDING') {
                  colColor = 'border-amber-500/20';
                  glowColor = 'bg-amber-950/5';
                } else if (colStatus === 'COMPLETED') {
                  colColor = 'border-green-500/20';
                  glowColor = 'bg-green-950/5';
                }

                return (
                  <div
                    key={colStatus}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(e, colStatus)}
                    className={`glass-panel border rounded-xl p-4 flex flex-col gap-4 ${colColor} ${glowColor}`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="font-outfit font-extrabold text-xs uppercase tracking-wider text-foreground/80">
                        {colTitle}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-background border border-border text-[10px] font-bold text-zinc-400">
                        {columnTasks.length}
                      </span>
                    </div>

                    <div className="kanban-column flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-320px)] pr-1">
                      {columnTasks.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs">Drag cards here</div>
                      ) : (
                        columnTasks.map((t) => (
                          <KanbanCard
                            key={t.id}
                            task={t}
                            onDragStart={handleDragStart}
                            onEdit={handleOpenEdit}
                            onDelete={handleDeleteClick}
                            onStartTimer={startTimer}
                            onComplete={(id) => updateTaskStatus(id, 'COMPLETED')}
                            onStatusChange={(status) => updateTaskStatus(t.id, status)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <div className="flex flex-col gap-2.5">
              {filteredTasks.length === 0 ? (
                <div className="glass-panel border border-border rounded-xl p-12 text-center text-zinc-500">
                  No tasks matched your query.
                </div>
              ) : (
                filteredTasks.map((t) => (
                  <ListViewCard
                    key={t.id}
                    task={t}
                    onEdit={handleOpenEdit}
                    onDelete={handleDeleteClick}
                    onStartTimer={startTimer}
                    onStatusChange={(status) => updateTaskStatus(t.id, status)}
                    priorityColor={getPriorityColorClass(t.priority)}
                  />
                ))
              )}
            </div>
          ) : (
            /* Timeline View */
            <div className="glass-panel border border-border rounded-xl p-6 flex flex-col gap-4">
              <h3 className="font-outfit font-bold text-sm text-foreground">Daily Timeline Flow</h3>
              <div className="flex flex-col gap-3">
                {filteredTasks.length === 0 ? (
                  <div className="text-center text-zinc-500 py-8 text-xs">No tasks planned.</div>
                ) : (
                  filteredTasks.map((t, idx) => {
                    const durationStr = t.estimatedDuration >= 60 
                      ? `${Math.floor(t.estimatedDuration / 60)}h ${t.estimatedDuration % 60}m` 
                      : `${t.estimatedDuration}m`;

                    return (
                      <div key={t.id} className="flex gap-4 items-start">
                        <div className="w-12 flex-shrink-0 text-zinc-500 font-mono text-xs pt-2 text-right">
                          #{idx + 1}
                        </div>
                        <div className="flex-1 glass-panel border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500" />
                          <div className="flex flex-col gap-0.5 pl-2.5">
                            <span className="text-foreground text-xs font-bold">{t.name}</span>
                            <span className="text-[10px] text-zinc-400">
                              Duration: {durationStr} | Category: {t.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold border ${getPriorityColorClass(t.priority)}`}>
                              {t.priority}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-background border border-border px-2 py-0.5 rounded">
                              {t.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Slide drawer for task Create/Edit */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <div className="w-full max-w-sm bg-background border-l border-border h-screen relative z-10 p-5 flex flex-col justify-between animate-in slide-in-from-right duration-300">
            <div className="flex flex-col gap-5 overflow-y-auto pr-1">
              <div className="flex justify-between items-center pb-3 border-b border-border">
                <h3 className="font-outfit font-bold text-sm text-foreground">
                  {editingTask ? 'Edit Task Details' : 'Create Task'}
                </h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTask} id="task-form" className="flex flex-col gap-4">
                {/* Task Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                    Task Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Partnership Outreach"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-foreground text-xs focus:border-violet-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    placeholder="Provide details about task outcomes..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-foreground text-xs focus:border-violet-500 focus:outline-none transition-all"
                  />
                </div>

                {/* Category & Priority */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Design"
                      value={taskCat}
                      onChange={(e) => setTaskCat(e.target.value)}
                      className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-foreground text-xs focus:border-violet-500 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e: any) => setTaskPriority(e.target.value)}
                      className="w-full px-2.5 py-2 bg-secondary/40 border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
                    >
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                {/* Estimated Focus Duration */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                    Estimated Focus Time
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={taskDurationHours}
                        onChange={(e) => setTaskDurationHours(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-foreground text-xs focus:border-violet-500 focus:outline-none text-center"
                      />
                      <span className="text-zinc-500 text-[10px] font-semibold">hrs</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={taskDurationMins}
                        onChange={(e) => setTaskDurationMins(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-foreground text-xs focus:border-violet-500 focus:outline-none text-center"
                      />
                      <span className="text-zinc-500 text-[10px] font-semibold">mins</span>
                    </div>
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-secondary/40 border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
                  />
                </div>

                {/* Recurrence Toggle */}
                <div className="flex flex-col gap-3 border-t border-border pt-4 mt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground text-xs font-semibold">Recurring Routine</span>
                      <p className="text-zinc-500 text-[9px]">Automatically recreate task on complete.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taskIsRecurring}
                        onChange={(e) => setTaskIsRecurring(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-background peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-600 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-white" />
                    </label>
                  </div>

                  {taskIsRecurring && (
                    <div className="flex flex-col gap-1 animate-in fade-in duration-200">
                      <label className="text-zinc-400 text-[9px] font-bold uppercase tracking-wider">
                        Interval
                      </label>
                      <select
                        value={taskRecurRule}
                        onChange={(e: any) => setTaskRecurRule(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-secondary/40 border border-border rounded-xl text-xs focus:border-violet-500 focus:outline-none text-foreground"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="border-t border-border pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-2 border border-border hover:bg-secondary/40 text-muted-foreground rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="task-form"
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                {editingTask ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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

      {/* Roll-over Wizard (EOD automation modal) */}
      {isEODModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setIsEODModalOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="w-full max-w-xl glass-panel border border-border rounded-xl p-5 relative z-10 flex flex-col justify-between max-h-[80vh]">
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-2 pb-3 border-b border-border">
                <History className="w-4.5 h-4.5 text-amber-400 animate-pulse" />
                <h4 className="font-outfit font-bold text-foreground text-base">End-of-Day roll-over Wizard</h4>
              </div>
              <p className="text-zinc-400 text-xs">
                Manage unfinished workloads from today. Select carry-forward actions for each item:
              </p>

              {/* Tasks list with roll-over radio toggles */}
              <div className="flex flex-col gap-2.5 my-2">
                {incompleteTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex flex-col gap-0.5 max-w-[240px]">
                      <span className="text-foreground text-xs font-bold truncate">{t.name}</span>
                      <span className="text-[9px] text-zinc-500">Category: {t.category} | Priority: {t.priority}</span>
                    </div>

                    {/* Radio actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEodSelections({ ...eodSelections, [t.id]: 'move_tomorrow' })}
                        className={`px-2 py-1 rounded-lg border text-[9px] font-bold transition ${
                          eodSelections[t.id] === 'move_tomorrow'
                            ? 'bg-violet-600 border-violet-500 text-white'
                            : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                      >
                        Move Tomorrow
                      </button>
                      <button
                        onClick={() => setEodSelections({ ...eodSelections, [t.id]: 'archive' })}
                        className={`px-2 py-1 rounded-lg border text-[9px] font-bold transition ${
                          eodSelections[t.id] === 'archive'
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'border-border text-zinc-400 hover:text-white hover:bg-secondary'
                        }`}
                      >
                        Archive
                      </button>
                      <button
                        onClick={() => setEodSelections({ ...eodSelections, [t.id]: 'delete' })}
                        className={`px-2 py-1 rounded-lg border text-[9px] font-bold transition ${
                          eodSelections[t.id] === 'delete'
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'border-border text-zinc-400 hover:text-white hover:bg-secondary'
                        }`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 flex gap-3 mt-4">
              <button
                onClick={() => setIsEODModalOpen(false)}
                className="flex-1 py-2 border border-border hover:bg-secondary/40 text-muted-foreground rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEOD}
                className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                Confirm Roll-over Actions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Timer */}
      <TimerFloat />
    </div>
  );
}

// Kanban Card helper
interface KanbanCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStartTimer: (id: string) => void;
  onComplete: (id: string) => void;
  onStatusChange: (status: Task['status']) => void;
}

function KanbanCard({ task, onDragStart, onEdit, onDelete, onStartTimer, onComplete, onStatusChange }: KanbanCardProps) {
  const getPriorityColor = (p: Task['priority']) => {
    switch (p) {
      case 'HIGH': return 'text-red-400 border-red-500/20 bg-red-500/10';
      case 'MEDIUM': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      default: return 'text-zinc-400 border-border bg-secondary/40';
    }
  };

  const getTaskAgingAlert = () => {
    if (task.status === 'COMPLETED') return null;
    const now = new Date();
    
    if (task.dueDate && new Date(task.dueDate).getTime() < now.getTime()) {
      return (
        <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5 fill-red-400 animate-pulse" /> Overdue
        </span>
      );
    }

    if (task.status === 'PENDING' && task.timeInPendingState >= 1440) {
      return (
        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-bold flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" /> Pending {Math.floor(task.timeInPendingState / 1440)}d
        </span>
      );
    }
    return null;
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className="p-3.5 rounded-xl border border-border bg-card/45 hover:bg-card hover:border-border/80 transition cursor-grab active:cursor-grabbing flex flex-col gap-2.5 relative group"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-start justify-between gap-1.5">
          <span className="text-foreground text-xs font-bold leading-normal truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {task.name}
          </span>
          <div className="flex gap-1 items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(task)}
              className="p-1 rounded bg-background border border-border hover:text-foreground text-muted-foreground"
              title="Edit Task"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 rounded bg-background border border-border hover:text-red-500 dark:hover:text-red-400 text-muted-foreground"
              title="Delete Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {task.description && (
          <p className="text-zinc-400 text-[10px] leading-relaxed truncate-2-lines mt-0.5">
            {task.description}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-[8px] font-bold border ${getPriorityColor(task.priority)}`}>
          {task.priority}
        </span>
        <span className="text-[10px] text-zinc-500 font-medium font-mono">
          {task.estimatedDuration} min
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-2.5 mt-1 gap-2 flex-wrap">
        <select
          value={task.status}
          onChange={(e: any) => onStatusChange(e.target.value)}
          className="bg-background border border-border rounded-lg text-[9px] font-bold px-1.5 py-0.5 focus:outline-none focus:border-violet-500 text-foreground"
        >
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
        </select>

        {task.status !== 'COMPLETED' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onComplete(task.id)}
              className="p-1 rounded hover:bg-secondary text-zinc-500 hover:text-green-500"
              title="Mark Complete"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStartTimer(task.id)}
              className="px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-bold flex items-center gap-0.5 active:scale-95 transition"
            >
              <Play className="w-2.5 h-2.5 fill-white" /> Start
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        )}
      </div>
    </div>
  );
}

// List Card helper
interface ListViewCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStartTimer: (id: string) => void;
  onStatusChange: (status: Task['status']) => void;
  priorityColor: string;
}

function ListViewCard({ task, onEdit, onDelete, onStartTimer, onStatusChange, priorityColor }: ListViewCardProps) {
  const getTaskAgingAlert = () => {
    if (task.status === 'COMPLETED') return null;
    const now = new Date();
    
    if (task.dueDate && new Date(task.dueDate).getTime() < now.getTime()) {
      return (
        <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold flex items-center gap-0.5">
          <Zap className="w-2.5 h-2.5 fill-red-400" /> Overdue
        </span>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel border border-border/80 hover:border-border rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition duration-200">
      <div className="flex items-start gap-3 flex-1 overflow-hidden">
        {/* Status Dropdown */}
        <select
          value={task.status}
          onChange={(e: any) => onStatusChange(e.target.value)}
          className="mt-0.5 bg-background border border-border rounded-lg text-[9px] font-bold px-2 py-0.5 focus:outline-none focus:border-violet-500 text-foreground"
        >
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
        </select>

        <div className="flex flex-col gap-0.5 overflow-hidden">
          <span className={`text-xs font-bold text-foreground truncate ${task.status === 'COMPLETED' ? 'line-through opacity-40' : ''}`}>
            {task.name}
          </span>
          {task.description && (
            <p className="text-zinc-400 text-[11px] truncate max-w-md">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold border ${priorityColor}`}>
              {task.priority}
            </span>
            <span className="text-[9px] text-zinc-500">Category: {task.category}</span>
            <span className="text-[9px] text-zinc-500">Duration: {task.estimatedDuration}m | focus: {task.actualDuration}m</span>
            {getTaskAgingAlert()}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 border-border/60 pt-3 md:pt-0">
        {task.status !== 'COMPLETED' && (
          <button
            onClick={() => onStartTimer(task.id)}
            className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold shadow-md flex items-center gap-0.5 transition active:scale-95"
          >
            <Play className="w-2.5 h-2.5 fill-white" /> Start Timer
          </button>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(task)}
            className="p-2 rounded-xl bg-secondary border border-border hover:text-foreground text-muted-foreground transition"
            title="Edit Task"
          >
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 rounded-xl bg-secondary border border-border hover:text-red-500 dark:hover:text-red-450 text-muted-foreground transition"
            title="Delete Task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
