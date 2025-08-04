// src/models/project.interface.ts (ACTUALIZADO)

export interface Project {
  projectId: string;
  name: string;
  description?: string;
  members: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  // --- NUEVOS CAMPOS AÑADIDOS ---
  status?: string;
  priority?: string;
  dueDate?: string; // O Date, pero string (ISO) es más seguro para JSON/DynamoDB
}
