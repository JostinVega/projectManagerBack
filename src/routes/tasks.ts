// routes/tasks.ts MODIFICADO PARA DYNAMODB

import { Router, Response } from 'express';
import * as TaskRepository from '../repositories/task.repository';
import * as ProjectRepository from '../repositories/project.repository';
import * as UserRepository from '../repositories/user.repository';
import { authenticateJWT, AuthRequest } from '../middleware/auth';

const router = Router();

// Crear una tarea
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, project: projectId, assignedTo, dueDate, status } = req.body;
    const userId = req.user!.userId;

    const project = await ProjectRepository.getProjectDetailsById(projectId);
    if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

    if (!project.members.includes(userId) && req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'No autorizado para agregar tareas a este proyecto' });
    }

    const newTask = await TaskRepository.createTaskInProject({
      title, description, project: projectId, assignedTo, dueDate, status
    });
    
    res.status(201).json(newTask);
  } catch (error) { res.status(500).json({ message: 'Error al crear tarea' }); }
});

// Obtener todas las tareas de los proyectos del usuario
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.userId;
        const projectLinks = await ProjectRepository.getProjectsByUserId(userId);
        if (projectLinks.length === 0) return res.json([]);

        const tasksPromises = projectLinks.map(link => TaskRepository.getTasksByProjectId(link.projectId));
        const tasksByProject = await Promise.all(tasksPromises);
        const allTasks = tasksByProject.flat(); // Aplanamos el array de arrays de tareas

        res.json(allTasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener tareas' });
    }
});

// Obtener una tarea por su ID
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        const task = await TaskRepository.findTaskById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

        const project = await ProjectRepository.getProjectDetailsById(task.project);
        if (!project || !project.members.includes(req.user!.userId)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener tarea' });
    }
});

// Actualizar una tarea
router.put('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        const task = await TaskRepository.findTaskById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });
        
        const project = await ProjectRepository.getProjectDetailsById(task.project);
        if (!project || !project.members.includes(req.user!.userId)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const updatedTask = await TaskRepository.updateTask(task.project, task.taskId, req.body);
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar tarea' });
    }
});

// Eliminar una tarea
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        const task = await TaskRepository.findTaskById(req.params.id);
        if (!task) return res.status(404).json({ message: 'Tarea no encontrada' });

        const project = await ProjectRepository.getProjectDetailsById(task.project);
        if (!project || !project.members.includes(req.user!.userId)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        
        await TaskRepository.deleteTask(task.project, task.taskId);
        res.json({ message: 'Tarea eliminada' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar tarea' });
    }
});

export default router;