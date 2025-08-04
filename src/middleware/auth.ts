import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  email: string; // Incluye todos los campos que estén en el payload de tu token
  role: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || "QO2h6UWN94YnjkhGbiVCJkXDdKwfTaYyu6iDj5wcL6E";
if (!JWT_SECRET) {
  console.error('JWT_SECRET no está definido en las variables de entorno. Autenticación fallará.');
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if(!authHeader) return res.status(401).json({ message: 'No autorizado' });

  const token = authHeader.split(' ')[1];
  if(!token) return res.status(401).json({ message: 'Token no válido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Token inválido' });
  }
};
