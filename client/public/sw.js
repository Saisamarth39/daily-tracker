// OrbitTrack Web Push Service Worker

const API_URL = 'http://localhost:5000/api';

// Helper to open IndexedDB and retrieve JWT token
function getJWTToken() {
  return new Promise((resolve) => {
    const request = indexedDB.open('orbit_track_db', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'key' });
      }
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const transaction = db.transaction('auth', 'readonly');
        const store = transaction.objectStore('auth');
        const getReq = store.get('token');
        getReq.onsuccess = () => {
          resolve(getReq.result ? getReq.result.value : null);
        };
        getReq.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

// Push Event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, actions, data, tag } = payload;

    const options = {
      body: body || 'Accountability update from OrbitTrack.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [100, 50, 100],
      data: data || {},
      tag: tag || 'orbit-alert',
      actions: actions || [], // Action buttons e.g., Mark Complete, Extend
      requireInteraction: true
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('Failed to process push message:', err);
  }
});

// Click notification and action buttons handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { taskId, notificationId } = event.notification.data || {};
  const actionClicked = event.action; // Action ID clicked (e.g. 'complete', 'extend_15')

  if (!taskId) return;

  event.waitUntil(
    (async () => {
      const token = await getJWTToken();
      const headers = {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
      };

      // 1. Mark alert as read
      if (notificationId) {
        try {
          await fetch(`${API_URL}/notifications/${notificationId}/read`, {
            method: 'PATCH',
            headers,
          });
        } catch (err) {
          console.warn('SW failed to mark notification read:', err);
        }
      }

      // 2. Perform task actions based on button clicked
      if (actionClicked) {
        // Map timer actions
        if (['complete', 'extend_15', 'extend_30', 'continue', 'pending'].includes(actionClicked)) {
          let timerAction = actionClicked;
          
          if (actionClicked === 'complete') {
            // Task status API
            try {
              await fetch(`${API_URL}/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ status: 'COMPLETED' }),
              });
            } catch (err) {
              console.error('SW failed to complete task:', err);
            }
          } else {
            // Timer action api
            if (actionClicked === 'continue') timerAction = 'resume';
            try {
              await fetch(`${API_URL}/tasks/${taskId}/timer`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ action: timerAction }),
              });
            } catch (err) {
              console.error('SW failed to update timer:', err);
            }
          }
        }
        
        // Map reminder actions (start, reschedule, complete)
        if (actionClicked === 'start') {
          try {
            await fetch(`${API_URL}/tasks/${taskId}/timer`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ action: 'start' }),
            });
          } catch (err) {
            console.error('SW failed to start task timer:', err);
          }
        } else if (actionClicked === 'reschedule') {
          // Open the application so user can pick due date
          const clientWindows = await self.clients.matchAll({ type: 'window' });
          if (clientWindows.length > 0) {
            clientWindows[0].focus();
          } else {
            self.clients.openWindow('/');
          }
        }
      } else {
        // If clicking the notification body itself (no specific button), open/focus client window
        const clientWindows = await self.clients.matchAll({ type: 'window' });
        if (clientWindows.length > 0) {
          clientWindows[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      }
    })()
  );
});
