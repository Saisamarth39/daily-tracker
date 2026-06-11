import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load env variables
dotenv.config();

import { signup, login, getMe } from './controllers/auth';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  updateStatus,
  handleTimer,
  archiveTask,
  getArchive,
  carryForwardTasks,
} from './controllers/tasks';
import {
  getDashboardStats,
  getDailyHistory,
  getReports,
  getProductivityInsights,
} from './controllers/analytics';
import {
  getNotifications,
  markNotificationRead,
  subscribePush,
} from './controllers/notifications';
import { authenticateToken } from './middleware/auth';
import { getVapidPublicKey } from './services/push';
import { taskScheduler } from './services/queue';

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Auth routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.get('/api/auth/me', authenticateToken as any, getMe as any);

// Task routes
app.post('/api/tasks', authenticateToken as any, createTask as any);
app.get('/api/tasks', authenticateToken as any, getTasks as any);
app.put('/api/tasks/:id', authenticateToken as any, updateTask as any);
app.delete('/api/tasks/:id', authenticateToken as any, deleteTask as any);
app.patch('/api/tasks/:id/status', authenticateToken as any, updateStatus as any);
app.post('/api/tasks/:id/timer', authenticateToken as any, handleTimer as any);
app.post('/api/tasks/:id/archive', authenticateToken as any, archiveTask as any);
app.get('/api/tasks/archive', authenticateToken as any, getArchive as any);
app.post('/api/tasks/carry-forward', authenticateToken as any, carryForwardTasks as any);

// Notification routes
app.get('/api/notifications', authenticateToken as any, getNotifications as any);
app.patch('/api/notifications/:id/read', authenticateToken as any, markNotificationRead as any);
app.post('/api/notifications/subscription', authenticateToken as any, subscribePush as any);
app.get('/api/notifications/vapid-key', (req: Request, res: Response) => {
  res.status(200).json({ publicKey: getVapidPublicKey() });
});

// Analytics routes
app.get('/api/analytics/dashboard', authenticateToken as any, getDashboardStats as any);
app.get('/api/analytics/history', authenticateToken as any, getDailyHistory as any);
app.get('/api/analytics/reports', authenticateToken as any, getReports as any);
app.get('/api/analytics/insights', authenticateToken as any, getProductivityInsights as any);

// Base route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Global error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`OrbitTrack Backend running on 0.0.0.0:${PORT}`);
  
  // Start the background engines
  try {
    await taskScheduler.resumeTimers();
    taskScheduler.startReminderEngine();
  } catch (err) {
    console.error('Failed to boot background timer and reminder engines:', err);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Shutting down gracefully.');
  taskScheduler.stopReminderEngine();
  server.close(() => {
    console.log('Http server closed.');
    process.exit(0);
  });
});
