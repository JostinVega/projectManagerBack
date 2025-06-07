// src/models/user.interface.ts

export interface User {
  // --- Claves y Datos Principales ---
  userId: string;          // Nueva clave primaria para DynamoDB (Partition Key)
  email: string;           // Lo usaremos como clave de un índice (GSI)
  username: string;        // Lo usaremos como clave de otro índice (GSI)
  password: string;        // El hash de la contraseña
  
  // --- Atributos Adicionales ---
  firstName: string;
  lastName: string;
  role: 'user' | 'admin' | 'superadmin';
  avatar?: string;         // Atributo opcional

  // --- Timestamps ---
  createdAt: string;       // Fecha en formato string ISO 8601
  updatedAt: string;       // Fecha en formato string ISO 8601
}