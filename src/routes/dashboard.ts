import { Router, Request, Response } from 'express';
import Project from '../models/Project';
import Task from '../models/Task';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'No autorizado' });

    // Obtener proyectos donde el usuario es miembro
    const projects = await Project.find({ members: userId }).select('_id');

    const projectIds = projects.map(p => p._id);

    // Conteo de proyectos
    const totalProjects = projects.length;

    // Conteo de tareas totales
    const totalTasks = await Task.countDocuments({ project: { $in: projectIds } });

    // Conteo de tareas por estado
    const tasksByStatus = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Formatear estados
    const taskStatusCount = {
      pending: 0,
      in_progress: 0,
      completed: 0
    };
    tasksByStatus.forEach(item => {
      taskStatusCount[item._id] = item.count;
    });

    res.json({
      totalProjects,
      totalTasks,
      tasksByStatus: taskStatusCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

export default router;
