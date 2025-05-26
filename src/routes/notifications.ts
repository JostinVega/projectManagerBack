import { Router, Request, Response } from 'express';
import Notification from '../models/Notification';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Obtener notificaciones del usuario autenticado
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const notifications = await Notification.find({ user: userId });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener notificaciones' });
  }
});

// Marcar notificación como leída
router.put('/:id/read', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Notificación no encontrada' });

    // Solo el dueño puede marcarla
    if (notification.user.toString() !== req.user?.userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    notification.read = true;
    await notification.save();
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificación' });
  }
});

// Marcar todas las notificaciones como leídas
router.put('/read-all', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    await Notification.updateMany({ user: userId, read: false }, { read: true });
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar notificaciones' });
  }
});

export default router;
