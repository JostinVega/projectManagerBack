// src/repositories/notification.repository.ts (VERSIÓN FINAL Y COMPLETA)

import { 
  PutCommand, 
  QueryCommand, 
  UpdateCommand, 
  DeleteCommand,
  ScanCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { ddbDocClient } from '../config/dynamodb';
import { Notification } from '../models/notification.interface';
import { randomUUID } from 'crypto';

const NOTIFICATIONS_TABLE = 'Notifications';

export const createNotification = async (
  notificationData: Omit<Notification, 'notificationId' | 'read' | 'createdAt' | 'updatedAt'>
): Promise<Notification> => {
  const now = new Date();
  const newNotification: Notification = {
    ...notificationData,
    notificationId: randomUUID(),
    read: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await ddbDocClient.send(new PutCommand({ TableName: NOTIFICATIONS_TABLE, Item: newNotification }));
  return newNotification;
};

export const getNotificationsByUserId = async (userId: string): Promise<Notification[]> => {
  const params = {
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
    ScanIndexForward: false, 
  };
  const { Items } = await ddbDocClient.send(new QueryCommand(params));
  return Items as Notification[];
};

/**
 * NUEVA FUNCIÓN: Busca una notificación por su ID único.
 * ADVERTENCIA: Usa Scan, ineficiente en tablas muy grandes.
 */
export const findNotificationById = async (notificationId: string): Promise<Notification | null> => {
  const params = {
    TableName: NOTIFICATIONS_TABLE,
    FilterExpression: 'notificationId = :notificationId',
    ExpressionAttributeValues: { ':notificationId': notificationId },
  };
  const { Items } = await ddbDocClient.send(new ScanCommand(params));
  return Items && Items.length > 0 ? (Items[0] as Notification) : null;
};

export const markNotificationAsRead = async (userId: string, createdAt: string): Promise<Notification> => {
  const params = {
    TableName: NOTIFICATIONS_TABLE,
    Key: { userId, createdAt },
    UpdateExpression: 'set #read = :read, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#read': 'read' },
    ExpressionAttributeValues: { ':read': true, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  } as const;
  const { Attributes } = await ddbDocClient.send(new UpdateCommand(params));
  return Attributes as Notification;
};

/**
 * NUEVA FUNCIÓN: Marca todas las notificaciones de un usuario como leídas.
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  // 1. Obtenemos todas las notificaciones del usuario.
  const notifications = await getNotificationsByUserId(userId);
  const unreadNotifications = notifications.filter(n => !n.read);

  if (unreadNotifications.length === 0) return;

  // 2. Creamos una operación de actualización para cada una.
  const updateRequests = unreadNotifications.map(n => ({
    Put: { // Usamos Put para sobrescribir, es más simple que Update en una transacción
      TableName: NOTIFICATIONS_TABLE,
      Item: { ...n, read: true, updatedAt: new Date().toISOString() },
    }
  }));

  // 3. Las ejecutamos en un batch para ser eficientes.
  // TransactWriteCommand tiene un límite de 100 items.
  await ddbDocClient.send(new TransactWriteCommand({ TransactItems: updateRequests }));
};

export const deleteNotification = async (userId: string, createdAt: string): Promise<void> => {
  await ddbDocClient.send(new DeleteCommand({ TableName: NOTIFICATIONS_TABLE, Key: { userId, createdAt } }));
};