import { Router, Request, Response } from 'express';
import Project from '../models/Project';
import User from '../models/User';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Obtener todos los proyectos (solo proyectos donde el usuario es miembro)
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'No autorizado' });

    // Obtener proyectos donde el usuario es miembro, poblando miembros sin passwords
    const projects = await Project.find({ members: userId }).populate('members', '-password');

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener proyectos' });
  }
});

// Obtener proyecto por ID (solo miembros o admin)
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id).populate('members', '-password');
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const userId = req.user?.userId;
    const isMember = project.members.some(m => m._id.toString() === userId);
    if (!isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener proyecto' });
  }
});

// Obtener miembros de un proyecto por ID (solo miembros o admin)
router.get('/:id/members', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const userId = req.user?.userId;
    const isMember = project.members.some(m => m.toString() === userId);
    if (!isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const members = await User.find({ _id: { $in: project.members } }).select('-password');
    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener miembros' });
  }
});

// Crear proyecto (cualquier usuario autenticado)
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'No autorizado' });

    const { name, description } = req.body;

    const newProject = new Project({
      name,
      description,
      createdBy: userId,
      members: [userId], // El creador es miembro por defecto
    });

    await newProject.save();
    res.status(201).json(newProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear proyecto' });
  }
});

// Actualizar proyecto (solo admin o creador)
router.put('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const userId = req.user?.userId;
    if (req.user?.role !== 'admin' && project.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Solo permitir actualizar ciertos campos
    const allowedFields = ['name', 'description', 'status', 'priority', 'dueDate'];
    const updateData: any = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('members', '-password');

    res.json(updatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar proyecto' });
  }
});

// Eliminar proyecto (solo admin o creador)
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const userId = req.user?.userId;
    if (req.user?.role !== 'admin' && project.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Proyecto eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar proyecto' });
  }
});

// Agregar miembro (solo admin o creador)
router.post('/:id/members', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const userId = req.user?.userId;
    if (req.user?.role !== 'admin' && project.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const { memberId } = req.body;
    if (!memberId) return res.status(400).json({ message: 'Debe enviar memberId' });

    const userToAdd = await User.findById(memberId);
    if (!userToAdd) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (project.members.some(m => m.toString() === memberId)) {
      return res.status(400).json({ message: 'Usuario ya es miembro' });
    }

    project.members.push(memberId);
    await project.save();

    const populatedProject = await project.populate('members', '-password');

    res.json(populatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al agregar miembro' });
  }
});

// Eliminar miembro (solo admin o creador)
router.delete('/:id/members/:memberId', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const userId = req.user?.userId;
    if (req.user?.role !== 'admin' && project.createdBy.toString() !== userId) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const memberId = req.params.memberId;

    if (memberId === project.createdBy.toString()) {
      return res.status(400).json({ message: 'No se puede eliminar al creador del proyecto' });
    }

    if (!project.members.some(m => m.toString() === memberId)) {
      return res.status(400).json({ message: 'Usuario no es miembro' });
    }

    project.members = project.members.filter(m => m.toString() !== memberId);
    await project.save();

    const populatedProject = await project.populate('members', '-password');

    res.json(populatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar miembro' });
  }
});

export default router;
