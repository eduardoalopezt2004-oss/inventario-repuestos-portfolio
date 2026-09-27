# Frontend Dockerfile - Build Stage
FROM node:18-alpine as build

WORKDIR /app

# Copiar package.json y .npmrc
COPY package*.json .npmrc ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Build de la aplicación
RUN npm run build

# Etapa de producción con nginx
FROM nginx:alpine

# Copiar el build al directorio de nginx
COPY --from=build /app/build /usr/share/nginx/html

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
