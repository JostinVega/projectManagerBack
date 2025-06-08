// routes/projects.ts (VERSIÓN FINALÍSIMA CON TRANSFORMACIÓN COMPLETA)

import { Router, Response } from 'express';
import * as ProjectRepository from '../repositories/project.repository';
import * as UserRepository from '../repositories/user.repository';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { Project } from '../models/project.interface';
import { User } from '../models/user.interface';

const router = Router();

// --- Función de Ayuda para transformar los datos ---
// --- VERSIÓN CORREGIDA: AHORA INCLUYE TODOS LOS CAMPOS ---
const toPublicProject = (project: Project, members: Partial<User>[] = []) => {
  const projectMembers = members.length > 0 ? members : project.members;
  return {
    _id: project.projectId,
    id: project.projectId,
    name: project.name,
    description: project.description,
    createdBy: project.createdBy,
    members: projectMembers,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    // --- CAMPOS AÑADIDOS A LA TRANSFORMACIÓN ---
    status: project.status,
    priority: project.priority,
    dueDate: project.dueDate,
  };
};


// Obtener todos los proyectos donde el usuario es miembro
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const projectLinks = await ProjectRepository.getProjectsByUserId(userId);
    const projectIds = projectLinks.map(p => p.projectId);

    if (projectIds.length === 0) { return res.json([]); }

    const projectsPromises = projectIds.map(id => ProjectRepository.getProjectDetailsById(id));
    let projectsDetails = (await Promise.all(projectsPromises)).filter(p => p !== null) as Project[];
    
    // Usamos el transformador en cada proyecto de la lista
    const publicProjects = projectsDetails.map(p => toPublicProject(p));
    res.json(publicProjects);

  } catch (error) { 
    console.error('ERROR DETALLADO en GET /:', error);
    res.status(500).json({ message: 'Error al obtener proyectos' }); 
  }
});

// Crear proyecto
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, description, members = [], status, priority, dueDate } = req.body;
    const newProject = await ProjectRepository.createProject({
      name, description, createdBy: userId, members: [...new Set([userId, ...members])],
      status, priority, dueDate
    });
    res.status(201).json(toPublicProject(newProject));
  } catch (error) { 
    console.error('ERROR DETALLADO en POST /:', error);
    res.status(500).json({ message: 'Error al crear proyecto' }); 
  }
});

// Obtener proyecto por ID
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        const project = await ProjectRepository.getProjectDetailsById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

        const isMember = project.members.includes(req.user!.userId);
        if (!isMember && req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        const membersData = await UserRepository.getUsersByIds(project.members);
        membersData.forEach(m => delete (m as any).password);
        
        res.json(toPublicProject(project, membersData));
    } catch (error) { 
      console.error('ERROR DETALLADO en GET /:id :', error);
      res.status(500).json({ message: 'Error al obtener proyecto' }); 
    }
});

// Actualizar proyecto
router.put('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        let project = await ProjectRepository.getProjectDetailsById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });

        if (req.user?.role !== 'admin' && project.createdBy !== req.user!.userId) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        await ProjectRepository.updateProjectDetails(req.params.id, req.body);
        const updatedProject = await ProjectRepository.getProjectDetailsById(req.params.id);
        res.json(toPublicProject(updatedProject!));

    } catch (error) { 
      console.error('ERROR DETALLADO en PUT /:id :', error);
      res.status(500).json({ message: 'Error al actualizar proyecto' }); 
    }
});

// Eliminar proyecto (dejamos la lógica como estaba)
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        const project = await ProjectRepository.getProjectDetailsById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Proyecto no encontrado' });
        if (req.user?.role !== 'admin' && project.createdBy !== req.user!.userId) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        await ProjectRepository.deleteProjectById(req.params.id);
        res.json({ message: 'Proyecto eliminado' });
    } catch (error) { 
        console.error('ERROR DETALLADO en DELETE /:id :', error);
        res.status(500).json({ message: 'Error al eliminar proyecto' }); 
    }
});

// Obtener los miembros de un proyecto específico
router.get('/:id/members', authenticateJWT, async (req: AuthRequest, res: Response) => {
    try {
        // 1. Buscamos el proyecto para obtener su lista de IDs de miembros
        const project = await ProjectRepository.getProjectDetailsById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // 2. Autorización: solo los miembros actuales pueden ver la lista de miembros
        if (!project.members.includes(req.user!.userId) && req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Acceso denegado' });
        }

        // 3. Usamos la función que ya creamos en el repositorio de usuarios para buscar todos los miembros a la vez
        const membersData = await UserRepository.getUsersByIds(project.members);

        // 4. Ocultamos las contraseñas antes de enviar la respuesta
        membersData.forEach(m => delete (m as any).password);

        res.json(membersData);

    } catch (error) {
        console.error('ERROR DETALLADO en GET /:id/members :', error);
        res.status(500).json({ message: 'Error al obtener miembros del proyecto' });
    }
});

export default router;