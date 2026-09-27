# Guía de Inicio Rápido

## Pasos para Levantar el Sistema

### 1. Asegúrate de tener Docker Desktop instalado y corriendo

Verifica que Docker esté funcionando:
```bash
docker --version
docker-compose --version
```

### 2. Levantar los Contenedores

Desde el directorio raíz del proyecto (`administracion_inventario`), ejecuta:

```bash
docker-compose up --build
```

- MongoDB (Base de datos)
- Backend (API Node.js/Express)
- Frontend (React + Nginx)

### 3. Crear Usuario Administrador

Una vez que los contenedores estén corriendo, en otra terminal ejecuta:

```bash
docker exec -it inventario_backend node src/scripts/createAdmin.js
```

Esto creará un usuario administrador con las siguientes credenciales:
- **Email:** admin@repuestos.com
- **Password:** admin123

### 4. Acceder al Sistema

Abre tu navegador y ve a:
```
http://localhost:3000
```

Inicia sesión con las credenciales del administrador.

### 5. Configuración Inicial

Una vez dentro del sistema:

1. **Crear Categorías:**
   - Ve a "Administración" → "Categorías"
   - Crea categorías como: Filtros, Frenos, Suspensión, Motor, etc.

2. **Agregar Productos:**
   - Ve a "Productos"
   - Haz clic en "Nuevo Producto"
   - Completa los datos del producto

3. **Crear Usuarios Adicionales (Opcional):**
   - Como administrador, puedes crear usuarios vendedores
   - Usa Postman o curl para hacer una petición POST a:
   ```
   POST http://localhost:5000/api/auth/register
   Authorization: Bearer {tu_token}

   {
     "nombre": "Vendedor 1",
     "email": "vendedor@repuestos.com",
     "password": "vendedor123",
     "rol": "vendedor"
   }
   ```

4. **Registrar Ventas:**
   - Ve a "Ventas"
   - Haz clic en "Nueva Venta"
   - Agrega productos al carrito
   - Completa información del cliente (opcional)
   - Registra la venta

## Comandos Útiles

### Detener el Sistema
```bash
docker-compose down
```

### Ver Logs
```bash
# Todos los servicios
docker-compose logs -f

# Solo backend
docker-compose logs -f backend

# Solo frontend
docker-compose logs -f frontend
```

### Reiniciar un Servicio
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Resetear Base de Datos
```bash
docker-compose down -v
docker-compose up --build
```

## Acceso a Servicios

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **MongoDB:** localhost:27017

## Problemas Comunes

### Error: Puerto ya en uso

Si algún puerto está ocupado, puedes cambiarlos en `docker-compose.yml`:

```yaml
ports:
  - "3001:80"  # Cambiar 3000 por 3001 para frontend
  - "5001:5000"  # Cambiar 5000 por 5001 para backend
```

### Error: No se puede conectar a MongoDB

Espera unos segundos después de levantar los contenedores para que MongoDB esté completamente inicializado.

### Error de Autenticación

Limpia el localStorage del navegador:
- Abre DevTools (F12)
- Ve a "Application" → "Local Storage"
- Elimina las entradas de `token` y `user`

## Estructura de Navegación

```
Login
  │
  ├── Dashboard (/)
  │   └── Estadísticas, ventas del día, mes, año
  │
  ├── Productos (/productos)
  │   └── CRUD de productos, búsqueda, stock
  │
  ├── Ventas (/ventas)
  │   └── Registrar ventas, historial
  │
  └── Administración (solo admin)
      ├── Categorías (/categorias)
      └── Reportes (/reportes)
```

## Próximos Pasos

1. Cambia la contraseña del administrador
2. Configura categorías de productos
3. Agrega tu inventario inicial
4. Crea usuarios vendedores
5. Comienza a registrar ventas

## Soporte

Para cualquier problema o duda, consulta:
- README.md - Documentación general
- DOCUMENTACION.md - Documentación técnica detallada
