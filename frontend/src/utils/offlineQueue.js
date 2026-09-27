const QUEUE_KEY        = 'lube_offline_queue';
const CACHE_PRODUCTOS  = 'lube_cache_productos';
const CACHE_SALES      = 'lube_cache_sales';
const CACHE_SALE_MAX   = 'lube_cache_sale_max';
const CACHE_MOVEMENTS  = 'lube_cache_movements';
const CACHE_CATEGORIES = 'lube_cache_categories';
const CACHE_DASHBOARD  = 'lube_cache_dashboard';
const CACHE_REPORTS    = 'lube_cache_reports';
const CACHE_CREDITOS   = 'lube_cache_creditos';
const CACHE_USERS      = 'lube_cache_users';
const CACHE_MONITORING = 'lube_cache_monitoring';
const CACHE_AJUSTES    = 'lube_cache_ajustes';
const CACHE_CLIENTES   = 'lube_cache_clientes';

/* ── Queue ── */

let tempIdSeq = 0;

export function enqueue(tipo, url, method, data) {
  const queue = getQueue();
  const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, tipo, url, method, data, timestamp: new Date().toISOString() };
  // A los ítems de creación se les asigna aquí mismo su id temporal, para que
  // más adelante el remapeo (ver OnlineStatusContext) sepa exactamente qué
  // id reemplazar sin tener que adivinarlo entre varias creaciones pendientes.
  if (tipo && tipo.endsWith('-create')) {
    item.tempId = `offline-${Date.now()}${(tempIdSeq++).toString().padStart(4, '0')}`;
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, item]));
  return item;
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

export function removeFromQueue(id) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(getQueue().filter(i => i.id !== id)));
}

export function updateQueueItem(id, patch) {
  try {
    const queue = getQueue().map(i => (i.id === id ? { ...i, ...patch } : i));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/* ── Stock local (actualizar cache inmediatamente en operaciones offline) ── */

export function updateLocalStock(productoId, delta, ubicacion = 'local') {
  try {
    const prods = getCachedProductos();
    if (!prods) return;
    const campo = ubicacion === 'deposito' ? 'stockDeposito' : 'stockLocal';
    const updated = prods.map(p => {
      if (p._id !== productoId) return p;
      return { ...p, [campo]: Math.max(0, (p[campo] || 0) + delta) };
    });
    cacheProductos(updated);
  } catch {}
}

export function updateLocalStockTransferencia(productoId, cantidad) {
  try {
    const prods = getCachedProductos();
    if (!prods) return;
    const updated = prods.map(p => {
      if (p._id !== productoId) return p;
      const cant = Math.abs(cantidad);
      return {
        ...p,
        stockDeposito: Math.max(0, (p.stockDeposito || 0) - cant),
        stockLocal: (p.stockLocal || 0) + cant
      };
    });
    cacheProductos(updated);
  } catch {}
}

/* ── Cache productos ── */

export function cacheProductos(data) {
  try { localStorage.setItem(CACHE_PRODUCTOS, JSON.stringify(data)); } catch {}
}

export function getCachedProductos() {
  try { return JSON.parse(localStorage.getItem(CACHE_PRODUCTOS) || 'null'); } catch { return null; }
}

/* ── Cache ventas ── */

export function cacheSales(data) {
  try { localStorage.setItem(CACHE_SALES, JSON.stringify(data)); } catch {}
}

export function getCachedSales() {
  try { return JSON.parse(localStorage.getItem(CACHE_SALES) || 'null'); } catch { return null; }
}

export function addLocalSale(sale) {
  try {
    const list = getCachedSales() || [];
    localStorage.setItem(CACHE_SALES, JSON.stringify([sale, ...list]));
  } catch {}
}

export function cacheSaleMax(sales) {
  try {
    const max = sales.reduce((m, s) => {
      const n = parseInt((s.numeroVenta || '').replace('VTA-', '') || '0', 10);
      return n > m ? n : m;
    }, 0);
    localStorage.setItem(CACHE_SALE_MAX, String(max));
  } catch {}
}

export function nextOfflineSaleNumber() {
  try {
    const max = parseInt(localStorage.getItem(CACHE_SALE_MAX) || '0', 10);
    const pending = getQueue().filter(i => i.tipo === 'sale').length;
    return `VTA-${String(max + pending + 1).padStart(6, '0')}`;
  } catch { return 'VTA-LOCAL'; }
}

/* ── Cache movimientos (historial) ── */

export function cacheMovements(data) {
  try { localStorage.setItem(CACHE_MOVEMENTS, JSON.stringify(data)); } catch {}
}

export function getCachedMovements() {
  try { return JSON.parse(localStorage.getItem(CACHE_MOVEMENTS) || 'null'); } catch { return null; }
}

export function addLocalMovement(movement) {
  try {
    const list = getCachedMovements() || [];
    localStorage.setItem(CACHE_MOVEMENTS, JSON.stringify([movement, ...list]));
  } catch {}
}

/* ── Cache categorías ── */

export function cacheCategories(data) {
  try { localStorage.setItem(CACHE_CATEGORIES, JSON.stringify(data)); } catch {}
}

export function getCachedCategories() {
  try { return JSON.parse(localStorage.getItem(CACHE_CATEGORIES) || 'null'); } catch { return null; }
}

/* ── Cache dashboard ── */

export function cacheDashboard(data) {
  try { localStorage.setItem(CACHE_DASHBOARD, JSON.stringify({ data, cachedAt: new Date().toISOString() })); } catch {}
}

export function getCachedDashboard() {
  try { return JSON.parse(localStorage.getItem(CACHE_DASHBOARD) || 'null'); } catch { return null; }
}

/* ── Cálculo local de estadísticas (idéntico al backend) ── */

export function computeStatsFromCache() {
  const sales    = getCachedSales()    || [];
  const products = getCachedProductos() || [];

  const now      = new Date();
  const inicioHoy  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const inicioMes  = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioAnio = new Date(now.getFullYear(), 0, 1);

  const completadas = sales.filter(s => s.estado === 'completada' || s._offline);

  const agg = (arr) => ({
    total:    arr.reduce((s, v) => s + (v.total    || 0), 0),
    totalBs:  arr.reduce((s, v) => s + (v.totalBs  || 0), 0),
    cantidad: arr.length
  });

  const ventasHoy  = agg(completadas.filter(s => new Date(s.createdAt) >= inicioHoy));
  const ventasMes  = agg(completadas.filter(s => new Date(s.createdAt) >= inicioMes));
  const ventasAnio = agg(completadas.filter(s => new Date(s.createdAt) >= inicioAnio));

  const activos = products.filter(p => p.activo !== false);
  const productosStockBajo = activos.filter(p => (p.stockLocal || 0) <= (p.stockMinimoLocal || 5)).length;
  const totalProductos     = activos.length;
  const stockTotal = (p) => (p.stockDeposito || 0) + (p.stockLocal || 0);
  const valorInventario    = activos.reduce((s, p) => s + stockTotal(p) * (p.precioVenta || 0), 0);

  const conteo = {};
  completadas.forEach(sale => {
    (sale.items || []).forEach(item => {
      const id     = item.producto?._id || item.producto || 'desconocido';
      const nombre = item.producto?.nombre || 'Desconocido';
      if (!conteo[id]) conteo[id] = { producto: { nombre }, totalVendido: 0, ingresos: 0 };
      conteo[id].totalVendido += item.cantidad || 0;
      conteo[id].ingresos     += item.subtotal  || (item.cantidad * (item.precioUnitario || 0));
    });
  });
  const productosMasVendidos = Object.values(conteo)
    .sort((a, b) => b.totalVendido - a.totalVendido)
    .slice(0, 5);

  return { ventasHoy, ventasMes, ventasAnio, productosStockBajo, totalProductos, valorInventario, productosMasVendidos, _local: true };
}

export function computeReportFromCache(reportType, startDate, endDate) {
  const desde  = startDate ? new Date(startDate)              : new Date(0);
  const hasta  = endDate   ? new Date(endDate + 'T23:59:59.999Z') : new Date();

  const inRango = (d) => { const t = new Date(d); return t >= desde && t <= hasta; };

  switch (reportType) {
    case 'sales':
      return (getCachedSales() || []).filter(s => inRango(s.createdAt));
    case 'inventory':
    case 'movements':
      return (getCachedMovements() || []).filter(m => inRango(m.createdAt));
    case 'categories':
      return getCachedCategories() || [];
    default:
      return [];
  }
}

/* ── Cache créditos ── */

export function cacheCreditos(data) {
  try { localStorage.setItem(CACHE_CREDITOS, JSON.stringify(data)); } catch {}
}

export function getCachedCreditos() {
  try { return JSON.parse(localStorage.getItem(CACHE_CREDITOS) || 'null'); } catch { return null; }
}

export function updateLocalCreditoPago(creditoId, montoExtra) {
  try {
    const creditos = getCachedCreditos();
    if (!creditos) return;
    const updated = creditos.map(c => {
      if (c._id !== creditoId) return c;
      const montoPagado = (c.montoPagado || 0) + montoExtra;
      const pendiente = Math.max(0, (c.montoTotal || 0) - montoPagado);
      return {
        ...c,
        montoPagado,
        montoPendiente: pendiente,
        estadoCredito: pendiente <= 0 ? 'cancelado' : montoPagado > 0 ? 'parcial' : 'pendiente'
      };
    });
    cacheCreditos(updated);
  } catch {}
}

/* ── Cache usuarios ── */

export function cacheUsers(data) {
  try { localStorage.setItem(CACHE_USERS, JSON.stringify(data)); } catch {}
}

export function getCachedUsers() {
  try { return JSON.parse(localStorage.getItem(CACHE_USERS) || 'null'); } catch { return null; }
}

/* ── Cache monitoreo de stock ── */

export function cacheMonitoring(data) {
  try { localStorage.setItem(CACHE_MONITORING, JSON.stringify(data)); } catch {}
}

export function getCachedMonitoring() {
  try { return JSON.parse(localStorage.getItem(CACHE_MONITORING) || 'null'); } catch { return null; }
}

/* ── Cache ajustes pendientes ── */

export function cacheAjustes(data) {
  try { localStorage.setItem(CACHE_AJUSTES, JSON.stringify(data)); } catch {}
}

export function getCachedAjustes() {
  try { return JSON.parse(localStorage.getItem(CACHE_AJUSTES) || 'null'); } catch { return null; }
}

/* ── Cache clientes ── */

export function mergeClientes(nuevos) {
  try {
    const existing = getCachedClientes() || [];
    const map = {};
    [...existing, ...nuevos].forEach(c => { map[c._id] = c; });
    localStorage.setItem(CACHE_CLIENTES, JSON.stringify(Object.values(map)));
  } catch {}
}

export function getCachedClientes() {
  try { return JSON.parse(localStorage.getItem(CACHE_CLIENTES) || 'null'); } catch { return null; }
}

export function updateLocalCreditoProrroga(creditoId, fechaNueva) {
  try {
    const creditos = getCachedCreditos();
    if (!creditos) return;
    const updated = creditos.map(c =>
      c._id !== creditoId ? c : { ...c, fechaVencimiento: fechaNueva }
    );
    cacheCreditos(updated);
  } catch {}
}

/* ── Cache reportes ── */

export function cacheReport(type, data) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_REPORTS) || '{}');
    all[type] = { data, cachedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_REPORTS, JSON.stringify(all));
  } catch {}
}

export function getCachedReport(type) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_REPORTS) || '{}');
    return all[type] || null;
  } catch { return null; }
}

/* ── Descripción legible de operaciones encoladas ── */

function extractIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/[a-fA-F0-9]{24}|offline-\d+/);
  return match ? match[0] : null;
}

function findById(list, id) {
  if (!list || !id) return null;
  return list.find(x => x._id === id) || null;
}

export function describeQueueItem(item) {
  const { tipo, url, data } = item || {};
  const id = extractIdFromUrl(url);
  const shortId = id ? id.slice(-6) : '??????';

  switch (tipo) {
    case 'product-create':
      return `Crear producto: ${data?.nombre || 'sin nombre'}`;
    case 'product-update': {
      const nombre = data?.nombre || findById(getCachedProductos(), id)?.nombre;
      return nombre ? `Actualizar producto: ${nombre}` : `Actualizar producto (ID ${shortId})`;
    }
    case 'product-delete': {
      const nombre = findById(getCachedProductos(), id)?.nombre;
      return nombre ? `Eliminar producto: ${nombre}` : `Eliminar producto (ID ${shortId})`;
    }
    case 'ajuste-aprobar': {
      const nombre = findById(getCachedAjustes(), id)?.producto?.nombre;
      return nombre ? `Aprobar ajuste de inventario: ${nombre}` : `Aprobar ajuste de inventario (ID ${shortId})`;
    }
    case 'user-create':
      return `Crear usuario: ${data?.nombre || data?.email || 'sin nombre'}`;
    case 'user-update': {
      const nombre = data?.nombre || findById(getCachedUsers(), id)?.nombre;
      return nombre ? `Actualizar usuario: ${nombre}` : `Actualizar usuario (ID ${shortId})`;
    }
    case 'user-delete': {
      const nombre = findById(getCachedUsers(), id)?.nombre;
      return nombre ? `Eliminar usuario: ${nombre}` : `Eliminar usuario (ID ${shortId})`;
    }
    case 'pago': {
      const cliente = findById(getCachedCreditos(), id)?.cliente?.nombre;
      return cliente ? `Registrar pago de crédito: ${cliente}` : `Registrar pago de crédito (ID ${shortId})`;
    }
    case 'prorroga': {
      const cliente = findById(getCachedCreditos(), id)?.cliente?.nombre;
      return cliente ? `Prorrogar crédito: ${cliente}` : `Prorrogar crédito (ID ${shortId})`;
    }
    case 'entrada': {
      const nombre = findById(getCachedProductos(), data?.producto)?.nombre;
      return nombre ? `Entrada de inventario: ${nombre} (+${data?.cantidad ?? '?'})` : `Entrada de inventario (${data?.cantidad ?? '?'} unidad(es))`;
    }
    case 'salida': {
      const nombre = findById(getCachedProductos(), data?.producto)?.nombre;
      return nombre ? `Salida de inventario: ${nombre} (-${data?.cantidad ?? '?'})` : `Salida de inventario (${data?.cantidad ?? '?'} unidad(es))`;
    }
    case 'transferencia': {
      const primerItem = data?.items?.[0];
      const nombre = primerItem && findById(getCachedProductos(), primerItem.productoId)?.nombre;
      return nombre ? `Transferencia depósito → local: ${nombre}` : 'Transferencia de inventario depósito → local';
    }
    case 'sale':
      return `Venta a ${data?.cliente?.nombre || 'cliente'} (${data?.items?.length || 0} producto(s))`;
    case 'import':
      return 'Importar datos de respaldo';
    default:
      return `${item?.method?.toUpperCase() || ''} ${url || ''}`.trim();
  }
}
