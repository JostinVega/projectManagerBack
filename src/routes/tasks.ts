import { Router, Request, Response } from 'express';
import Task from '../models/Task';
import Project from '../models/Project';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Obtener todas las tareas (solo de proyectos donde es miembro)
// Obtener todas las tareas (solo de proyectos donde es miembro)
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    // Buscar proyectos donde es miembro
    const projects = await Project.find({ members: userId }).select('_id');
    const projectIds = projects.map(p => p._id);

    // Buscar tareas con populate de project y assignedTo
    const tasks = await Task.find({ project: { $in: projectIds } })
      .populate('project', '_id name')       // sólo _id y name del proyecto
      .populate('assignedTo', '_id firstName lastName') // datos mínimos del usuario
      .exec();

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener tareas' });
  }
});


// Obtener tarea por ID (solo si pertenece a proyecto donde es miembro)
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('project', '_id name')
      .populate('assignedTo', '_id firstName lastName');

    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    const userId = req.user?.userId;
    const project = await Project.findById(task.project._id);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const isMember = project.members.some(m => m.toString() === userId);
    if (!isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener tarea' });
  }
});

// Crear tarea (solo para proyectos donde es miembro)
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, project: projectId, assignedTo, dueDate, status } = req.body;
    const userId = req.user?.userId;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const isMember = project.members.some(m => m.toString() === userId);
    if (!isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado para agregar tareas a este proyecto' });
    }

    const newTask = new Task({
      title,
      description,
      project: projectId,
      assignedTo,
      dueDate,
      status
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear tarea' });
  }
});

// Actualizar tarea (solo si pertenece a proyecto donde es miembro)
router.put('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    const userId = req.user?.userId;
    const project = await Project.findById(task.project);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const isMember = project.members.some(m => m.toString() === userId);
    if (!isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const updateData = req.body;
    const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar tarea' });
  }
});

// Eliminar tarea (solo si pertenece a proyecto donde es miembro)
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

    const userId = req.user?.userId;
    const project = await Project.findById(task.project);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    const isMember = project.members.some(m => m.toString() === userId);
    if (!isMember && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Tarea eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar tarea' });
  }
});

export default router;
