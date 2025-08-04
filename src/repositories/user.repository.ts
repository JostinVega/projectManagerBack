// src/repositories/user.repository.ts

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  BatchGetCommand,
  UpdateCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../config/dynamodb';
import { User, NotificationSettings } from '../models/user.interface';
import { randomUUID } from 'crypto';

const USERS_TABLE = 'Users';
const EMAIL_INDEX = 'EmailIndex';
const USERNAME_INDEX = 'UsernameIndex'; // Asegúrate de que este sea el nombre correcto de tu GSI para username

/**
 * Guarda un nuevo usuario en la base de datos.
 * Genera un userId y los timestamps.
 * @param userData - Datos del usuario sin userId, createdAt, updatedAt
 * @returns El objeto de usuario completo que fue guardado.
 */
export const createUser = async (
  userData: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<User> => {
  const userId = randomUUID();
  const now = new Date().toISOString();

  // Construye el objeto newUser asegurando que todos los campos requeridos estén presentes
  // y que los opcionales tengan valores por defecto si es necesario.
  const newUser: User = {
    userId,
    username: userData.username, // Asegura que username se asigne
    email: userData.email,
    passwordHash: userData.passwordHash,
    role: userData.role || 'member', // Asegura que role se asigne, con un valor por defecto
    createdAt: now,
    updatedAt: now,
    // Asigna los campos opcionales si están presentes en userData
    firstName: userData.firstName,
    lastName: userData.lastName,
    position: userData.position,
    department: userData.department,
    bio: userData.bio,
    phone: userData.phone,
    avatar: userData.avatar,
    // Asigna notificationSettings, o un valor por defecto si no se proporciona
    notificationSettings: userData.notificationSettings || {
      emailNotifications: true,
      pushNotifications: true,
      weeklyDigest: false,
    },
  };

  const params = {
    TableName: USERS_TABLE,
    Item: newUser,
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
    return newUser;
  } catch (error) {
    console.error('Error al crear usuario en DynamoDB:', error);
    throw new Error('Error al crear usuario');
  }
};

/**
 * Busca un usuario por su email usando el índice secundario.
 * @param email - El email del usuario a buscar.
 * @returns El objeto de usuario si se encuentra, de lo contrario undefined.
*/
export const getUserByEmail = async (email: string): Promise<User | undefined> => {
  const params = {
    TableName: USERS_TABLE,
    IndexName: EMAIL_INDEX,
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email,
    },
  };

  try {
    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    return Items?.[0] as User | undefined;
  } catch (error) {
    console.error('Error al buscar usuario por email:', error);
    throw new Error('Error al obtener usuario por email');
  }
};

/**
 * Busca un usuario por su username usando el índice secundario.
 * @param username - El username del usuario a buscar.
 * @returns El objeto de usuario si se encuentra, de lo contrario undefined.
 */
export const getUserByUsername = async (username: string): Promise<User | undefined> => {
  const params = {
    TableName: USERS_TABLE,
    IndexName: USERNAME_INDEX, // Asegúrate de que este sea el nombre correcto de tu GSI
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username,
    },
  };

  try {
    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    return Items?.[0] as User | undefined;
  }
  catch (error) {
    console.error('Error al buscar usuario por username:', error);
    throw new Error('Error al obtener usuario por username');
  }
};


/**
 * Busca un usuario por su ID (la clave primaria de la tabla).
 * @param userId - El ID del usuario.
 * @returns El objeto de usuario si se encuentra, de lo contrario undefined.
 */
export const getUserById = async (userId: string): Promise<User | undefined> => {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: userId,
    },
  };

  try {
    const { Item } = await ddbDocClient.send(new GetCommand(params));
    return Item as User | undefined;
  } catch (error) {
    console.error('Error al buscar usuario por ID:', error);
    throw new Error('Error al obtener usuario por ID');
  }
};

/**
 * OJO: DEV-ONLY - Escanea y devuelve TODOS los usuarios.
 * ¡EXTREMADAMENTE INEFICIENTE EN TABLAS GRANDES!
 * Una operación de Scan lee cada item de la tabla. Evitar en producción.
 */
export const scanAllUsers = async (): Promise<User[]> => {
  const params = {
    TableName: USERS_TABLE,
  };

  try {
    const { Items } = await ddbDocClient.send(new ScanCommand(params));
    return Items as User[];
  } catch (error) {
    console.error('Error al escanear usuarios:', error);
    throw new Error('Error al obtener todos los usuarios');
  }
};


export const updateUser = async (userId: string, updates: Partial<User>): Promise<User | null> => {
  console.log('updateUser llamado con userId:', userId);
  console.log('Tipo de updates:', typeof updates);
  console.log('Valor de updates:', updates);

  if (!userId || typeof updates !== 'object' || updates === null || Object.keys(updates).length === 0) {
      console.warn('No se puede actualizar el usuario: userId o updates son inválidos, no es un objeto, es null, o está vacío. No se realizará la actualización en DynamoDB.');
      const currentUser = await getUserById(userId);
      return currentUser || null;
  }

  const now = new Date().toISOString();
  const updateExpressionParts: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Siempre actualiza el timestamp 'updatedAt'
  updateExpressionParts.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = now;

  // Añade dinámicamente otros campos a actualizar
  for (const key of Object.keys(updates)) {
    // Excluye campos inmutables y el propio 'updatedAt' que ya manejamos
    // 'email' y 'username' son claves de GSI y no deben ser actualizadas directamente
    if (key !== 'userId' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'email' && key !== 'username') {
      updateExpressionParts.push(`#${key} = :${key}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[`:${key}`] = (updates as any)[key];
    }
  }

  if (updateExpressionParts.length === 0) {
    console.warn('No hay campos válidos para actualizar para el usuario', userId);
    const currentUser = await getUserById(userId);
    return currentUser || null;
  }

  const params: UpdateCommandInput = {
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW',
  };

  try {
    const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
    return Attributes as User | null;
  } catch (error) {
    console.error(`Error al actualizar usuario ${userId}:`, error);
    throw error;
  }
};

/**
 * Elimina un usuario de la base de datos por su ID.
 * @param userId - El ID del usuario a eliminar.
 */
export const deleteUserById = async (userId: string): Promise<void> => {
  const params = {
    TableName: USERS_TABLE,
    Key: { userId },
  };

  try {
    await ddbDocClient.send(new DeleteCommand(params));
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    throw new Error('Error al eliminar usuario');
  }
};


/**
 * Busca múltiples usuarios por sus IDs de forma eficiente.
 * @param userIds - Un array de IDs de usuario a buscar.
 * @returns Un array de objetos de usuario encontrados.
 */
export const getUsersByIds = async (userIds: string[]): Promise<User[]> => {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const uniqueUserIds = [...new Set(userIds)];

  const params = {
    RequestItems: {
      [USERS_TABLE]: {
        Keys: uniqueUserIds.map(userId => ({ userId })),
      },
    },
  };

  try {
    const { Responses } = await ddbDocClient.send(new BatchGetCommand(params));
    return (Responses?.[USERS_TABLE] as User[] || []).filter(item => item !== undefined);
  } catch (error) {
    console.error('Error al buscar usuarios por IDs:', error);
    throw new Error('Error al obtener usuarios');
  }
};
