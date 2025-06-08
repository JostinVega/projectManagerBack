// src/config/dynamodb.ts

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';

// 1. Configuración de la Región
// El SDK buscará las credenciales (AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY)
// en tus variables de entorno automáticamente.
// Asegúrate de tener la región correcta donde crearás tus tablas.

dotenv.config();
const REGION = process.env.AWS_REGION || 'us-east-2';
console.log(REGION);

// 2. Creación del cliente base de DynamoDB
const ddbClient = new DynamoDBClient({
  region: REGION,
});

// 3. Creación del "Document Client"
// Este cliente simplifica el trabajo con objetos JSON.
// Transforma automáticamente los objetos de JavaScript al formato de DynamoDB y viceversa.
export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

console.log(`DynamoDB client initialized for region: ${REGION}`);