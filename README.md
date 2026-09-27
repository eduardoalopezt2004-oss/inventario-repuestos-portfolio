# Sistema de Gestión de Inventario de Repuestos

Sistema completo basado en web para el registro, control, inventario y venta de repuestos para vehículos.

## Stack Tecnológico

- **Backend:** Node.js + Express.js + MongoDB + Mongoose
- **Frontend:** React.js + Bootstrap 5
- **Autenticación:** JWT (JSON Web Tokens)
- **Containerización:** Docker + Docker Compose

## Características

### Funcionalidades Principales

- **Dashboard:** Visualización de métricas clave y estadísticas de ventas
- **Gestión de Productos:** CRUD completo de repuestos con control de stock
- **Sistema de Ventas:** Registro de ventas con actualización automática de inventario
- **Control de Categorías:** Organización de productos por categorías
- **Alertas de Stock:** Notificaciones de productos con stock bajo
- **Reportes:** Productos más vendidos, ventas por período
- **Sistema de Usuarios:** Autenticación con roles (Admin/Vendedor)

### Roles de Usuario

- **Administrador:** Acceso completo al sistema
- **Vendedor:** Puede registrar ventas y consultar productos

## Instalación y Configuración

### Prerrequisitos

- Docker Desktop instalado
- Docker Compose instalado
- Git (opcional)

### Instalación con Docker (Recomendado)

1. Clonar o descargar el repositorio:
```bash
cd administracion_inventario
```

2. Construir y levantar los contenedores:
```bash
docker-compose up --build
```

3. La aplicación estará disponible en:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - MongoDB: localhost:27017

### Instalación Manual (Sin Docker)

#### Backend

1. Navegar al directorio del backend:
```bash
cd backend
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno (crear archivo .env):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/inventario_repuestos
JWT_SECRET=tu_clave_secreta_super_segura
NODE_ENV=development
```

4. Iniciar el servidor:
```bash
npm start
```

#### Frontend

1. Navegar al directorio del frontend:
```bash
cd frontend
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno (crear archivo .env):
```env
REACT_APP_API_URL=http://localhost:5000/api
```

4. Iniciar la aplicación:
```bash
npm start
```

## Uso del Sistema

### Primer Usuario Administrador

Para crear el primer usuario administrador, puedes usar una herramienta como Postman o curl:

```bash
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "nombre": "Administrador",
  "email": "admin@ejemplo.com",
  "password": "admin123",
  "rol": "admin"
}
```

**Nota:** Para crear usuarios subsecuentes, debes estar autenticado como administrador.

### Credenciales de Prueba

Después de crear el primer administrador, puedes iniciar sesión con:
- Email: admin@ejemplo.com
- Password: admin123

### Flujo de Trabajo Típico

1. **Configuración Inicial:**
   - Crear categorías de productos
   - Agregar productos al inventario

2. **Operación Diaria:**
   - Registrar ventas
   - Consultar stock disponible
   - Revisar productos con stock bajo

3. **Administración:**
   - Revisar reportes de ventas
   - Gestionar usuarios
   - Actualizar precios y stock

## Estructura del Proyecto

```
administracion_inventario/
├── backend/                    # Servidor Express.js
│   ├── src/
│   │   ├── config/            # Configuración de BD
│   │   ├── models/            # Modelos de Mongoose
│   │   ├── routes/            # Rutas de la API
│   │   ├── controllers/       # Lógica de negocio
│   │   ├── middleware/        # Middleware de autenticación
│   │   └── server.js          # Punto de entrada
│   ├── Dockerfile
│   └── package.json
├── frontend/                   # Aplicación React
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── pages/             # Páginas principales
│   │   ├── services/          # Servicios API
│   │   ├── context/           # Context API de React
│   │   └── App.js             # Componente principal
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml          # Configuración Docker Compose
└── README.md
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario (solo admin)
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener usuario actual

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Actualizar producto (admin)
- `DELETE /api/products/:id` - Eliminar producto (admin)
- `GET /api/products/low-stock` - Productos con stock bajo

### Categorías
- `GET /api/categories` - Listar categorías
- `POST /api/categories` - Crear categoría (admin)
- `PUT /api/categories/:id` - Actualizar categoría (admin)
- `DELETE /api/categories/:id` - Eliminar categoría (admin)

### Ventas
- `GET /api/sales` - Listar ventas
- `GET /api/sales/:id` - Obtener venta
- `POST /api/sales` - Registrar venta
- `PUT /api/sales/:id/cancel` - Cancelar venta (admin)

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas generales
- `GET /api/dashboard/sales-by-month` - Ventas por mes

## Comandos Docker Útiles

```bash
# Levantar los contenedores
docker-compose up

# Levantar en segundo plano
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener contenedores
docker-compose down

# Reconstruir imágenes
docker-compose build

# Eliminar volúmenes (resetear base de datos)
docker-compose down -v
```

## Tecnologías y Librerías

### Backend
- express - Framework web
- mongoose - ODM para MongoDB
- jsonwebtoken - Autenticación JWT
- bcryptjs - Encriptación de contraseñas
- cors - Manejo de CORS
- dotenv - Variables de entorno

### Frontend
- react - Librería UI
- react-router-dom - Enrutamiento
- react-bootstrap - Componentes UI
- axios - Cliente HTTP
- react-toastify - Notificaciones
- chart.js - Gráficos (opcional)

## Seguridad

- Contraseñas encriptadas con bcrypt
- Autenticación basada en JWT
- Validación de datos en backend
- Control de acceso basado en roles
- Variables de entorno para datos sensibles

## Soporte y Contribuciones

Para reportar problemas o sugerencias, por favor crea un issue en el repositorio.

## Licencia

ISC

## Autor

Sistema desarrollado para la gestión eficiente de inventarios de repuestos vehiculares.
