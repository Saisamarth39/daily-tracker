'use client';

import React from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { Play, Pause, Square, Plus } from 'lucide-react';

export default function TimerFloat() {
  const { tasks, activeTaskId, activeTimerSeconds, pauseTimer, startTimer, stopTimer, extendTimer } = useTaskStore();

  const task = tasks.find(t => t.id === activeTaskId);

  if (!activeTaskId || !task) return null;

  const mins = Math.floor(activeTimerSeconds / 60);
  const secs = activeTimerSeconds % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // SVG Progress calculation
  const totalSeconds = task.remainingDuration > 0 
    ? task.remainingDuration * 60 
    : task.estimatedDuration * 60 || 1800; // default 30 mins
  
  const percentage = totalSeconds > 0 ? (activeTimerSeconds / totalSeconds) * 100 : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const handleToggleTimer = () => {
    if (task.isTimerRunning) {
      pauseTimer(task.id);
    } else {
      startTimer(task.id);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 glass-panel shadow-2xl rounded-xl p-4 flex items-center gap-4 glow-blue max-w-sm md:max-w-md border border-violet-500/20 animate-in fade-in slide-in-from-bottom-5 duration-300">
      {/* SVG Radial Progress Dial */}
      <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-zinc-800/40"
            strokeWidth="3.5"
            fill="transparent"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="stroke-violet-500 transition-all duration-1000 ease-linear"
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute font-outfit text-xs font-semibold text-violet-400">
          {Math.round(percentage)}%
        </span>
      </div>

      {/* Task Details */}
      <div className="flex flex-col gap-0.5 overflow-hidden w-36 md:w-44">
        <span className="text-white text-sm font-semibold truncate leading-none">
          {task.name}
        </span>
        <span className="text-zinc-400 text-[10px] truncate leading-normal mt-0.5">
          Est: {task.estimatedDuration}m | {task.status.replace('_', ' ')}
        </span>
        <span className="font-mono text-lg font-bold text-white tracking-widest mt-1">
          {timeStr}
        </span>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center gap-1.5 border-l border-border pl-3">
        {/* Play/Pause */}
        <button
          onClick={handleToggleTimer}
          className={`p-2 rounded-xl flex items-center justify-center transition-all duration-200 ${
            task.isTimerRunning 
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
              : 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
          }`}
        >
          {task.isTimerRunning ? <Pause className="w-3.5 h-3.5 fill-amber-400" /> : <Play className="w-3.5 h-3.5 fill-green-400" />}
        </button>

        {/* Stop */}
        <button
          onClick={() => stopTimer(task.id)}
          className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition"
        >
          <Square className="w-3.5 h-3.5 fill-red-400" />
        </button>

        {/* Quick Extensions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => extendTimer(task.id, 15)}
            className="px-1.5 py-0.5 rounded bg-secondary border border-border hover:border-zinc-700 text-[9px] font-bold text-muted-foreground hover:text-foreground"
          >
            +15m
          </button>
          <button
            onClick={() => extendTimer(task.id, 30)}
            className="px-1.5 py-0.5 rounded bg-secondary border border-border hover:border-zinc-700 text-[9px] font-bold text-muted-foreground hover:text-foreground"
          >
            +30m
          </button>
        </div>
      </div>
    </div>
  );
}
