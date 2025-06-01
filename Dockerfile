# Etapa base
FROM node:18-alpine

# Crear directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias (package.json y package-lock.json)
COPY package*.json ./

# Instalar dependencias del proyecto
RUN npm install

# Copiar el resto del código fuente al contenedor
COPY . .

# Variable de entorno (puede ayudar a que el backend la tome por defecto)
ENV PORT=3000

# Exponer el puerto en el que corre el backend (Express o Nest)
EXPOSE 3000

# Comando para iniciar el servidor en modo desarrollo (puedes cambiar a "start" si es producción)
CMD ["npm", "start"]