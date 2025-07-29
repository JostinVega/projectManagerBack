// src/repositories/project.repository.ts (VERSIÓN FINAL, COMPLETA Y CON TODOS LOS CAMPOS)

import { 
  TransactWriteCommand, 
  QueryCommand, 
  UpdateCommand, 
  PutCommand, 
  DeleteCommand,
  BatchGetCommand
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../config/dynamodb';
import { Project } from '../models/project.interface';
import { randomUUID } from 'crypto';

const PROJECTS_TABLE = 'Projects';
const USER_PROJECTS_INDEX = 'UserProjectsIndex';

// =================================================================
// --- FUNCIONES DE LECTURA (GET) ---
// =================================================================

export const getProjectDetailsById = async (projectId: string): Promise<Project | null> => {
  const params = { 
    TableName: PROJECTS_TABLE, 
    KeyConditionExpression: 'PK = :pk', 
    ExpressionAttributeValues: { ':pk': `PROJ#${projectId}` } 
  };
  const { Items } = await ddbDocClient.send(new QueryCommand(params));
  if (!Items || Items.length === 0) return null;

  const metadata = Items.find(item => item.SK === 'METADATA');
  if (!metadata) return null;

  const members = Items
    .filter(item => item.SK.startsWith('USER#'))
    .map(item => item.SK.split('#')[1]);
  
  return {
    projectId: metadata.PK.split('#')[1],
    name: metadata.name,
    description: metadata.description,
    createdBy: metadata.createdBy,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    members: members,
    // Devolvemos los nuevos campos
    status: metadata.status,
    priority: metadata.priority,
    dueDate: metadata.dueDate,
  };
};

export const getProjectsByUserId = async (userId: string): Promise<{ projectId: string }[]> => {
    const params = {
        TableName: PROJECTS_TABLE,
        IndexName: USER_PROJECTS_INDEX,
        KeyConditionExpression: 'SK = :user_sk',
        ExpressionAttributeValues: { ':user_sk': `USER#${userId}` },
    };

    try {
        const { Items } = await ddbDocClient.send(new QueryCommand(params));
        const projects = Items?.map(item => ({ projectId: item.PK.split('#')[1] })) || [];
        return projects;
    } catch (error) {
        console.error('Error al obtener proyectos por usuario:', error);
        throw error;
    }
};

// =================================================================
// --- FUNCIONES DE ESCRITURA (CREATE, UPDATE, DELETE) ---
// =================================================================

export const createProject = async (projectData: Omit<Project, 'projectId' | 'createdAt' | 'updatedAt'>): Promise<Project> => {
  const projectId = randomUUID();
  const now = new Date().toISOString();
  const newProject: Project = { ...projectData, projectId, createdAt: now, updatedAt: now };
  const membersToLink = new Set([newProject.createdBy, ...newProject.members]);
  const transactionItems = [];

  transactionItems.push({
    Put: {
      TableName: PROJECTS_TABLE,
      Item: {
        PK: `PROJ#${projectId}`, SK: `METADATA`,
        name: newProject.name, description: newProject.description,
        createdBy: newProject.createdBy, createdAt: newProject.createdAt, updatedAt: newProject.updatedAt,
        status: newProject.status, priority: newProject.priority, dueDate: newProject.dueDate,
      },
    },
  });

  membersToLink.forEach(memberId => {
    transactionItems.push({
      Put: { TableName: PROJECTS_TABLE, Item: { PK: `PROJ#${projectId}`, SK: `USER#${memberId}` } },
    });
  });

  try {
    await ddbDocClient.send(new TransactWriteCommand({ TransactItems: transactionItems }));
    return newProject;
  } catch (error) { console.error('Error en createProject:', error); throw new Error('No se pudo crear el proyecto'); }
};

export const updateProjectDetails = async (projectId: string, updateData: any): Promise<any> => {
    const now = new Date().toISOString();
    const allowedToUpdate = ['name', 'description', 'status', 'priority', 'dueDate'];
    const updatePayload: any = { updatedAt: now };

    for (const field of allowedToUpdate) {
        if (updateData[field] !== undefined) { updatePayload[field] = updateData[field]; }
    }

    const keys = Object.keys(updatePayload);
    if (keys.length <= 1) { return getProjectDetailsById(projectId); }
    
    const UpdateExpression = 'set ' + keys.map(k => `#${k} = :${k}`).join(', ');
    const ExpressionAttributeNames = keys.reduce((acc, k) => ({ ...acc, [`#${k}`]: k }), {});
    const ExpressionAttributeValues = keys.reduce((acc, k) => ({ ...acc, [`:${k}`]: updatePayload[k] }), {});

    const params = {
        TableName: PROJECTS_TABLE, Key: { PK: `PROJ#${projectId}`, SK: `METADATA` },
        UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    } as const;

    const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
    return Attributes;
};

export const addMemberToProject = (projectId: string, memberId: string) => {
  return ddbDocClient.send(new PutCommand({
    TableName: PROJECTS_TABLE, Item: { PK: `PROJ#${projectId}`, SK: `USER#${memberId}` }
  }));
};

export const removeMemberFromProject = (projectId: string, memberId: string) => {
  return ddbDocClient.send(new DeleteCommand({
    TableName: PROJECTS_TABLE, Key: { PK: `PROJ#${projectId}`, SK: `USER#${memberId}` }
  }));
};

export const deleteProjectById = async (projectId: string) => {
  const queryParams = { TableName: PROJECTS_TABLE, KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': `PROJ#${projectId}` } };
  const { Items } = await ddbDocClient.send(new QueryCommand(queryParams));

  if (!Items || Items.length === 0) return;
  const deleteRequests = Items.map(item => ({ Delete: { TableName: PROJECTS_TABLE, Key: { PK: item.PK, SK: item.SK } } }));
  await ddbDocClient.send(new TransactWriteCommand({ TransactItems: deleteRequests }));
};

/**
 * Busca los detalles de múltiples proyectos por sus IDs de forma eficiente.
 * @param projectIds - Un array de IDs de proyecto a buscar.
 * @returns Un array de objetos de proyecto encontrados.
 */
export const getProjectsByIds = async (projectIds: string[]): Promise<Project[]> => {
  if (!projectIds || projectIds.length === 0) {
    return [];
  }
  const uniqueProjectIds = [...new Set(projectIds)];

  // Usamos BatchGetCommand para traer múltiples items de forma optimizada
  const params = {
    RequestItems: {
      [PROJECTS_TABLE]: {
        Keys: uniqueProjectIds.map(id => ({
          PK: `PROJ#${id}`,
          SK: 'METADATA'
        })),
      },
    },
  };

  try {
    const { Responses } = await ddbDocClient.send(new BatchGetCommand(params));
    const projects = Responses?.[PROJECTS_TABLE] || [];

    // Mapeamos la respuesta al formato de nuestra interfaz Project
    return projects.map(p => ({
        projectId: p.PK.split('#')[1],
        name: p.name,
        description: p.description,
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        members: [], // Nota: esta consulta no trae los miembros, solo los metadatos.
        status: p.status,
        priority: p.priority,
        dueDate: p.dueDate,
    }));
  } catch (error) {
    console.error('Error al buscar proyectos por IDs:', error);
    throw new Error('Error al obtener proyectos');
  }
};