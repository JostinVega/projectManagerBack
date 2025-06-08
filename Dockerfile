# Usa una imagen ligera de Node.js
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias (prod + dev)
RUN npm install

# Copia todo el código fuente al contenedor
COPY . .

# Compila TypeScript a JavaScript
RUN npm run build

# Expone el puerto donde corre tu app
EXPOSE 3000

# Comando para arrancar la app (ajusta si usas otro comando)
CMD ["node", "dist/index.js"]
