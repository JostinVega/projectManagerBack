// src/index.ts MODIFICADO Y LIMPIO DE MONGOOSE

import express from 'express';
import cors from 'cors';
// import mongoose from 'mongoose'; // ELIMINADO: Ya no se necesita Mongoose
import dotenv from 'dotenv';

// Rutas migradas a DynamoDB
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
// import notificationRoutes from './routes/notifications';
// import dashboardRoutes from './routes/dashboard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// --- Rutas funcionales con DynamoDB ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// --- Rutas comentadas temporalmente para evitar errores ---
// Estas rutas seguirán fallando hasta que migremos sus modelos y repositorios.
// Las activaremos una por una a medida que avancemos.
// -------------------------------------------------------------------
// app.use('/api/projects', projectRoutes);
// app.use('/api/tasks', taskRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/dashboard', dashboardRoutes);


app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});