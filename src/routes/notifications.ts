// routes/notifications.ts (MODIFICADO PARA DYNAMODB)

import { Router, Response } from 'express';
import * as NotificationRepository from '../repositories/notification.repository';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { Notification } from '../models/notification.interface';

const router = Router();

// --- Función de Ayuda para Mapear Datos al Frontend ---
const toPublicNotification = (notification: Notification) => ({
  ...notification,
  _id: notification.notificationId,
  id: notification.notificationId,
  user: notification.userId,
});

// Obtener notificaciones del usuario autenticado
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const notifications = await NotificationRepository.getNotificationsByUserId(userId);
    // Mapeamos la respuesta para que el frontend no tenga que cambiar
    res.json(notifications.map(toPublicNotification));
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener notificaciones' });
  }
});

// Marcar notificación como leída
router.put('/:id/read', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // Usamos nuestra nueva función de búsqueda por ID
    const notification = await NotificationRepository.findNotificationById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notificación no encontrada' });

    if (notification.userId !== req.user?.userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Usamos la función del repo para marcar como leída
    const updatedNotification = await NotificationRepository.markNotificationAsRead(notification.userId, notification.createdAt);
    res.json(toPublicNotification(updatedNotification));
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificación' });
  }
});

// Marcar todas las notificaciones como leídas
router.put('/read-all', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    // La complejidad ahora está oculta dentro del repositorio
    await NotificationRepository.markAllNotificationsAsRead(userId);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificaciones' });
  }
});

export default router;