// routes/tasks.ts (VERSIÓN FINAL CON MAPEADO COMPLETO PARA FRONTEND)

import { Router, Response } from 'express';
import * as TaskRepository from '../repositories/task.repository';
import * as ProjectRepository from '../repositories/project.repository';
import * as UserRepository from '../repositories/user.repository';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { Task } from '../models/task.interface'; // Importamos nuestras interfaces internas
import * as NotificationRepository from '../repositories/notification.repository'; // <-- NUEVO
import { NotificationType } from '../models/notification.interface'; 

const router = Router();

// --- Función de Ayuda para transformar Tareas al formato público ---
const toPublicTask = (task: Task, projectDetails?: any) => {
    // Copiamos todos los campos de la tarea
    const publicTask: any = { ...task };

    // Renombramos/añadimos los campos de ID para ser compatibles con el frontend
    publicTask._id = task.taskId;
    publicTask.id = task.taskId;
    
    // Si nos pasan detalles del proyecto, "populamos" el campo 'project'
    if (projectDetails) {
        publicTask.project = {
            _id: projectDetails.projectId,
            id: projectDetails.projectId,
            name: projectDetails.name
        };
    }
    // Si no, 'task.project' ya contiene el string del ID, lo cual está bien.

    return publicTask;
};

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
    
    // Transformamos la respuesta
    res.status(201).json(toPublicTask(newTask));

    // Notificación: Tarea Creada para el creador
        try {
            await NotificationRepository.createNotification({
                userId: req.user!.userId,
                message: `Has creado la tarea: "${newTask.title}" en el proyecto "${project.name}".`,
                type: NotificationType.TASK_CREATED,
            });
        } catch (notificationError) {
            console.error('Error al enviar notificación de creación de tarea al creador:', notificationError);
        }
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
        const allTasks = tasksByProject.flat();

        const projectIdsFromTasks = [...new Set(allTasks.map(t => t.project))];
        const projectsData = await ProjectRepository.getProjectsByIds(projectIdsFromTasks);
        const projectsMap = new Map(projectsData.map(p => [p.projectId, p]));

        // Mapeamos la respuesta final, "poblando" los datos del proyecto
        const populatedTasks = allTasks.map(task => {
            const projectInfo = projectsMap.get(task.project);
            return toPublicTask(task, projectInfo);
        });

        res.json(populatedTasks);
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
        
        // Transformamos la tarea antes de enviarla
        res.json(toPublicTask(task, project));
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

        const updatedTaskData = await TaskRepository.updateTask(task.project, task.taskId, req.body);
        // La respuesta del update ya viene con los atributos, la transformamos también
        const publicUpdatedTask = { ...updatedTaskData, _id: task.taskId, id: task.taskId };
        res.json(publicUpdatedTask);

        // Notificación: Tarea Actualizada para el que la actualizó
        try {
            await NotificationRepository.createNotification({
                userId: req.user!.userId,
                message: `Has actualizado la tarea: "${updatedTaskData.title}" en el proyecto "${project.name}".`,
                type: NotificationType.TASK_UPDATED,
            });
        } catch (notificationError) {
            console.error('Error al enviar notificación de tarea actualizada al actualizador:', notificationError);
        }

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