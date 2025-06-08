// src/repositories/user.repository.ts

import { 
  GetCommand, 
  PutCommand, 
  QueryCommand, 
  UpdateCommand, 
  DeleteCommand, 
  ScanCommand,
  BatchGetCommand // <--- AÑADE ESTE
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../config/dynamodb'; // Nuestro cliente de AWS
import { User } from '../models/user.interface';   // Nuestra interfaz de usuario
import { randomUUID } from 'crypto';                // Para generar IDs únicos

// Usamos constantes para evitar errores de tipeo
const USERS_TABLE = 'Users';
const EMAIL_INDEX = 'EmailIndex';
const USERNAME_INDEX = 'UsernameIndex';

/**
 * Guarda un nuevo usuario en la base de datos.
 * Genera un userId y los timestamps.
 * @param userData - Datos del usuario sin userId, createdAt, updatedAt
 * @returns El objeto de usuario completo que fue guardado.
 */
export const createUser = async (
  userData: Omit<User, 'userId' | 'createdAt' | 'updatedAt'>
): Promise<User> => {
  const userId = randomUUID(); // Generamos un ID único universal
  const now = new Date().toISOString(); // Fecha actual en formato ISO 8601

  const newUser: User = {
    ...userData,
    userId,
    createdAt: now,
    updatedAt: now,
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
    IndexName: EMAIL_INDEX, // ¡Muy importante! Especificamos qué índice usar
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email,
    },
  };

  try {
    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    return Items?.[0] as User;
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
    IndexName: USERNAME_INDEX, // Usamos el otro índice
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: {
      ':username': username,
    },
  };
  
  try {
    const { Items } = await ddbDocClient.send(new QueryCommand(params));
    return Items?.[0] as User;
  } catch (error) {
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
    return Item as User;
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

/**
 * Actualiza los datos de un usuario en DynamoDB.
 * @param userId - El ID del usuario a actualizar.
 * @param updateData - Un objeto con los campos a actualizar.
 * @returns El objeto de usuario actualizado.
 */
export const updateUser = async (userId: string, updateData: Partial<Omit<User, 'userId'>>): Promise<User> => {
  // Añadimos la fecha de actualización
  updateData.updatedAt = new Date().toISOString();

  const keys = Object.keys(updateData).filter(k => updateData[k as keyof typeof updateData] !== undefined);
  
  const UpdateExpression = 'set ' + keys.map(key => `#${key} = :${key}`).join(', ');
  const ExpressionAttributeNames = keys.reduce((acc, key) => ({ ...acc, [`#${key}`]: key }), {});
  const ExpressionAttributeValues = keys.reduce((acc, key) => ({ ...acc, [`:${key}`]: updateData[key as keyof typeof updateData] }), {});

  const params = {
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    ReturnValues: 'ALL_NEW', // Nos devuelve el item completo después de actualizar
  } as const;

  try {
    const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
    return Attributes as User;
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    throw new Error('Error al actualizar usuario');
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

  // Usamos new Set() para asegurar que no haya IDs duplicados en la petición
  const uniqueUserIds = [...new Set(userIds)];

  // BatchGetCommand puede buscar hasta 100 items a la vez
  const params = {
    RequestItems: {
      // Recuerda que USERS_TABLE debe ser 'Users', la constante que definimos arriba
      ['Users']: { 
        Keys: uniqueUserIds.map(userId => ({ userId })),
      },
    },
  };

  try {
    const { Responses } = await ddbDocClient.send(new BatchGetCommand(params));
    // El nombre de la tabla debe coincidir aquí también
    return (Responses?.['Users'] as User[]) || [];
  } catch (error) {
    console.error('Error al buscar usuarios por IDs:', error);
    throw new Error('Error al obtener usuarios');
  }
};