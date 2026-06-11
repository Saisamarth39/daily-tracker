'use client';

import React, { useEffect } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { Bell, Clock, AlertTriangle, Zap, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function NotificationCenter() {
  const { notifications, fetchNotifications, markAsRead, registerPushSubscription } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerPushSubscription();
      }
    } catch (err) {
      console.warn('Failed to authorize notifications:', err);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'TIMER_EXPIRED':
        return <Clock className="w-4 h-4 text-red-400" />;
      case 'PENDING_REMINDER':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'OVERDUE_ALERT':
        return <Zap className="w-4 h-4 text-orange-400 animate-bounce" />;
      default:
        return <Bell className="w-4 h-4 text-violet-400" />;
    }
  };

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <div className="w-full glass-panel border border-border rounded-xl p-5 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4.5 h-4.5 text-violet-400" />
          <h2 className="font-outfit font-bold text-sm text-foreground">Alert Logs</h2>
        </div>
        {unreadNotifications.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {unreadNotifications.length} New
          </span>
        )}
      </div>

      {/* Enable Browser Push Alerts banner */}
      {typeof window !== 'undefined' && Notification.permission !== 'granted' && (
        <div className="mb-4 p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 flex flex-col md:flex-row md:items-center justify-between gap-3 glow-blue">
          <div className="flex gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-violet-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground text-xs font-semibold">Enable Browser Alerts</span>
              <p className="text-zinc-400 text-[10px] leading-relaxed">
                Receive timer expirations and reminders even when minimized.
              </p>
            </div>
          </div>
          <button
            onClick={handleEnableNotifications}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold shadow-md shadow-violet-600/20 transition-all duration-200 self-start md:self-auto"
          >
            Authorize Alerts
          </button>
        </div>
      )}

      {/* Notifications list */}
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <CheckCircle2 className="w-6 h-6 mb-2 stroke-1 text-zinc-500" />
            <span className="text-xs font-medium">All caught up!</span>
          </div>
        ) : (
          <>
            {/* Unread Section */}
            {unreadNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className="flex items-start gap-3 p-3 rounded-xl border border-violet-500/10 bg-violet-500/5 hover:bg-secondary/40 cursor-pointer transition-all duration-200"
              >
                <div className="p-1.5 rounded-lg bg-background border border-border">
                  {getNotifIcon(notif.type)}
                </div>
                <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground text-xs font-bold truncate pr-2">
                      {notif.title}
                    </span>
                    <span className="text-[9px] text-violet-400 font-bold flex-shrink-0">
                      • New
                    </span>
                  </div>
                  <p className="text-foreground/85 dark:text-zinc-400 text-[10px] leading-relaxed pr-2">
                    {notif.message}
                  </p>
                  <span className="text-[9px] text-zinc-500 mt-1">
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Read Section */}
            {readNotifications.map((notif) => (
              <div
                key={notif.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card/20 hover:bg-card/40 transition-all duration-200"
              >
                <div className="p-1.5 rounded-lg bg-secondary/60 border border-border/40">
                  {getNotifIcon(notif.type)}
                </div>
                <div className="flex flex-col gap-0.5 flex-1 overflow-hidden opacity-60">
                  <span className="text-foreground/90 dark:text-zinc-400 text-xs font-semibold truncate">
                    {notif.title}
                  </span>
                  <p className="text-zinc-450 text-[10px] leading-relaxed">
                    {notif.message}
                  </p>
                  <span className="text-[9px] text-zinc-500 mt-1">
                    {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                    {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
