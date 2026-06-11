'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import {
  LayoutDashboard,
  Calendar,
  Archive,
  BarChart2,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Clock,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isGuest } = useAuthStore();
  const { notifications } = useNotificationStore();
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleLogout = () => {
    logout();
    router.push('/auth');
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('orbit_theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    const html = document.documentElement;
    if (savedTheme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('orbit_theme', nextTheme);
    const html = document.documentElement;
    if (nextTheme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Daily Planner', href: '/planner', icon: Calendar },
    { name: 'Archive & History', href: '/archive', icon: Archive },
    { name: 'Analytics Reports', href: '/reports', icon: BarChart2 },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 border-b border-border bg-background/90 text-foreground fixed top-0 w-full z-40 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-500 animate-pulse" />
          <span className="font-outfit font-bold text-lg tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">
            ORBITTRACK
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col justify-between py-6 px-4 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:top-0 top-[65px] h-[calc(100vh-65px)] md:h-screen`}
      >
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="hidden md:flex items-center gap-2.5 px-2">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
              <Clock className="w-5 h-5 text-violet-500 dark:text-violet-400 animate-pulse" />
            </div>
            <span className="font-outfit font-extrabold text-xl tracking-wider bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-white dark:via-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
              ORBITTRACK
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                    isActive
                      ? 'bg-secondary text-foreground font-semibold shadow-sm border border-border/40'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 transition-transform duration-250 group-hover:scale-105 ${isActive ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400'}`} />
                  <span className="font-inter text-sm">{item.name}</span>
                  {isActive && (
                    <span className="absolute right-4 w-1.5 h-1.5 rounded-full bg-violet-500 dark:bg-violet-400 animate-pulse" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Actions & Toggle Theme */}
        <div className="flex flex-col gap-4 border-t border-border pt-5">
          {/* User profile */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold font-outfit uppercase">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-foreground text-xs font-semibold truncate leading-tight">{user?.name || 'User'}</span>
              <span className="text-muted-foreground text-[10px] truncate leading-normal">
                {isGuest ? 'Guest Sandbox' : user?.email}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card text-muted-foreground hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-secondary transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop overlay for mobile drawer */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30"
        />
      )}
    </>
  );
}
