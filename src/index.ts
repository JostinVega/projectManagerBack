// src/index.ts MODIFICADO Y LIMPIO DE MONGOOSE

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GetCommand } from '@aws-sdk/lib-dynamodb'; // <-- AÑADE ESTA LÍNEA

// Rutas migradas a DynamoDB
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import notificationRoutes from './routes/notifications';
import dashboardRoutes from './routes/dashboard';

import { ddbDocClient } from './config/dynamodb';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Configurar CORS
app.use(cors({
  origin: [
    'http://localhost:4200',
    'http://localhost:3000',
    'https://tu-dominio-frontend.com' 
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Rutas funcionales con DynamoDB ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Puedes añadir una pequeña prueba a DynamoDB para asegurarte de que la conexión funciona
  ddbDocClient.send(new GetCommand({ TableName: 'Users', Key: { userId: 'nonExistent' } }))
    .then(() => console.log('DynamoDB connection successful.'))
    .catch((error) => console.error('DynamoDB connection error:', error));
});