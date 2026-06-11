import { Response } from 'express';
import prisma from '../services/db';
import { AuthenticatedRequest } from '../middleware/auth';

// Get user notifications
export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.status(200).json(notifications);
  } catch (err: any) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Mark notification as read
export const markNotificationRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    res.status(200).json(updated);
  } catch (err: any) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Subscribe to Web Push Notifications
export const subscribePush = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { endpoint, keys } = req.body;

    if (!endpoint || !keys || !keys.auth || !keys.p256dh) {
      res.status(400).json({ error: 'Invalid subscription payload. Endpoint and keys (auth, p256dh) are required.' });
      return;
    }

    // Save or update subscription
    const existing = await prisma.subscription.findUnique({
      where: { endpoint },
    });

    let subscription;
    if (existing) {
      subscription = await prisma.subscription.update({
        where: { endpoint },
        data: {
          userId,
          keysAuth: keys.auth,
          keysP256dh: keys.p256dh,
        },
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          endpoint,
          keysAuth: keys.auth,
          keysP256dh: keys.p256dh,
        },
      });
    }

    res.status(201).json({ message: 'Web Push subscription registered successfully', subscription });
  } catch (err: any) {
    console.error('Subscribe push error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
