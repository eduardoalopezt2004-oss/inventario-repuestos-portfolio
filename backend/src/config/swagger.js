const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Inventario de Repuestos',
      version: '1.0.0',
      description: 'Sistema completo de gestión de inventario y ventas de repuestos para vehículos',
      contact: {
        name: 'Soporte Técnico',
        email: 'soporte@inventario.com'
      },
      license: {
        name: 'ISC',
        url: 'https://opensource.org/licenses/ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Servidor de Desarrollo'
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Servidor de Producción (a través de Nginx)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Ingrese el token JWT obtenido del endpoint /api/auth/login'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['nombre', 'email', 'password', 'rol'],
          properties: {
            _id: {
              type: 'string',
              description: 'ID único del usuario'
            },
            nombre: {
              type: 'string',
              description: 'Nombre completo del usuario'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email del usuario (único)'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Contraseña (hasheada en BD)'
            },
            rol: {
              type: 'string',
              enum: ['admin', 'vendedor'],
              description: 'Rol del usuario en el sistema'
            },
            activo: {
              type: 'boolean',
              description: 'Estado del usuario'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Category: {
          type: 'object',
          required: ['nombre'],
          properties: {
            _id: {
              type: 'string'
            },
            nombre: {
              type: 'string',
              description: 'Nombre de la categoría (único)'
            },
            descripcion: {
              type: 'string',
              description: 'Descripción de la categoría'
            },
            activo: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Product: {
          type: 'object',
          required: ['codigo', 'nombre', 'categoria', 'precioCompra', 'precioVenta', 'stock'],
          properties: {
            _id: {
              type: 'string'
            },
            codigo: {
              type: 'string',
              description: 'Código único del producto'
            },
            nombre: {
              type: 'string'
            },
            descripcion: {
              type: 'string'
            },
            categoria: {
              type: 'string',
              description: 'ID de la categoría'
            },
            marca: {
              type: 'string'
            },
            modelo: {
              type: 'string'
            },
            precioCompra: {
              type: 'number',
              minimum: 0
            },
            precioVenta: {
              type: 'number',
              minimum: 0
            },
            stock: {
              type: 'number',
              minimum: 0
            },
            stockMinimo: {
              type: 'number',
              minimum: 0,
              default: 5
            },
            ubicacion: {
              type: 'string'
            },
            activo: {
              type: 'boolean'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Sale: {
          type: 'object',
          required: ['items', 'total', 'vendedor'],
          properties: {
            _id: {
              type: 'string'
            },
            numeroVenta: {
              type: 'string',
              description: 'Número de venta auto-generado (VTA-000001)'
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  producto: {
                    type: 'string'
                  },
                  cantidad: {
                    type: 'number',
                    minimum: 1
                  },
                  precioUnitario: {
                    type: 'number'
                  },
                  subtotal: {
                    type: 'number'
                  }
                }
              }
            },
            total: {
              type: 'number'
            },
            vendedor: {
              type: 'string',
              description: 'ID del usuario vendedor'
            },
            cliente: {
              type: 'object',
              properties: {
                nombre: { type: 'string' },
                telefono: { type: 'string' },
                email: { type: 'string' }
              }
            },
            metodoPago: {
              type: 'string',
              enum: ['efectivo', 'tarjeta', 'transferencia', 'otro']
            },
            estado: {
              type: 'string',
              enum: ['completada', 'cancelada', 'pendiente']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Mensaje de error'
            }
          }
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
