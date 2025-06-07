// RUTA DE USUARIOS MODIFICADA PARA DYNAMODB

import { Router, Response } from 'express';
// Ya no importamos el modelo de Mongoose
// import User from '../models/User'; 
import * as UserRepository from '../repositories/user.repository'; // Importamos nuestro nuevo repositorio
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// -------------------------------------------------------------------------
// ADVERTENCIA: RUTA NO RECOMENDADA PARA PRODUCCIÓN CON DYNAMODB
// Obtener todos los usuarios (solo admin)
// -------------------------------------------------------------------------
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // La operación Scan en DynamoDB es ineficiente y puede ser costosa
    // si la tabla crece. Se mantiene aquí para replicar la funcionalidad,
    // pero en una app real, esto debería ser reemplazado por una consulta paginada.
    const users = await UserRepository.scanAllUsers();
    
    // Ocultamos las contraseñas manualmente
    users.forEach(user => delete (user as any).password);
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// -------------------------------------------------------------------------
// IMPORTANTE: FUNCIONALIDAD NO COMPATIBLE CON DYNAMODB
// La búsqueda con expresiones regulares no es posible de forma nativa.
// Esta funcionalidad requiere un servicio de búsqueda como OpenSearch o Algolia.
// -------------------------------------------------------------------------
/*
router.get('/search', authenticateJWT, async (req: AuthRequest, res: Response) => {
  // DynamoDB no soporta búsquedas por texto parcial o expresiones regulares
  // de manera eficiente. La forma correcta de implementar una búsqueda así
  // es usando DynamoDB Streams para enviar los datos a un servicio de búsqueda
  // dedicado como Amazon OpenSearch.
  //
  // Por esta razón, se comenta esta ruta.
  return res.status(501).json({ 
    message: 'Funcionalidad de búsqueda no implementada. Requiere un servicio de búsqueda externo.' 
  });
});
*/

// Obtener usuario por ID (Mapeo directo y eficiente)
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // La lógica de autorización no cambia
    if (req.user?.role !== 'admin' && req.user?.userId !== req.params.id) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const user = await UserRepository.getUserById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Ocultamos la contraseña antes de enviar la respuesta
    delete (user as any).password;
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
});

// Actualizar usuario (Mapeo directo y eficiente)
router.put('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.userId !== req.params.id) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const updateData = { ...req.body };

    // La lógica de hashear la contraseña no cambia
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    // Llamamos a nuestra nueva función del repositorio
    const updatedUser = await UserRepository.updateUser(req.params.id, updateData);

    // Ocultamos la contraseña
    delete (updatedUser as any).password;
    
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (Mapeo directo y eficiente)
router.delete('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    // Verificamos primero si el usuario existe para dar una respuesta 404 correcta
    const userExists = await UserRepository.getUserById(req.params.id);
    if (!userExists) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await UserRepository.deleteUserById(req.params.id);
    
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

export default router;