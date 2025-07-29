// src/routes/auth.ts

import { Router, Request, Response } from 'express';
import * as UserRepository from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, JwtPayload, NotificationSettings, RegisterBody, LoginBody } from '../models/user.interface';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { upload, s3Client, S3_BUCKET_NAME } from '../config/s3';
import * as NotificationRepository from '../repositories/notification.repository';
import { NotificationType } from '../models/notification.interface';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET as string;

// Ruta de Registro
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, email, password, role }: RegisterBody = req.body;

    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ message: 'Faltan campos obligatorios para el registro.' });
    }

    const existingUserEmail = await UserRepository.getUserByEmail(email);
    if (existingUserEmail) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }

    const existingUserName = await UserRepository.getUserByUsername(username);
    if (existingUserName) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserRepository.createUser({
      firstName,
      lastName,
      username,
      email,
      passwordHash: hashedPassword,
      role: role || 'member',
      // createdAt y updatedAt se añaden en el repositorio
      // notificationSettings se añade en el repositorio si no se proporciona
    });

    const token = jwt.sign(
      { userId: newUser.userId, email: newUser.email, role: newUser.role } as JwtPayload,
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        userId: newUser.userId,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        avatar: newUser.avatar,
        notificationSettings: newUser.notificationSettings,
      }
    });

    try {
      await NotificationRepository.createNotification({
        userId: newUser.userId,
        message: `¡Bienvenido, ${newUser.firstName}! Tu cuenta ha sido creada exitosamente.`,
        type: NotificationType.LOGIN_SUCCESS,
      });
    } catch (notificationError) {
      console.error('Error al enviar notificación de registro:', notificationError);
    }

  } catch (error) {
    console.error('Error en /register:', error);
    res.status(500).json({ message: 'Error interno del servidor al registrar el usuario.' });
  }
});

// Ruta de Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginBody = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan campos obligatorios: email y password.' });
    }

    const user = await UserRepository.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Credenciales incorrectas.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales incorrectas.' });
    }

    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role } as JwtPayload,
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    try {
      await NotificationRepository.createNotification({
        userId: user.userId,
        message: `Has iniciado sesión exitosamente.`,
        type: NotificationType.LOGIN_SUCCESS,
      });
    } catch (notificationError) {
      console.error('Error al enviar notificación de login:', notificationError);
    }

    res.json({
      token,
      user: {
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        notificationSettings: user.notificationSettings,
      }
    });

  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ message: 'Error interno del servidor al iniciar sesión.' });
  }
});


// Endpoint para obtener el perfil del usuario (GET /auth/profile)
router.get('/profile', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario no encontrado en el token.' });
    }

    const user = await UserRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const { passwordHash, ...profile } = user;
    res.status(200).json(profile);
  } catch (error) {
    console.error('Error al obtener el perfil del usuario:', error);
    res.status(500).json({ message: 'Error interno del servidor al obtener el perfil.' });
  }
});

// Endpoint para actualizar el perfil del usuario (PUT /auth/profile)
router.put('/profile', authenticateJWT, upload.single('avatar'), async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(400).json({ message: 'ID de usuario no encontrado en el token.' });
        }

        const updates: Partial<User> = req.body;
        let user = await UserRepository.getUserById(userId);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Manejo del avatar
        if (req.file) {
            if (user.avatar) {
                const oldAvatarKey = user.avatar.split('.com/')[1];
                if (oldAvatarKey) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldAvatarKey }));
                        console.log(`Antiguo avatar ${oldAvatarKey} eliminado de S3.`);
                    } catch (deleteError) {
                        console.warn(`No se pudo eliminar el antiguo avatar ${oldAvatarKey} de S3:`, deleteError);
                    }
                }
            }
            updates.avatar = (req.file as Express.MulterS3.File).location;
        } else if ('avatar' in req.body && req.body.avatar === null) {
            if (user.avatar) {
                const oldAvatarKey = user.avatar.split('.com/')[1];
                if (oldAvatarKey) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: oldAvatarKey }));
                        console.log(`Avatar ${oldAvatarKey} eliminado de S3 por solicitud explícita de nulidad.`);
                    } catch (deleteError) {
                        console.warn(`No se pudo eliminar el avatar ${oldAvatarKey} de S3:`, deleteError);
                    }
                }
            }
            updates.avatar = undefined;
        }

        const updatedUserResult = await UserRepository.updateUser(userId, updates);

        if (!updatedUserResult) {
            return res.status(500).json({ message: 'Error al actualizar el usuario en la base de datos.' });
        }

        const { passwordHash, ...profile } = updatedUserResult;
        res.status(200).json({ message: 'Perfil actualizado exitosamente.', user: profile });

        try {
            await NotificationRepository.createNotification({
                userId: userId,
                message: `Tu perfil ha sido actualizado.`,
                type: NotificationType.PROFILE_UPDATED,
            });
        } catch (notificationError) {
            console.error('Error al enviar notificación de perfil actualizado:', notificationError);
        }

    } catch (error: any) {
        console.error('Error al actualizar el perfil:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'El tamaño del archivo es demasiado grande. Máximo 5MB.' });
        }
        if (error.message && error.message.includes('Solo se permiten imágenes')) {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error al actualizar el perfil.', error: error.message });
    }
});

// Endpoint para cambiar contraseña (PUT /auth/change-password)
router.put('/change-password', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario no encontrado en el token.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Se requiere la contraseña actual y la nueva contraseña.' });
    }

    const user = await UserRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await UserRepository.updateUser(userId, { passwordHash: hashedNewPassword, updatedAt: new Date().toISOString() });

    res.status(200).json({ message: 'Contraseña cambiada exitosamente.' });

    try {
        await NotificationRepository.createNotification({
            userId: userId,
            message: `Tu contraseña ha sido actualizada.`,
            type: NotificationType.PASSWORD_UPDATED,
        });
    } catch (notificationError) {
        console.error('Error al enviar notificación de contraseña actualizada:', notificationError);
    }

  } catch (error) {
    console.error('Error al cambiar la contraseña:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint para actualizar configuraciones de notificación (PUT /auth/notification-settings)
router.put('/notification-settings', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario no encontrado en el token.' });
    }

    const { emailNotifications, pushNotifications, weeklyDigest } = req.body;

    const updates: Partial<User> = {
      notificationSettings: {
        emailNotifications: emailNotifications,
        pushNotifications: pushNotifications,
        weeklyDigest: weeklyDigest,
      } as NotificationSettings,
      updatedAt: new Date().toISOString(),
    };

    await UserRepository.updateUser(userId, updates);
    res.status(200).json({ message: 'Configuración de notificaciones actualizada exitosamente.' });
  } catch (error) {
    console.error('Error al actualizar la configuración de notificaciones:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

// Endpoint para eliminar la cuenta del usuario (DELETE /auth/account)
router.delete('/account', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario no encontrado en el token.' });
    }

    const user = await UserRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    // Eliminar el avatar de S3 si existe
    if (user.avatar) {
      const avatarKey = user.avatar.split('.com/')[1];
      if (avatarKey) {
        try {
          await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: avatarKey }));
          console.log(`Avatar ${avatarKey} eliminado de S3 al eliminar la cuenta.`);
        } catch (deleteError) {
          console.warn(`No se pudo eliminar el avatar ${avatarKey} de S3 al eliminar la cuenta:`, deleteError);
        }
      }
    }

    await UserRepository.deleteUserById(userId);

    res.status(200).json({ message: 'Cuenta eliminada exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar la cuenta:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

export default router;
