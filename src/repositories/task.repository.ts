// src/repositories/task.repository.ts
import { 
    PutCommand, 
    QueryCommand, 
    UpdateCommand, 
    DeleteCommand,
    ScanCommand 
  } from '@aws-sdk/lib-dynamodb';
  import { ddbDocClient } from '../config/dynamodb';
  import { Task } from '../models/task.interface';
  import { randomUUID } from 'crypto';
  
  const PROJECTS_TABLE = 'Projects'; // Seguimos usando la misma tabla
  const ASSIGNED_TASKS_INDEX = 'AssignedTasksIndex';
  
  /**
   * Crea una nueva tarea dentro de un proyecto específico.
   */
  export const createTaskInProject = async (
    taskData: Omit<Task, 'taskId' | 'createdAt' | 'updatedAt'>
  ): Promise<Task> => {
    const taskId = randomUUID();
    const now = new Date().toISOString();
  
    const newTask: Task = {
      ...taskData,
      taskId,
      createdAt: now,
      updatedAt: now,
    };
  
    const params = {
      TableName: PROJECTS_TABLE,
      Item: {
        PK: `PROJ#${newTask.project}`, // El "pasillo" del proyecto
        SK: `TASK#${taskId}`,          // El "libro" de la tarea
        ...newTask // El resto de los datos de la tarea (title, status, assignedTo, etc.)
      },
    };
  
    try {
      await ddbDocClient.send(new PutCommand(params));
      return newTask;
    } catch (error) {
      console.error('Error al crear la tarea:', error);
      throw new Error('No se pudo crear la tarea');
    }
  };
  
  /**
   * Obtiene todas las tareas de un proyecto específico.
   */
  export const getTasksByProjectId = async (projectId: string): Promise<Task[]> => {
    const params = {
      TableName: PROJECTS_TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `PROJ#${projectId}`,
        ':sk': 'TASK#', // Le decimos "dame todos los items cuya SK empiece con TASK#"
      },
    };
  
    try {
      const { Items } = await ddbDocClient.send(new QueryCommand(params));
      return Items as Task[];
    } catch (error) {
      console.error('Error al obtener tareas por proyecto:', error);
      throw new Error('Error al obtener las tareas del proyecto');
    }
  };
  
  /**
   * Obtiene todas las tareas asignadas a un usuario específico, usando el GSI.
   */
  export const getTasksByAssignedUser = async (userId: string): Promise<Task[]> => {
    const params = {
      TableName: PROJECTS_TABLE,
      IndexName: ASSIGNED_TASKS_INDEX, // ¡Importante! Usamos nuestro nuevo índice
      KeyConditionExpression: 'assignedTo = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    };
  
    try {
      const { Items } = await ddbDocClient.send(new QueryCommand(params));
      return Items as Task[];
    } catch (error) {
      console.error('Error al obtener tareas por usuario asignado:', error);
      throw new Error('Error al obtener las tareas del usuario');
    }
  };
  
  /**
   * Actualiza los datos de una tarea específica.
   */
  export const updateTask = async (projectId: string, taskId: string, updateData: Partial<Task>): Promise<any> => {
    updateData.updatedAt = new Date().toISOString();
    
    const allowedToUpdate = ['title', 'description', 'status', 'assignedTo', 'dueDate'];
    const updatePayload: any = { updatedAt: updateData.updatedAt };
  
    for (const field of allowedToUpdate) {
        if ((updateData as any)[field] !== undefined) {
            updatePayload[field] = (updateData as any)[field];
        }
    }
  
    const keys = Object.keys(updatePayload);
    if (keys.length <= 1) return;
  
    const UpdateExpression = 'set ' + keys.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = keys.reduce((acc, k) => ({ ...acc, [`#${k}`]: k }), {});
    const ExpressionAttributeValues = keys.reduce((acc, k) => ({ ...acc, [`:${k}`]: updatePayload[k] }), {});
  
    const params = {
      TableName: PROJECTS_TABLE,
      Key: {
        PK: `PROJ#${projectId}`,
        SK: `TASK#${taskId}`,
      },
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    } as const;
  
    const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
    return Attributes;
  };
  
  /**
   * Elimina una tarea específica.
   */
  export const deleteTask = async (projectId: string, taskId: string): Promise<void> => {
    const params = {
      TableName: PROJECTS_TABLE,
      Key: {
        PK: `PROJ#${projectId}`,
        SK: `TASK#${taskId}`,
      },
    };
  
    try {
      await ddbDocClient.send(new DeleteCommand(params));
    } catch (error) {
      console.error('Error al eliminar la tarea:', error);
      throw new Error('No se pudo eliminar la tarea');
    }
  };

/**
 * ADVERTENCIA: FUNCIÓN INEFFICIENTE.
 * Busca una tarea por su ID escaneando la tabla.
 * En producción, esto debería ser reemplazado por un GSI.
 * @param taskId - El ID de la tarea a buscar.
 * @returns La tarea encontrada, o null.
 */
export const findTaskById = async (taskId: string): Promise<Task | null> => {
    const params = {
      TableName: PROJECTS_TABLE,
      FilterExpression: 'taskId = :taskId',
      ExpressionAttributeValues: {
        ':taskId': taskId,
      },
    };
  
    try {
      // Un Scan lee toda la tabla, por eso es ineficiente en tablas grandes.
      const { Items } = await ddbDocClient.send(new ScanCommand(params));
      return Items && Items.length > 0 ? (Items[0] as Task) : null;
    } catch (error) {
      console.error(`Error al buscar la tarea ${taskId}:`, error);
      throw new Error('Error al encontrar la tarea');
    }
  };