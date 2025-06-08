// routes/auth.ts MODIFICADO PARA DYNAMODB

import { Router, Request, Response } from 'express';
// import User from '../models/User'; // YA NO USAMOS MONGOOSE
import * as UserRepository from '../repositories/user.repository'; // USAMOS NUESTRO REPOSITORIO
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.interface'; // Importamos la interfaz para tipado

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, username, email, password } = req.body;

    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // Verificamos si ya existe el email o el username usando nuestro repositorio
    const existingUserEmail = await UserRepository.getUserByEmail(email);
    if (existingUserEmail) {
      return res.status(400).json({ message: 'Correo electrónico ya registrado' });
    }

    const existingUserName = await UserRepository.getUserByUsername(username);
    if (existingUserName) {
      return res.status(400).json({ message: 'Nombre de usuario ya registrado' });
    }

    // La lógica de hashear la contraseña no cambia
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Creamos el usuario llamando a la función del repositorio
    const newUser = await UserRepository.createUser({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      role: 'user' // Por defecto, o puedes tomarlo del req.body si es necesario
    });

    // Generar token JWT. MUY IMPORTANTE: Usamos newUser.userId (el de DynamoDB)
    const token = jwt.sign(
      { userId: newUser.userId, role: newUser.role }, // Usamos el nuevo userId
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    // Responder con token y usuario
    res.status(201).json({
      token,
      user: {
        id: newUser.userId, // Enviamos el nuevo userId
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Error en /register:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    // Buscamos al usuario por email con nuestro repositorio
    const user = await UserRepository.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ message: 'Credenciales incorrectas' }); // Mensaje genérico por seguridad
    }

    // La lógica de comparar contraseñas no cambia
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales incorrectas' }); // Mensaje genérico por seguridad
    }

    // Generar token JWT. MUY IMPORTANTE: Usamos user.userId
    const token = jwt.sign(
      { userId: user.userId, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    // Responder con token y usuario
    res.json({
      token,
      user: {
        id: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

export default router;