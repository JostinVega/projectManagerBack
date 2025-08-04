// src/models/user.interface.ts (ACTUALIZADO Y CORREGIDO FINAL)

// Define la interfaz para la configuración de notificaciones
export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
}

// Interfaz para el payload del token JWT
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
}

// Define la interfaz principal para el usuario
export interface User {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  bio?: string;
  phone?: string;
  avatar?: string;
  role: 'admin' | 'member' | 'guest';
  createdAt: string;
  updatedAt: string;
  notificationSettings?: NotificationSettings;
}


// Interfaz para el cuerpo de la solicitud de registro
export interface RegisterBody {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  role?: 'admin' | 'member' | 'guest';
}

// Interfaz para el cuerpo de la solicitud de login
export interface LoginBody {
  email: string;
  password: string;
}

// Interfaz para las actualizaciones de usuario (parcial)
export type UserUpdates = Partial<Omit<User, 'userId' | 'createdAt' | 'updatedAt'>>;
