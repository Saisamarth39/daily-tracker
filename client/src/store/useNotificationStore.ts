import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface AlertNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: AlertNotification[];
  isLoading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  registerPushSubscription: () => Promise<void>;
  addMockNotification: (title: string, message: string, type: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => {
  const getHeaders = () => {
    const token = localStorage.getItem('orbit_token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  };

  const isGuest = () => useAuthStore.getState().isGuest;

  // Convert array buffer to base64 for VAPID conversion
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  return {
    notifications: [],
    isLoading: false,
    error: null,

    fetchNotifications: async () => {
      if (isGuest()) {
        const local = localStorage.getItem('orbit_guest_notifs');
        set({ notifications: local ? JSON.parse(local) : getMockNotifications() });
        return;
      }

      set({ isLoading: true });
      try {
        const res = await fetch(`${API_URL}/notifications`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        set({ notifications: data, isLoading: false });
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    markAsRead: async (id) => {
      if (isGuest()) {
        const updated = get().notifications.map(n => (n.id === id ? { ...n, read: true } : n));
        localStorage.setItem('orbit_guest_notifs', JSON.stringify(updated));
        set({ notifications: updated });
        return;
      }

      try {
        const res = await fetch(`${API_URL}/notifications/${id}/read`, {
          method: 'PATCH',
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to mark read');
        set({
          notifications: get().notifications.map(n => (n.id === id ? { ...n, read: true } : n)),
        });
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    registerPushSubscription: async () => {
      if (isGuest()) {
        console.log('Skipping Web Push subscription registration in Guest Mode.');
        return;
      }

      try {
        // 1. Register Service Worker if supported
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.warn('Web push not supported by this browser.');
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered with scope:', registration.scope);

        // 2. Get VAPID Public Key from backend
        const keyRes = await fetch(`${API_URL}/notifications/vapid-key`);
        if (!keyRes.ok) throw new Error('Could not fetch public VAPID key');
        const { publicKey } = await keyRes.json();

        if (!publicKey) {
          console.warn('Public VAPID key is empty. Push subscription registration bypassed.');
          return;
        }

        // 3. Subscribe User via Push Manager
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // 4. Send Subscription details to backend
        const subJSON = subscription.toJSON();
        await fetch(`${API_URL}/notifications/subscription`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            endpoint: subJSON.endpoint,
            keys: {
              auth: subJSON.keys?.auth,
              p256dh: subJSON.keys?.p256dh,
            },
          }),
        });
        console.log('Web Push subscription successfully synchronized with server.');
      } catch (err: any) {
        console.warn('Failed to register Web Push:', err.message);
      }
    },

    addMockNotification: (title, message, type) => {
      const newNotif: AlertNotification = {
        id: `notif-${Date.now()}`,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const all = [newNotif, ...get().notifications];
      localStorage.setItem('orbit_guest_notifs', JSON.stringify(all));
      set({ notifications: all });
    },
  };
});

function getMockNotifications(): AlertNotification[] {
  const now = new Date();
  const subDaysStr = (d: Date, days: number) => {
    const res = new Date(d);
    res.setDate(res.getDate() - days);
    return res.toISOString();
  };

  return [
    {
      id: 'mock-n1',
      title: 'Timer Expired!',
      message: 'Time allocated for "Proposal Review" has ended.',
      type: 'TIMER_EXPIRED',
      read: true,
      createdAt: subDaysStr(now, 2),
    },
    {
      id: 'mock-n2',
      title: 'Task Accountability Reminder',
      message: '"Refactor Auth Middleware" has been pending/not started for 2 days.',
      type: 'PENDING_REMINDER',
      read: false,
      createdAt: subDaysStr(now, 1),
    },
    {
      id: 'mock-n3',
      title: 'Overdue Task Alert',
      message: '"Draft Sales Contract" is overdue by 1 day!',
      type: 'OVERDUE_ALERT',
      read: false,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
