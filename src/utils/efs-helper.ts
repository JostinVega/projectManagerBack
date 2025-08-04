import { promises as fs } from 'fs';
import path from 'path';

interface CacheData {
    data: any;
    timestamp: number;
    ttl: number;
}

interface EFSConfig {
    baseDir: string;
    cacheDir: string;
    tempDir: string;
    logsDir: string;
}

class EFSHelper {
    private config: EFSConfig;

    constructor() {
        const EFS_BASE = process.env.EFS_MOUNT_POINT || '/mnt/efs';
        
        this.config = {
            baseDir: EFS_BASE,
            cacheDir: path.join(EFS_BASE, 'cache'),
            tempDir: path.join(EFS_BASE, 'temp'),
            logsDir: path.join(EFS_BASE, 'logs')
        };
    }

    /**
     * Guardar datos en cache compartido
     */
    async setCache<T>(key: string, data: T, ttl: number = 3600): Promise<boolean> {
        try {
            await fs.mkdir(this.config.cacheDir, { recursive: true });
            
            const cacheData: CacheData = {
                data: data,
                timestamp: Date.now(),
                ttl: ttl * 1000
            };
            
            const filepath = path.join(this.config.cacheDir, `${key}.json`);
            await fs.writeFile(filepath, JSON.stringify(cacheData));
            
            console.log(`✅ Cache saved: ${key}`);
            return true;
        } catch (error) {
            console.error('❌ Error saving cache:', error);
            return false;
        }
    }

    /**
     * Obtener datos del cache
     */
    async getCache<T>(key: string): Promise<T | null> {
        try {
            const filepath = path.join(this.config.cacheDir, `${key}.json`);
            const data = await fs.readFile(filepath, 'utf8');
            const cacheData: CacheData = JSON.parse(data);
            
            // Verificar TTL
            if (Date.now() - cacheData.timestamp > cacheData.ttl) {
                await fs.unlink(filepath); // Eliminar cache expirado
                console.log(`🕐 Cache expired: ${key}`);
                return null;
            }
            
            console.log(`🎯 Cache hit: ${key}`);
            return cacheData.data as T;
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Error reading cache:', error);
            }
            return null;
        }
    }

    /**
     * Invalidar cache específico
     */
    async invalidateCache(key: string): Promise<boolean> {
        try {
            const filepath = path.join(this.config.cacheDir, `${key}.json`);
            await fs.unlink(filepath);
            console.log(`🗑️ Cache invalidated: ${key}`);
            return true;
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Error invalidating cache:', error);
                return false;
            }
            return true; // File doesn't exist = already invalidated
        }
    }

    /**
     * Guardar archivo temporal
     */
    async saveTempFile(filename: string, data: Buffer | string): Promise<string> {
        try {
            await fs.mkdir(this.config.tempDir, { recursive: true });
            const filepath = path.join(this.config.tempDir, filename);
            await fs.writeFile(filepath, data);
            console.log(`📁 Temp file saved: ${filename}`);
            return filepath;
        } catch (error) {
            console.error('❌ Error saving temp file:', error);
            throw error;
        }
    }

    /**
     * Leer archivo temporal
     */
    async getTempFile(filename: string): Promise<Buffer> {
        try {
            const filepath = path.join(this.config.tempDir, filename);
            return await fs.readFile(filepath);
        } catch (error) {
            console.error('❌ Error reading temp file:', error);
            throw error;
        }
    }

    /**
     * Eliminar archivo temporal
     */
    async deleteTempFile(filename: string): Promise<boolean> {
        try {
            const filepath = path.join(this.config.tempDir, filename);
            await fs.unlink(filepath);
            console.log(`🗑️ Temp file deleted: ${filename}`);
            return true;
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Error deleting temp file:', error);
                return false;
            }
            return true; // File doesn't exist = already deleted
        }
    }

    /**
     * Listar archivos temporales
     */
    async listTempFiles(): Promise<string[]> {
        try {
            await fs.mkdir(this.config.tempDir, { recursive: true });
            return await fs.readdir(this.config.tempDir);
        } catch (error) {
            console.error('❌ Error listing temp files:', error);
            return [];
        }
    }

    /**
     * Limpiar archivos temporales antiguos
     */
    async cleanupTempFiles(maxAgeHours: number = 24): Promise<number> {
        try {
            const files = await this.listTempFiles();
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                const filepath = path.join(this.config.tempDir, file);
                const stats = await fs.stat(filepath);
                const ageHours = (now - stats.mtime.getTime()) / (1000 * 60 * 60);

                if (ageHours > maxAgeHours) {
                    await fs.unlink(filepath);
                    deletedCount++;
                }
            }

            console.log(`🧹 Cleaned up ${deletedCount} old temp files`);
            return deletedCount;
        } catch (error) {
            console.error('❌ Error cleaning temp files:', error);
            return 0;
        }
    }

    /**
     * Escribir log compartido
     */
    async appendLog(logName: string, message: string, level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' = 'INFO'): Promise<void> {
        try {
            await fs.mkdir(this.config.logsDir, { recursive: true });
            const filepath = path.join(this.config.logsDir, `${logName}.log`);
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] [${level}] ${message}\n`;
            await fs.appendFile(filepath, logEntry);
        } catch (error) {
            console.error('❌ Error writing log:', error);
        }
    }

    /**
     * Leer logs recientes
     */
    async readLog(logName: string, lines: number = 100): Promise<string[]> {
        try {
            const filepath = path.join(this.config.logsDir, `${logName}.log`);
            const data = await fs.readFile(filepath, 'utf8');
            const allLines = data.trim().split('\n');
            return allLines.slice(-lines); // Últimas N líneas
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error('❌ Error reading log:', error);
            }
            return [];
        }
    }

    /**
     * Verificar si EFS está montado
     */
    async isEFSMounted(): Promise<boolean> {
        try {
            await fs.access(this.config.baseDir);
            const stats = await fs.stat(this.config.baseDir);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Obtener estadísticas de EFS
     */
    async getEFSStats(): Promise<{ mounted: boolean; cacheFiles: number; tempFiles: number; logFiles: number }> {
        const mounted = await this.isEFSMounted();
        
        if (!mounted) {
            return { mounted: false, cacheFiles: 0, tempFiles: 0, logFiles: 0 };
        }

        try {
            const [cacheFiles, tempFiles, logFiles] = await Promise.all([
                fs.readdir(this.config.cacheDir).catch(() => []),
                fs.readdir(this.config.tempDir).catch(() => []),
                fs.readdir(this.config.logsDir).catch(() => [])
            ]);

            return {
                mounted: true,
                cacheFiles: cacheFiles.length,
                tempFiles: tempFiles.length,
                logFiles: logFiles.length
            };
        } catch (error) {
            console.error('❌ Error getting EFS stats:', error);
            return { mounted: true, cacheFiles: 0, tempFiles: 0, logFiles: 0 };
        }
    }
}

// Singleton instance
const efsHelper = new EFSHelper();
export default efsHelper;

// También exportar la clase por si necesitas crear instancias adicionales
export { EFSHelper };