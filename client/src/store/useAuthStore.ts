import { create } from 'zustand';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<boolean>;
  guestLogin: () => void;
  logout: () => void;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

// IndexedDB Helper to share token with Service Worker
const writeTokenToIndexedDB = (token: string) => {
  if (typeof window === 'undefined') return;
  const request = indexedDB.open('orbit_track_db', 1);
  request.onupgradeneeded = (e: any) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('auth')) {
      db.createObjectStore('auth', { keyPath: 'key' });
    }
  };
  request.onsuccess = (e: any) => {
    const db = e.target.result;
    try {
      const transaction = db.transaction('auth', 'readwrite');
      const store = transaction.objectStore('auth');
      store.put({ key: 'token', value: token });
    } catch (err) {
      console.warn('Failed to write token to IndexedDB:', err);
    }
  };
};

const clearTokenFromIndexedDB = () => {
  if (typeof window === 'undefined') return;
  const request = indexedDB.open('orbit_track_db', 1);
  request.onsuccess = (e: any) => {
    const db = e.target.result;
    try {
      const transaction = db.transaction('auth', 'readwrite');
      const store = transaction.objectStore('auth');
      store.delete('token');
    } catch (err) {
      console.warn('Failed to clear token from IndexedDB:', err);
    }
  };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isGuest: false,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('orbit_token', data.token);
      writeTokenToIndexedDB(data.token);
      set({ token: data.token, user: data.user, isGuest: false, isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      localStorage.setItem('orbit_token', data.token);
      writeTokenToIndexedDB(data.token);
      set({ token: data.token, user: data.user, isGuest: false, isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  guestLogin: () => {
    localStorage.setItem('orbit_is_guest', 'true');
    localStorage.setItem('orbit_token', 'guest-mock-token');
    set({
      user: {
        id: 'guest-user-id',
        email: 'guest@orbit-track.local',
        name: 'Guest Explorer',
        createdAt: new Date().toISOString(),
      },
      token: 'guest-mock-token',
      isGuest: true,
      error: null,
    });
  },

  logout: () => {
    localStorage.removeItem('orbit_token');
    localStorage.removeItem('orbit_is_guest');
    clearTokenFromIndexedDB();
    set({ user: null, token: null, isGuest: false, error: null });
  },

  checkSession: async () => {
    const isGuest = localStorage.getItem('orbit_is_guest') === 'true';
    if (isGuest) {
      set({
        user: {
          id: 'guest-user-id',
          email: 'guest@orbit-track.local',
          name: 'Guest Explorer',
          createdAt: new Date().toISOString(),
        },
        token: 'guest-mock-token',
        isGuest: true,
        isLoading: false,
      });
      return;
    }

    const token = localStorage.getItem('orbit_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Session expired');
      }

      const user = await res.json();
      writeTokenToIndexedDB(token);
      set({ token, user, isGuest: false, isLoading: false });
    } catch (err) {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_is_guest');
      clearTokenFromIndexedDB();
      set({ token: null, user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
