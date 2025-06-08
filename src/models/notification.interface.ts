// src/models/notification.interface.ts

export interface Notification {
  notificationId: string; // ID único para cada notificación
  userId: string;         // A qué usuario pertenece. Será nuestra Partition Key.
  message: string;
  read: boolean;
  
  createdAt: string;      // Fecha de creación. Será nuestra Sort Key.
  updatedAt: string;
}