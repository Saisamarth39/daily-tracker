import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface Task {
  id: string;
  name: string;
  description?: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PENDING' | 'COMPLETED' | 'ARCHIVED';
  estimatedDuration: number; // in minutes
  actualDuration: number;    // in minutes
  remainingDuration: number; // in minutes
  lastStartedAt?: string;
  isTimerRunning: boolean;
  dueDate?: string;
  isRecurring: boolean;
  recurrenceRule?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  timeInPendingState: number; // in minutes
  ageInDays?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
}

interface TaskState {
  tasks: Task[];
  archivedTasks: Task[];
  activeTaskId: string | null;
  activeTimerSeconds: number; // precise countdown seconds
  isLoading: boolean;
  error: string | null;
  timerIntervalId: NodeJS.Timeout | null;

  // Actions
  fetchTasks: () => Promise<void>;
  fetchArchive: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'timeInPendingState' | 'actualDuration' | 'remainingDuration' | 'isTimerRunning' | 'status'>) => Promise<void>;
  updateTaskDetails: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  updateTaskStatus: (id: string, status: Task['status']) => Promise<void>;
  archiveTask: (id: string) => Promise<void>;
  carryForward: (actions: { [taskId: string]: 'move_tomorrow' | 'archive' | 'delete' }) => Promise<void>;
  
  // Timer System Actions
  startTimer: (id: string) => Promise<void>;
  pauseTimer: (id: string) => Promise<void>;
  stopTimer: (id: string) => Promise<void>;
  extendTimer: (id: string, minutes: number) => Promise<void>;
  tickTimer: () => void;
  syncRunningTimerOnLoad: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => {
  const getHeaders = () => {
    const token = localStorage.getItem('orbit_token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  };

  const isGuest = () => useAuthStore.getState().isGuest;

  const getFullLocalTasks = (): Task[] => {
    const local = localStorage.getItem('orbit_guest_tasks');
    if (!local) {
      const mock = getMockTasks();
      localStorage.setItem('orbit_guest_tasks', JSON.stringify(mock));
      return mock;
    }
    return JSON.parse(local);
  };

  const saveFullLocalTasks = (allTasks: Task[]) => {
    localStorage.setItem('orbit_guest_tasks', JSON.stringify(allTasks));
  };

  return {
    tasks: [],
    archivedTasks: [],
    activeTaskId: null,
    activeTimerSeconds: 0,
    isLoading: false,
    error: null,
    timerIntervalId: null,

    fetchTasks: async () => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        set({ tasks: allTasks.filter((t: Task) => t.status !== 'ARCHIVED') });
        get().syncRunningTimerOnLoad();
        return;
      }

      set({ isLoading: true });
      try {
        const res = await fetch(`${API_URL}/tasks`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch tasks');
        const tasks = await res.json();
        set({ tasks, isLoading: false });
        get().syncRunningTimerOnLoad();
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    fetchArchive: async () => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        set({ archivedTasks: allTasks.filter((t: Task) => t.status === 'ARCHIVED') });
        return;
      }

      set({ isLoading: true });
      try {
        const res = await fetch(`${API_URL}/tasks/archive`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch archive');
        const archivedTasks = await res.json();
        set({ archivedTasks, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    addTask: async (taskInput) => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const newTask: Task = {
          ...taskInput,
          status: 'NOT_STARTED',
          id: `task-${Date.now()}`,
          actualDuration: 0,
          remainingDuration: taskInput.estimatedDuration,
          timeInPendingState: 0,
          isTimerRunning: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ageInDays: 0,
        };
        const updatedAll = [newTask, ...allTasks];
        saveFullLocalTasks(updatedAll);
        set({ tasks: updatedAll.filter(t => t.status !== 'ARCHIVED') });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(taskInput),
        });
        if (!res.ok) throw new Error('Failed to create task');
        const newTask = await res.json();
        set({ tasks: [newTask, ...get().tasks] });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    updateTaskDetails: async (id, updates) => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const updatedAll = allTasks.map(t => {
          if (t.id === id) {
            const up = { ...t, ...updates, updatedAt: new Date().toISOString() };
            if (updates.estimatedDuration !== undefined && !t.isTimerRunning) {
              up.remainingDuration = updates.estimatedDuration;
            }
            return up;
          }
          return t;
        });
        saveFullLocalTasks(updatedAll);
        set({ tasks: updatedAll.filter(t => t.status !== 'ARCHIVED') });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error('Failed to update task');
        const updated = await res.json();
        set({ tasks: get().tasks.map(t => (t.id === id ? updated : t)) });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    deleteTask: async (id) => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const updatedAll = allTasks.filter(t => t.id !== id);
        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          archivedTasks: updatedAll.filter(t => t.status === 'ARCHIVED'),
        });
        if (get().activeTaskId === id) {
          get().stopTimer(id);
        }
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}`, {
          method: 'DELETE',
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to delete task');
        set({ tasks: get().tasks.filter(t => t.id !== id) });
        if (get().activeTaskId === id) {
          get().stopTimer(id);
        }
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    updateTaskStatus: async (id, status) => {
      if (status === 'COMPLETED' && get().activeTaskId === id) {
        if (get().timerIntervalId) {
          clearInterval(get().timerIntervalId!);
          set({ timerIntervalId: null, activeTaskId: null, activeTimerSeconds: 0 });
        }
      }

      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const now = new Date().toISOString();
        let updatedAll = allTasks.map(t => {
          if (t.id === id) {
            const compAt = status === 'COMPLETED' ? now : undefined;
            return {
              ...t,
              status,
              isTimerRunning: false,
              completedAt: compAt,
              remainingDuration: status === 'COMPLETED' ? 0 : t.remainingDuration,
              updatedAt: now,
            };
          }
          return t;
        });
        
        // Spawn recurrence in guest mode
        const originalTask = allTasks.find(t => t.id === id);
        if (status === 'COMPLETED' && originalTask && originalTask.isRecurring && originalTask.recurrenceRule) {
          let nextDueDate = originalTask.dueDate ? new Date(originalTask.dueDate) : new Date();
          if (originalTask.recurrenceRule === 'DAILY') nextDueDate.setDate(nextDueDate.getDate() + 1);
          if (originalTask.recurrenceRule === 'WEEKLY') nextDueDate.setDate(nextDueDate.getDate() + 7);
          if (originalTask.recurrenceRule === 'MONTHLY') nextDueDate.setMonth(nextDueDate.getMonth() + 1);

          const recurredTask: Task = {
            ...originalTask,
            id: `task-${Date.now()}-rec`,
            status: 'NOT_STARTED',
            isTimerRunning: false,
            actualDuration: 0,
            remainingDuration: originalTask.estimatedDuration,
            completedAt: undefined,
            dueDate: nextDueDate.toISOString(),
            createdAt: now,
            updatedAt: now,
          };
          updatedAll.push(recurredTask);
        }

        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          archivedTasks: updatedAll.filter(t => t.status === 'ARCHIVED'),
        });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}/status`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ status }),
        });
        if (!res.ok) throw new Error('Failed to update status');
        get().fetchTasks();
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    archiveTask: async (id) => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const updatedAll = allTasks.map(t => (t.id === id ? { ...t, status: 'ARCHIVED' as const, archivedAt: new Date().toISOString() } : t));
        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          archivedTasks: updatedAll.filter(t => t.status === 'ARCHIVED'),
        });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}/archive`, {
          method: 'POST',
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to archive task');
        set({
          tasks: get().tasks.filter(t => t.id !== id),
        });
        get().fetchArchive();
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    carryForward: async (actions) => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);

        let updatedAll = [...allTasks];

        for (const [taskId, action] of Object.entries(actions)) {
          if (action === 'move_tomorrow') {
            updatedAll = updatedAll.map(t => (t.id === taskId ? { ...t, dueDate: tomorrow.toISOString(), status: 'NOT_STARTED', isTimerRunning: false } : t));
          } else if (action === 'archive') {
            updatedAll = updatedAll.map(t => (t.id === taskId ? { ...t, status: 'ARCHIVED', archivedAt: new Date().toISOString(), isTimerRunning: false } : t));
          } else if (action === 'delete') {
            updatedAll = updatedAll.filter(t => t.id !== taskId);
          }
        }
        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          archivedTasks: updatedAll.filter(t => t.status === 'ARCHIVED'),
        });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/carry-forward`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ actions }),
        });
        if (!res.ok) throw new Error('Failed to carry forward tasks');
        get().fetchTasks();
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    // Timer Implementation
    startTimer: async (id) => {
      const activeId = get().activeTaskId;
      if (activeId && activeId !== id) {
        await get().pauseTimer(activeId);
      }

      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const task = allTasks.find(t => t.id === id);
        if (!task) return;

        const nowStr = new Date().toISOString();
        const initialSeconds = task.remainingDuration > 0 ? task.remainingDuration * 60 : task.estimatedDuration * 60;
        
        const updatedAll = allTasks.map(t => {
          if (t.id === id) {
            return {
              ...t,
              isTimerRunning: true,
              lastStartedAt: nowStr,
              status: 'IN_PROGRESS' as const,
              remainingDuration: task.remainingDuration > 0 ? task.remainingDuration : task.estimatedDuration,
            };
          }
          // Pause others
          return t.isTimerRunning ? { ...t, isTimerRunning: false, lastStartedAt: undefined } : t;
        });

        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          activeTaskId: id,
          activeTimerSeconds: initialSeconds > 0 ? initialSeconds : 1800,
        });

        if (get().timerIntervalId) clearInterval(get().timerIntervalId!);
        const intv = setInterval(() => get().tickTimer(), 1000);
        set({ timerIntervalId: intv });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}/timer`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ action: 'start' }),
        });
        if (!res.ok) throw new Error('Failed to start timer');
        const updated = await res.json();
        
        set({
          tasks: get().tasks.map(t => (t.id === id ? updated : t)),
          activeTaskId: id,
          activeTimerSeconds: updated.remainingDuration * 60,
        });

        if (get().timerIntervalId) clearInterval(get().timerIntervalId!);
        const intv = setInterval(() => get().tickTimer(), 1000);
        set({ timerIntervalId: intv });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    pauseTimer: async (id) => {
      if (get().activeTaskId === id && get().timerIntervalId) {
        clearInterval(get().timerIntervalId!);
        set({ timerIntervalId: null });
      }

      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const task = allTasks.find(t => t.id === id);
        if (!task) return;

        const now = new Date();
        const elapsedMinutes = task.lastStartedAt
          ? Math.round((now.getTime() - new Date(task.lastStartedAt).getTime()) / 60000)
          : 0;

        const newActual = task.actualDuration + elapsedMinutes;
        const newRemaining = Math.max(0, Math.ceil(get().activeTimerSeconds / 60));

        const updatedAll = allTasks.map(t => {
          if (t.id === id) {
            return {
              ...t,
              isTimerRunning: false,
              lastStartedAt: undefined,
              status: 'PENDING' as const,
              actualDuration: newActual,
              remainingDuration: newRemaining,
            };
          }
          return t;
        });

        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          activeTaskId: null,
          activeTimerSeconds: 0,
        });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}/timer`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ action: 'pause' }),
        });
        if (!res.ok) throw new Error('Failed to pause timer');
        const updated = await res.json();

        set({
          tasks: get().tasks.map(t => (t.id === id ? updated : t)),
          activeTaskId: null,
          activeTimerSeconds: 0,
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    stopTimer: async (id) => {
      if (get().activeTaskId === id && get().timerIntervalId) {
        clearInterval(get().timerIntervalId!);
        set({ timerIntervalId: null });
      }

      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const task = allTasks.find(t => t.id === id);
        if (!task) return;

        const now = new Date();
        const elapsedMinutes = task.lastStartedAt
          ? Math.round((now.getTime() - new Date(task.lastStartedAt).getTime()) / 60000)
          : 0;

        const newActual = task.actualDuration + elapsedMinutes;

        const updatedAll = allTasks.map(t => {
          if (t.id === id) {
            return {
              ...t,
              isTimerRunning: false,
              lastStartedAt: undefined,
              status: 'NOT_STARTED' as const,
              actualDuration: newActual,
              remainingDuration: t.estimatedDuration,
            };
          }
          return t;
        });

        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          activeTaskId: null,
          activeTimerSeconds: 0,
        });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}/timer`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ action: 'stop' }),
        });
        if (!res.ok) throw new Error('Failed to stop timer');
        const updated = await res.json();

        set({
          tasks: get().tasks.map(t => (t.id === id ? updated : t)),
          activeTaskId: null,
          activeTimerSeconds: 0,
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    extendTimer: async (id, minutes) => {
      if (isGuest()) {
        const allTasks = getFullLocalTasks();
        const now = new Date().toISOString();
        const updatedAll = allTasks.map(t => {
          if (t.id === id) {
            return {
              ...t,
              isTimerRunning: true,
              lastStartedAt: now,
              status: 'IN_PROGRESS' as const,
              remainingDuration: minutes,
            };
          }
          return t;
        });

        saveFullLocalTasks(updatedAll);
        set({
          tasks: updatedAll.filter(t => t.status !== 'ARCHIVED'),
          activeTaskId: id,
          activeTimerSeconds: minutes * 60,
        });

        if (get().timerIntervalId) clearInterval(get().timerIntervalId!);
        const intv = setInterval(() => get().tickTimer(), 1000);
        set({ timerIntervalId: intv });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/tasks/${id}/timer`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ action: `extend_${minutes}` }),
        });
        if (!res.ok) throw new Error('Failed to extend timer');
        const updated = await res.json();

        set({
          tasks: get().tasks.map(t => (t.id === id ? updated : t)),
          activeTaskId: id,
          activeTimerSeconds: updated.remainingDuration * 60,
        });

        if (get().timerIntervalId) clearInterval(get().timerIntervalId!);
        const intv = setInterval(() => get().tickTimer(), 1000);
        set({ timerIntervalId: intv });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    tickTimer: () => {
      const sec = get().activeTimerSeconds;
      const activeId = get().activeTaskId;
      if (!activeId) return;

      if (sec <= 1) {
        if (get().timerIntervalId) clearInterval(get().timerIntervalId!);
        set({ timerIntervalId: null, activeTimerSeconds: 0 });

        if (Notification.permission === 'granted') {
          const task = get().tasks.find(t => t.id === activeId);
          new Notification('Timer Expired!', {
            body: `Time allocated for "${task?.name || 'Task'}" has ended.`,
            icon: '/favicon.ico',
          });
        }

        get().updateTaskStatus(activeId, 'PENDING');
      } else {
        set({ activeTimerSeconds: sec - 1 });
      }
    },

    syncRunningTimerOnLoad: () => {
      const running = get().tasks.find(t => t.isTimerRunning && t.status === 'IN_PROGRESS');
      if (running && running.lastStartedAt) {
        const elapsedSeconds = Math.floor((Date.now() - new Date(running.lastStartedAt).getTime()) / 1000);
        const remainingSeconds = running.remainingDuration * 60 - elapsedSeconds;

        if (remainingSeconds <= 0) {
          get().updateTaskStatus(running.id, 'PENDING');
        } else {
          set({
            activeTaskId: running.id,
            activeTimerSeconds: remainingSeconds,
          });
          if (get().timerIntervalId) clearInterval(get().timerIntervalId!);
          const intv = setInterval(() => get().tickTimer(), 1000);
          set({ timerIntervalId: intv });
        }
      }
    },
  };
});

// Mock Data for Guest Mode
function getMockTasks(): Task[] {
  const now = new Date();
  const subDaysStr = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() - days);
    return res.toISOString();
  };

  return [
    {
      id: 'mock-1',
      name: 'Partnership Outreach',
      description: 'Draft emails to potential sales leads.',
      category: 'Outreach',
      priority: 'HIGH',
      status: 'COMPLETED',
      estimatedDuration: 60,
      actualDuration: 48,
      remainingDuration: 0,
      createdAt: subDaysStr(now, 3),
      updatedAt: subDaysStr(now, 3),
      completedAt: subDaysStr(now, 3),
      timeInPendingState: 0,
    },
    {
      id: 'mock-2',
      name: 'Proposal Review',
      description: 'Go over draft contract document from lawyers.',
      category: 'Proposal',
      priority: 'MEDIUM',
      status: 'COMPLETED',
      estimatedDuration: 45,
      actualDuration: 60,
      remainingDuration: 0,
      createdAt: subDaysStr(now, 2),
      updatedAt: subDaysStr(now, 2),
      completedAt: subDaysStr(now, 2),
      timeInPendingState: 0,
    },
    {
      id: 'mock-3',
      name: 'LinkedIn Posting',
      description: 'Share insights about task execution management.',
      category: 'Social',
      priority: 'LOW',
      status: 'NOT_STARTED',
      estimatedDuration: 20,
      actualDuration: 0,
      remainingDuration: 20,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      dueDate: new Date().toISOString(),
      createdAt: subDaysStr(now, 1),
      updatedAt: subDaysStr(now, 1),
      timeInPendingState: 0,
    },
    {
      id: 'mock-4',
      name: 'Design UI Components',
      description: 'Implement dark/light layout and timer floating panels.',
      category: 'Design',
      priority: 'HIGH',
      status: 'NOT_STARTED',
      estimatedDuration: 120,
      actualDuration: 0,
      remainingDuration: 120,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeInPendingState: 0,
    },
    {
      id: 'mock-5',
      name: 'Draft Sales Contract',
      description: 'Collect document signatures.',
      category: 'Legal',
      priority: 'MEDIUM',
      status: 'PENDING',
      estimatedDuration: 90,
      actualDuration: 30,
      remainingDuration: 60,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      timeInPendingState: 2880, // 2 days in minutes
      dueDate: subDaysStr(now, 1),
      createdAt: subDaysStr(now, 4),
      updatedAt: subDaysStr(now, 1),
    },
    {
      id: 'mock-6',
      name: 'Refactor Auth Middleware',
      description: 'Clean up token expiry logic.',
      category: 'Development',
      priority: 'HIGH',
      status: 'NOT_STARTED',
      estimatedDuration: 75,
      actualDuration: 0,
      remainingDuration: 75,
      isRecurring: true,
      recurrenceRule: 'DAILY',
      dueDate: subDaysStr(now, 2), // Overdue by 2 days
      createdAt: subDaysStr(now, 3),
      updatedAt: subDaysStr(now, 3),
      timeInPendingState: 0,
    },
  ];
}
