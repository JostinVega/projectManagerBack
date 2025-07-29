// src/config/s3.ts

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage'; // Para subir streams de forma eficiente
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || '', // Reemplaza con tu región por defecto
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_S3 || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_S3 || '',
  },
});

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME; // Reemplaza con el nombre de tu bucket

// Configuración de Multer para S3
const upload = multer({
  storage: multerS3({
    s3: s3Client as any, // Multer-S3 aún espera la clase S3 antigua, pero S3Client funciona
    bucket: S3_BUCKET_NAME,
    //acl: 'public-read', // Permite que las imágenes sean leídas públicamente
    contentType: multerS3.AUTO_CONTENT_TYPE, // Detecta automáticamente el tipo de contenido
    key: function (req, file, cb) {
      // Genera un nombre de archivo único para evitar colisiones
      const userId = (req as any).user?.userId; // Accede al userId desde el token autenticado
      const fileName = `avatars/${userId || 'guest'}/${Date.now().toString()}${path.extname(file.originalname)}`;
      cb(null, fileName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de 5MB
  fileFilter: function (req, file, cb) {
    // Valida tipos de archivo permitidos
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: Solo se permiten imágenes (jpeg, jpg, png, gif)!'));
  },
});

export { upload, s3Client, S3_BUCKET_NAME, Upload };