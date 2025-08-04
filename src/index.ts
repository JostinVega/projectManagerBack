// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

// 📁 IMPORTAR EFS HELPER
import efsHelper from './utils/efs-helper';

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
    'http://taskflow-frontend-app.s3-website-us-east-1.amazonaws.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔧 MIDDLEWARE PARA LOGGING EFS
app.use(async (req, res, next) => {
  await efsHelper.appendLog('api-requests', `${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// 📊 ENDPOINT PARA ESTADÍSTICAS EFS
app.get('/api/system/efs-stats', async (req, res) => {
  try {
    const stats = await efsHelper.getEFSStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error getting EFS stats' });
  }
});

// --- Rutas funcionales con DynamoDB ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  // 📝 LOG DE ERRORES EN EFS
  efsHelper.appendLog('errors', `Error: ${err.message} - Stack: ${err.stack}`, 'ERROR');
  res.status(500).send('Something broke!');
});

// Iniciar el servidor
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // 🔍 VERIFICAR CONEXIONES
  try {
    // Verificar DynamoDB
    await ddbDocClient.send(new GetCommand({ TableName: 'Users', Key: { userId: 'nonExistent' } }));
    console.log('✅ DynamoDB connection successful.');
    
    // Verificar EFS
    const efsStats = await efsHelper.getEFSStats();
    if (efsStats.mounted) {
      console.log('✅ EFS mounted successfully.');
      await efsHelper.appendLog('system', 'Server started successfully with EFS');
    } else {
      console.log('⚠️ EFS not mounted - running without shared storage');
      console.log('📁 Cache and temp files will use local storage');
    }
    
  } catch (error: any) {
    console.error('❌ Startup error:', error);
    await efsHelper.appendLog('system', `Startup error: ${error.message}`, 'ERROR');
  }
});