// src/models/notification.interface.ts

export enum NotificationType {
  LOGIN_SUCCESS = 'login_success',
  LOGOUT_SUCCESS = 'logout_success', // If you decide to notify on logout
  PROFILE_UPDATED = 'profile_updated',
  AVATAR_UPLOADED = 'avatar_uploaded',
  AVATAR_DELETED = 'avatar_deleted',
  PASSWORD_UPDATED = 'password_updated',
  PROJECT_CREATED = 'project_created',
  TASK_CREATED = 'task_created',
  // Add existing types you might have, e.g.:
  TASK_ASSIGNED = 'task_assigned',
  TASK_UPDATED = 'task_updated',
  TASK_COMPLETED = 'task_completed',
  PROJECT_INVITATION = 'project_invitation',
  PROJECT_UPDATED = 'project_updated',
  // ... other types
}

export interface Notification {
  notificationId: string; // ID único para cada notificación
  userId: string;         // A qué usuario pertenece. Será nuestra Partition Key.
  message: string;
  type: NotificationType; // <-- NEW: Type of notification
  read: boolean;

  createdAt: string;      // Fecha de creación. Será nuestra Sort Key.
  updatedAt: string;
  // Optional fields for context (e.g., if a notification is about a specific task/project)
  // taskId?: string;
  // projectId?: string;
}

// You also mentioned NotificationSettings in user.interface.ts,
// let's define it here if it's not in its own file yet.
export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
}