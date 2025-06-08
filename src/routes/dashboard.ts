// routes/dashboard.ts (VERSIÓN FINAL PARA DYNAMODB)

import { Router, Response } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import * as ProjectRepository from '../repositories/project.repository';
import * as TaskRepository from '../repositories/task.repository';

const router = Router();

router.get('/stats', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // 1. Obtenemos todos los proyectos donde el usuario es miembro
    const projectLinks = await ProjectRepository.getProjectsByUserId(userId);
    const totalProjects = projectLinks.length;

    // Si el usuario no tiene proyectos, no tiene sentido seguir
    if (totalProjects === 0) {
      return res.json({
        totalProjects: 0,
        totalTasks: 0,
        tasksByStatus: { pending: 0, in_progress: 0, completed: 0 }
      });
    }

    const projectIds = projectLinks.map(p => p.projectId);

    // 2. Obtenemos TODAS las tareas de TODOS esos proyectos en paralelo
    const tasksPromises = projectIds.map(id => TaskRepository.getTasksByProjectId(id));
    const tasksByProject = await Promise.all(tasksPromises);
    const allTasks = tasksByProject.flat(); // Aplanamos el array de arrays en uno solo

    // 3. Ahora que tenemos los datos, calculamos las estadísticas en nuestro código
    const totalTasks = allTasks.length;

    // Usamos .reduce() para contar las tareas por estado de forma eficiente
    const tasksByStatus = allTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {
      pending: 0,
      in_progress: 0,
      completed: 0
    } as { [key: string]: number });


    // 4. Enviamos el objeto final con las estadísticas
    res.json({
      totalProjects,
      totalTasks,
      tasksByStatus
    });

  } catch (error) {
    console.error("Error obteniendo estadísticas del dashboard:", error);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

export default router;