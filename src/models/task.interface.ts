// src/models/task.interface.ts

export interface Task {
    taskId: string;          // ID único para cada tarea
    title: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed';
    
    // Las referencias ahora son solo strings con los IDs
    project: string;         // Contendrá el projectId
    assignedTo?: string;    // Contendrá el userId
    
    dueDate?: string;       // Usaremos string en formato ISO
    createdAt: string;
    updatedAt: string;
  }