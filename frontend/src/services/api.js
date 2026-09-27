import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ── Rastreo de accesibilidad al servidor ──
const reachabilityCallbacks = [];
export function onServerReachabilityChange(cb) {
  reachabilityCallbacks.push(cb);
  return () => {
    const i = reachabilityCallbacks.indexOf(cb);
    if (i > -1) reachabilityCallbacks.splice(i, 1);
  };
}
function notifyReachability(reachable) {
  reachabilityCallbacks.forEach(cb => cb(reachable));
}

// Crear instancia de axios con configuración base
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar token a todas las peticiones
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación y accesibilidad
axiosInstance.interceptors.response.use(
  (response) => {
    notifyReachability(true);
    return response;
  },
  (error) => {
    if (!error.response) {
      // Sin respuesta del servidor = servidor inaccesible
      notifyReachability(false);
    } else {
      notifyReachability(true);
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// API de Categorías (antes productAPI)
export const categoryAPI = {
  getAll: (params) => axiosInstance.get('/categories', { params }),
  getById: (id) => axiosInstance.get(`/categories/${id}`),
  create: (data) => axiosInstance.post('/categories', data),
  update: (id, data) => axiosInstance.put(`/categories/${id}`, data),
  delete: (id) => axiosInstance.delete(`/categories/${id}`),
  getLowStock: () => axiosInstance.get('/categories/low-stock')
};

// API de Productos (modelo real con stock y precios)
export const productAPI = {
  getAll: (params) => axiosInstance.get('/products', { params }),
  getById: (id) => axiosInstance.get(`/products/${id}`),
  create: (data) => axiosInstance.post('/products', data),
  update: (id, data) => axiosInstance.put(`/products/${id}`, data),
  delete: (id) => axiosInstance.delete(`/products/${id}`),
  getLowStock: () => axiosInstance.get('/products/low-stock'),
  getHistorial: (id, params) => axiosInstance.get(`/products/${id}/historial`, { params }),
  getHistorialGlobal: (params) => axiosInstance.get('/products/historial', { params })
};

// API de Ventas
export const saleAPI = {
  getAll: (params) => axiosInstance.get('/sales', { params }),
  getById: (id) => axiosInstance.get(`/sales/${id}`),
  create: (data) => axiosInstance.post('/sales', data),
  cancel: (id) => axiosInstance.put(`/sales/${id}/cancel`)
};

// API de Dashboard
export const dashboardAPI = {
  getStats: () => axiosInstance.get('/dashboard/stats'),
  getSalesByMonth: () => axiosInstance.get('/dashboard/sales-by-month'),
  getStockMovements: (periodo) => axiosInstance.get('/dashboard/stock-movements', { params: { periodo } }),
  getStockDistribution: () => axiosInstance.get('/dashboard/stock-distribution'),
  getCriticalProducts: () => axiosInstance.get('/dashboard/critical-products'),
  getStockTrend: (dias) => axiosInstance.get('/dashboard/stock-trend', { params: { dias } })
};

// API de Autenticación
export const authAPI = {
  login: (email, password) => axiosInstance.post('/auth/login', { email, password }),
  register: (data) => axiosInstance.post('/auth/register', data),
  getMe: () => axiosInstance.get('/auth/me')
};

// API de Tasa de Cambio USD → Bs
export const dolarAPI = {
  getTasa: () => axiosInstance.get('/dolar/tasa')
};

// API de Importación de Proveedores
export const importAPI = {
  analyze: (formData) => axiosInstance.post('/import/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  confirm: (productos) => axiosInstance.post('/import/confirm', { productos })
};

// API de Inventario
export const inventoryAPI = {
  getHistorialProducto: (id) => axiosInstance.get(`/inventory/producto/${id}/historial`, { params: { limite: 5 } })
};

// API de Créditos
export const creditoAPI = {
  getAll: (params) => axiosInstance.get('/creditos', { params }),
  getById: (id) => axiosInstance.get(`/creditos/${id}`),
  getAlertas: () => axiosInstance.get('/creditos/alertas'),
  registrarPago: (id, data) => axiosInstance.post(`/creditos/${id}/pago`, data),
  registrarProrroga: (id, data) => axiosInstance.put(`/creditos/${id}/prorroga`, data)
};

export default axiosInstance;
