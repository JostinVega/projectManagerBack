import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// Obtener todos los usuarios (solo admin)
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // No verificar rol aquí, solo que esté autenticado
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});


router.get('/search', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ message: 'Query inválida' });
    }

    // Permitir cualquier usuario autenticado (quitar verificación de rol)
    // if (req.user?.role !== 'admin') {
    //   return res.status(403).json({ message: 'Acceso denegado' });
    // }

    const regex = new RegExp(q.trim(), 'i');

    const users = await User.find({
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { username: regex }
      ]
    }).select('-password').limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error en búsqueda de usuarios' });
  }
});


// Obtener usuario por ID (solo admin o el mismo usuario)
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.userId !== req.params.id) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

// Actualizar usuario (solo admin o el mismo usuario)
router.put('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.userId !== req.params.id) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const updateData = { ...req.body };

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!updatedUser) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (solo admin)
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;
