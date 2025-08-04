// src/config/dynamodb.ts

//import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
//import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
//import dotenv from 'dotenv';

// 1. Configuración de la Región
// El SDK buscará las credenciales (AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY)
// en tus variables de entorno automáticamente.
// Asegúrate de tener la región correcta donde crearás tus tablas.

//dotenv.config();
//const REGION = process.env.AWS_REGION || 'us-east-1';
//console.log(REGION);

// 2. Creación del cliente base de DynamoDB
//const ddbClient = new DynamoDBClient({
//  region: REGION,
//});

// 3. Creación del "Document Client"
// Este cliente simplifica el trabajo con objetos JSON.
// Transforma automáticamente los objetos de JavaScript al formato de DynamoDB y viceversa.
//export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

//console.log(`DynamoDB client initialized for region: ${REGION}`);

// src/config/dynamodb.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// 1. Configuración de la Región (solo us-east-1 y us-west-2 permitidas)
const REGION = process.env.AWS_REGION || 'us-east-1';
console.log(`Using AWS Region: ${REGION}`);

// 2. Creación del cliente base de DynamoDB
// ✅ Sin credenciales explícitas - el entorno estudiantil las maneja automáticamente
const ddbClient = new DynamoDBClient({
  region: REGION,
  // ❌ NO especificar credenciales aquí
  // credentials: { ... } - El LabRole las proporciona automáticamente
});

// 3. Creación del "Document Client"
// Este cliente simplifica el trabajo con objetos JSON.
// Transforma automáticamente los objetos de JavaScript al formato de DynamoDB y viceversa.
export const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

console.log(`DynamoDB client initialized for region: ${REGION}`);
console.log('Using AWS Academy environment credentials');

// 4. Función helper para verificar conexión (opcional)
export const testDynamoDBConnection = async () => {
  try {
    const { ListTablesCommand } = await import("@aws-sdk/client-dynamodb");
    const command = new ListTablesCommand({});
    const response = await ddbClient.send(command);
    console.log('DynamoDB connection successful. Tables:', response.TableNames);
    return true;
  } catch (error) {
    console.error('DynamoDB connection failed:', error);
    return false;
  }
};