# Dockerfile

# =================================================================
# ETAPA 1: Builder - Instalar dependencias y construir el proyecto
# =================================================================
FROM node:20-alpine AS builder

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos de definición de dependencias
COPY package*.json ./

# Instalar las dependencias del proyecto
# Usamos --ci para una instalación limpia y reproducible en entornos de CI/CD
RUN npm ci

# Copiar el resto del código fuente de la aplicación
COPY . .

# Construir la aplicación Next.js para producción
RUN npm run build

# =================================================================
# ETAPA 2: Runner - Crear la imagen final de producción
# =================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Establecer el entorno a producción
ENV NODE_ENV=production

# Crear un usuario y grupo sin privilegios para mayor seguridad
RUN addgroup -S nodejs
RUN adduser -S nextjs -G nodejs

# Copiar los artefactos de la compilación desde la etapa 'builder'
# Copiamos solo lo necesario para ejecutar la app en producción
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Cambiar al usuario sin privilegios que creamos
USER nextjs

# Exponer el puerto en el que Next.js se ejecuta por defecto
EXPOSE 3000

# El comando para iniciar la aplicación
CMD ["npm", "start"]