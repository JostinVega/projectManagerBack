// src/index.ts MODIFICADO Y LIMPIO DE MONGOOSE

import express from 'express';
import cors from 'cors';
// import mongoose from 'mongoose'; // ELIMINADO: Ya no se necesita Mongoose
import dotenv from 'dotenv';

// Rutas migradas a DynamoDB
import authRoutes from './routes/auth';
import userRoutes from './routes/users';

// Rutas que aún dependen de Mongoose (se migrarán después)
// import projectRoutes from './routes/projects';
// import taskRoutes from './routes/tasks';
// import notificationRoutes from './routes/notifications';
// import dashboardRoutes from './routes/dashboard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------------
// ELIMINADO: Bloque de conexión a MongoDB. Ya no es necesario.
// Nuestro cliente de DynamoDB se inicializa bajo demanda.
// -------------------------------------------------------------------
// mongoose.connect(process.env.MONGO_URI || '')
//   .then(() => console.log('MongoDB conectado'))
//   .catch(err => console.error('Error MongoDB:', err));


// --- Rutas funcionales con DynamoDB ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);


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