// src/config/s3.ts
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// ✅ Cliente S3 sin credenciales explícitas
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1', // Solo us-east-1 y us-west-2 permitidas
  // ❌ NO especificar credenciales - el entorno estudiantil las maneja automáticamente
  // credentials: { ... } - El LabRole las proporciona automáticamente
});

// Nombre del bucket (debe existir y tener políticas correctas)
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'taskflow-front-end';

console.log(`S3 client initialized for region: ${process.env.AWS_REGION || 'us-east-1'}`);
console.log(`Using bucket: ${S3_BUCKET_NAME}`);
console.log('Using AWS Academy environment credentials');

// Configuración de Multer para S3
const upload = multer({
  storage: multerS3({
    s3: s3Client as any, // Multer-S3 aún espera la clase S3 antigua, pero S3Client funciona
    bucket: S3_BUCKET_NAME,
    // ❌ ACL puede no estar disponible en entorno estudiantil
    // acl: 'public-read', // Comentado - usar políticas de bucket en su lugar
    contentType: multerS3.AUTO_CONTENT_TYPE, // Detecta automáticamente el tipo de contenido
    key: function (req, file, cb) {
      // Genera un nombre de archivo único para evitar colisiones
      const userId = (req as any).user?.userId; // Accede al userId desde el token autenticado
      const timestamp = Date.now().toString();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `avatars/${userId || 'guest'}/${timestamp}-${randomString}${path.extname(file.originalname)}`;
      cb(null, fileName);
    },
  }),
  limits: { 
    fileSize: 5 * 1024 * 1024, // Límite de 5MB
    files: 1 // Solo un archivo a la vez
  },
  fileFilter: function (req, file, cb) {
    // Valida tipos de archivo permitidos
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: Solo se permiten imágenes (jpeg, jpg, png, gif, webp)!'));
  },
});

// Función helper para verificar conexión a S3 (opcional)
export const testS3Connection = async () => {
  try {
    const { ListBucketsCommand } = await import("@aws-sdk/client-s3");
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    console.log('S3 connection successful. Available buckets:', 
      response.Buckets?.map(bucket => bucket.Name) || []);
    return true;
  } catch (error) {
    console.error('S3 connection failed:', error);
    return false;
  }
};

// Función para generar URL pública del objeto
export const getPublicUrl = (key: string): string => {
  return `https://${S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
};

export { upload, s3Client, S3_BUCKET_NAME, Upload };