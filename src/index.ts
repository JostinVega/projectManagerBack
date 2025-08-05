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

// 🖥️ OBTENER INFORMACIÓN DE LA INSTANCIA
const getInstanceInfo = () => {
  const hostname = require('os').hostname();
  const networkInterfaces = require('os').networkInterfaces();
  
  // Buscar IP privada (10.0.x.x)
  let privateIP = 'unknown';
  for (const [name, addresses] of Object.entries(networkInterfaces)) {
    if (addresses) {
      for (const addr of addresses as any[]) {
        if (addr.family === 'IPv4' && addr.address.startsWith('10.0.')) {
          privateIP = addr.address;
          break;
        }
      }
    }
  }
  
  return { hostname, privateIP, pid: process.pid };
};

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

// 🔧 MIDDLEWARE MEJORADO PARA LOGGING EFS
app.use(async (req, res, next) => {
  try {
    const instanceInfo = getInstanceInfo();
    const timestamp = new Date().toISOString();
    const logMessage = `[${instanceInfo.privateIP}:${instanceInfo.pid}] ${req.method} ${req.path} - IP: ${req.ip} - UserAgent: ${req.get('User-Agent')?.slice(0, 50) || 'unknown'}`;
    
    // Escribir en EFS
    await efsHelper.appendLog('api-requests', logMessage);
    
    // También log local para debugging
    console.log(`📝 [EFS-LOG] ${logMessage}`);
    
  } catch (error) {
    console.error('❌ Error writing to EFS log:', error);
    // Continuar aunque falle el log
  }
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

// 📊 ENDPOINT PARA VER INFO DE INSTANCIAS ACTIVAS
app.get('/api/system/instances', async (req, res) => {
  try {
    const instanceInfo = getInstanceInfo();
    
    // Obtener logs recientes para ver qué instancias están activas
    const recentLogs = await efsHelper.readLog('api-requests', 100);
    
    // Extraer IPs de instancias de los logs
    const instancePattern = /\[(\d+\.\d+\.\d+\.\d+):(\d+)\]/;
    const activeInstances = new Map();
    
    recentLogs.forEach(log => {
      const match = log.match(instancePattern);
      if (match) {
        const [, ip, pid] = match;
        const timestamp = log.match(/\[(.*?)\]/)?.[1] || '';
        activeInstances.set(ip, {
          ip,
          pid,
          lastSeen: timestamp,
          isCurrentInstance: ip === instanceInfo.privateIP
        });
      }
    });
    
    res.json({
      currentInstance: instanceInfo,
      activeInstances: Array.from(activeInstances.values()),
      totalInstances: activeInstances.size
    });
  } catch (error) {
    res.status(500).json({ error: 'Error getting instance info' });
  }
});

// 📋 ENDPOINT PARA VER LOGS ESPECÍFICOS
app.get('/api/system/logs/:logName', async (req, res) => {
  try {
    const { logName } = req.params;
    const lines = parseInt(req.query.lines as string) || 100;
    
    const logs = await efsHelper.readLog(logName, lines);
    res.json({
      logName,
      lines: logs.length,
      logs: logs
    });
  } catch (error) {
    res.status(500).json({ error: 'Error reading logs' });
  }
});

// 📋 ENDPOINT PARA LISTAR TODOS LOS LOGS DISPONIBLES
app.get('/api/system/logs', async (req, res) => {
  try {
    const stats = await efsHelper.getEFSStats();
    if (!stats.mounted) {
      return res.json({ available: false, logs: [] });
    }

    // Listar archivos de logs
    const { promises: fs } = require('fs');
    const path = require('path');
    const logsDir = path.join(process.env.EFS_MOUNT_POINT || '/mnt/efs', 'logs');
    
    try {
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter((file: string) => file.endsWith('.log'));
      
      res.json({
        available: true,
        logs: logFiles.map((file: string) => file.replace('.log', '')),
        totalFiles: logFiles.length
      });
    } catch (err) {
      res.json({ available: true, logs: [], totalFiles: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error listing logs' });
  }
});

// 📋 ENDPOINT PARA VER LOGS EN TIEMPO REAL (DASHBOARD)
app.get('/api/system/dashboard/logs', async (req, res) => {
  try {
    const [apiLogs, errorLogs, systemLogs] = await Promise.all([
      efsHelper.readLog('api-requests', 50),
      efsHelper.readLog('errors', 20),
      efsHelper.readLog('system', 20)
    ]);

    res.json({
      recent: {
        'api-requests': apiLogs.slice(-10),
        'errors': errorLogs.slice(-5),
        'system': systemLogs.slice(-5)
      },
      summary: {
        totalApiRequests: apiLogs.length,
        totalErrors: errorLogs.length,
        totalSystemEvents: systemLogs.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error getting dashboard logs' });
  }
});

// 📋 ENDPOINT PARA LOGS FILTRADOS POR INSTANCIA
app.get('/api/system/logs/:logName/instance/:instanceIP', async (req, res) => {
  try {
    const { logName, instanceIP } = req.params;
    const lines = parseInt(req.query.lines as string) || 100;
    
    const allLogs = await efsHelper.readLog(logName, lines * 2); // Obtener más para filtrar
    const filteredLogs = allLogs.filter(log => log.includes(`[${instanceIP}:`));
    
    res.json({
      logName,
      instanceIP,
      lines: filteredLogs.length,
      logs: filteredLogs.slice(-lines) // Últimas N líneas de esa instancia
    });
  } catch (error) {
    res.status(500).json({ error: 'Error reading instance logs' });
  }
});

// 📥 ENDPOINT PARA DESCARGAR LOGS COMO ARCHIVO
app.get('/api/system/logs/:logName/download', async (req, res) => {
  try {
    const { logName } = req.params;
    const { promises: fs } = require('fs');
    const path = require('path');
    
    const logPath = path.join(process.env.EFS_MOUNT_POINT || '/mnt/efs', 'logs', `${logName}.log`);
    
    // Verificar que el archivo existe
    await fs.access(logPath);
    
    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${logName}-${new Date().toISOString().split('T')[0]}.log"`);
    res.setHeader('Content-Type', 'text/plain');
    
    // Leer y enviar el archivo
    const logContent = await fs.readFile(logPath, 'utf8');
    res.send(logContent);
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Log file not found' });
    } else {
      res.status(500).json({ error: 'Error downloading log file' });
    }
  }
});

// --- Rutas funcionales con DynamoDB ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Middleware de manejo de errores mejorado
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const instanceInfo = getInstanceInfo();
  
  console.error('❌ Error:', err.stack);
  
  // 📝 LOG DE ERRORES EN EFS con información de instancia
  const errorMessage = `[${instanceInfo.privateIP}:${instanceInfo.pid}] Error: ${err.message} - Stack: ${err.stack} - Path: ${req.path} - Method: ${req.method}`;
  efsHelper.appendLog('errors', errorMessage, 'ERROR').catch(logError => {
    console.error('Failed to write error to EFS log:', logError);
  });
  
  res.status(500).json({ 
    error: 'Something broke!',
    instance: instanceInfo.privateIP,
    timestamp: new Date().toISOString()
  });
});

// Iniciar el servidor
app.listen(PORT, async () => {
  const instanceInfo = getInstanceInfo();
  
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🖥️ Instance: ${instanceInfo.hostname} (${instanceInfo.privateIP}:${instanceInfo.pid})`);
  
  try {
    // Verificar DynamoDB
    await ddbDocClient.send(new GetCommand({ TableName: 'Users', Key: { userId: 'nonExistent' } }));
    console.log('✅ DynamoDB connection successful.');
    
    // Verificar EFS y registrar inicio de instancia
    const efsStats = await efsHelper.getEFSStats();
    if (efsStats.mounted) {
      console.log('✅ EFS mounted successfully.');
      
      // ESCRIBIR LOGS DE INICIO EN EFS
      await efsHelper.appendLog('system', `[${instanceInfo.privateIP}:${instanceInfo.pid}] Server started successfully with EFS - ${instanceInfo.hostname}`);
      await efsHelper.appendLog('instances', `[${instanceInfo.privateIP}:${instanceInfo.pid}] Instance started - ${instanceInfo.hostname} - PID: ${instanceInfo.pid}`);
      
      console.log(`📝 Logs will be written to EFS from instance ${instanceInfo.privateIP}:${instanceInfo.pid}`);
      console.log(`🔗 Monitor logs at: /api/system/logs`);
      console.log(`📊 View stats at: /api/system/efs-stats`);
      console.log(`🖥️ Instance info at: /api/system/instances`);
      
    } else {
      console.log('⚠️ EFS not mounted - running without shared storage');
      console.log('📁 Cache and temp files will use local storage');
    }
    
  } catch (error: any) {
    console.error('❌ Startup error:', error);
    await efsHelper.appendLog('system', `[${instanceInfo.privateIP}:${instanceInfo.pid}] Startup error: ${error.message}`, 'ERROR');
  }
});