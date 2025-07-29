// src/repositories/task.repository.ts (CÓDIGO 100% COMPLETO Y FINAL)

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

const PROJECTS_TABLE = 'Projects';
const ASSIGNED_TASKS_INDEX = 'AssignedTasksIndex';

export const createTaskInProject = async (taskData: Omit<Task, 'taskId' | 'createdAt' | 'updatedAt'>): Promise<Task> => {
  const taskId = randomUUID();
  const now = new Date().toISOString();
  const newTask: Task = { ...taskData, taskId, createdAt: now, updatedAt: now };

  const params = {
    TableName: PROJECTS_TABLE,
    Item: {
      PK: `PROJ#${newTask.project}`,
      SK: `TASK#${taskId}`,
      ...newTask
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

export const getTasksByProjectId = async (projectId: string): Promise<Task[]> => {
  const params = {
    TableName: PROJECTS_TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PROJ#${projectId}`,
      ':sk': 'TASK#',
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

export const getTasksByAssignedUser = async (userId: string): Promise<Task[]> => {
  const params = {
    TableName: PROJECTS_TABLE,
    IndexName: ASSIGNED_TASKS_INDEX,
    KeyConditionExpression: 'assignedTo = :userId',
    ExpressionAttributeValues: { ':userId': userId },
  };
  try {
    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    return Items as Task[];
  } catch (error) {
    console.error('Error al obtener tareas por usuario asignado:', error);
    throw new Error('Error al obtener las tareas del usuario');
  }
};

export const findTaskById = async (taskId: string): Promise<Task | null> => {
  const params = {
    TableName: PROJECTS_TABLE,
    FilterExpression: 'taskId = :taskId',
    ExpressionAttributeValues: { ':taskId': taskId },
  };
  try {
    const { Items } = await ddbDocClient.send(new ScanCommand(params));
    return Items && Items.length > 0 ? (Items[0] as Task) : null;
  } catch (error) {
    console.error(`Error al escanear en busca de la tarea ${taskId}:`, error);
    throw new Error('Error al encontrar la tarea');
  }
};

export const updateTask = async (projectId: string, taskId: string, updateData: Partial<Task>): Promise<any> => {
  updateData.updatedAt = new Date().toISOString();
  const allowedToUpdate = ['title', 'description', 'status', 'assignedTo', 'dueDate', 'priority'];
  const updatePayload: any = { updatedAt: updateData.updatedAt };
  for (const field of allowedToUpdate) {
    if ((updateData as any)[field] !== undefined) {
      updatePayload[field] = (updateData as any)[field];
    }
  }
  const keys = Object.keys(updatePayload);
  if (keys.length <= 1) { return findTaskById(taskId); }
  const UpdateExpression = 'set ' + keys.map(k => `#${k} = :${k}`).join(', ');
  const ExpressionAttributeNames = keys.reduce((acc, k) => ({ ...acc, [`#${k}`]: k }), {});
  const ExpressionAttributeValues = keys.reduce((acc, k) => ({ ...acc, [`:${k}`]: updatePayload[k] }), {});
  const params = {
    TableName: PROJECTS_TABLE,
    Key: { PK: `PROJ#${projectId}`, SK: `TASK#${taskId}` },
    UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  } as const;
  const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
  return Attributes;
};

export const deleteTask = async (projectId: string, taskId: string): Promise<void> => {
  const params = {
    TableName: PROJECTS_TABLE,
    Key: { PK: `PROJ#${projectId}`, SK: `TASK#${taskId}` },
  };
  try {
    await ddbDocClient.send(new DeleteCommand(params));
  } catch (error) {
    console.error('Error al eliminar la tarea:', error);
    throw new Error('No se pudo eliminar la tarea');
  }
};