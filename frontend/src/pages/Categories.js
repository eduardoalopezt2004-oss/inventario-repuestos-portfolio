import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Table, Modal, Form } from 'react-bootstrap';
import { productAPI } from '../services/api';
import { toast } from 'react-toastify';
import QRScanner from '../components/QRScanner';
import ProductQRCode from '../components/ProductQRCode';
import HistorialCambiosProducto from '../components/Inventory/HistorialCambiosProducto';
import useDolarRate from '../hooks/useDolarRate';
import { getStockStatus, StockStatus } from '../utils/stockIndicator';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { enqueue, cacheProductos, getCachedProductos } from '../utils/offlineQueue';
import { normalize } from '../utils/textUtils';
import { coincideCodigoBarras } from '../utils/barcodeUtils';
import { useSuspendGlobalScanner } from '../hooks/useHardwareScanner';

/* Etiquetas y estilos por estado de stock */
const STOCK_BADGE = {
  [StockStatus.SIN_STOCK]: { label: 'Sin stock', cls: 'bg-danger',            style: null },
  [StockStatus.ROJO]:      { label: 'Crítico',   cls: '',                     style: { background: '#fd7e14', color: '#fff' } },
  [StockStatus.AMARILLO]:  { label: 'Bajo',       cls: 'bg-warning text-dark', style: null },
  [StockStatus.VERDE]:     { label: 'Normal',     cls: 'bg-success',           style: null },
};

const STAT_COLORS = {
  normal: '#28a745', bajo: '#ffc107', critico: '#fd7e14', sinStock: '#dc3545',
};

/* Valor a comparar/buscar según el campo único elegido (sirve para la lupa y para el orden) */
const VALOR_CAMPO = {
  nombre:   p => p.nombre || '',
  codigo:   p => p.codigo || '',
  marca:    p => p.marca || '',
  precio:   p => p.precioVenta ?? 0,
  cantidad: p => (p.stockLocal ?? 0) + (p.stockDeposito ?? 0),
};
const CAMPOS_NUMERICOS = ['precio', 'cantidad'];
const PRODUCTOS_POR_PAGINA = 20;

const Categories = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { tasaBs, fuente, formatBs, convertirABs } = useDolarRate();
  const { isOnline, lastSyncAt, refreshCount } = useOnlineStatus();
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [cargadoPorCodigo, setCargadoPorCodigo] = useState(false);
  // Mientras el formulario de producto está abierto, este ya maneja el
  // código escaneado por su cuenta (campo Código con autocompletado) — que
  // no se abra encima el popup global de la pistola.
  useSuspendGlobalScanner(showModal);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    marca: '',
    modelo: '',
    precioCompra: 0,
    precioVenta: 0,
    stockDeposito: 0,
    stockLocal: 0,
    stockMinimoLocal: 5,
    stockMinimoDeposito: 5,
    stockMaximo: '',
    ubicacion: ''
  });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [campo, setCampo] = useState('todos'); // 'todos'|'nombre'|'codigo'|'marca'|'precio'|'cantidad' — sirve para la lupa y para el orden
  const [activeFilter, setActiveFilter] = useState(null); // { ubicacion: 'local'|'deposito', estado: 'normal'|'bajo'|'critico'|'sinStock' }
  const [marcaFiltro, setMarcaFiltro] = useState('');
  const [ordenAlfabetico, setOrdenAlfabetico] = useState(''); // ''|'asc'|'desc' — siempre aplica (usa 'campo' si es texto, si no 'nombre')
  const [ordenPrecio, setOrdenPrecio] = useState(''); // ''|'asc'|'desc'
  const [ordenCantidad, setOrdenCantidad] = useState(''); // ''|'asc'|'desc'
  const [paginaActual, setPaginaActual] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialProducto, setHistorialProducto] = useState(null);

  const handleQRScan = (codigo) => {
    // La cámara suele leer un UPC-A como EAN-13 (agrega un "0" al inicio);
    // la pistola normalmente entrega el UPC-A tal cual. coincideCodigoBarras
    // reconoce ambas formas como el mismo código.
    const producto = categories.find(p => coincideCodigoBarras(p.codigo, codigo));
    if (producto) {
      handleShowModal(producto);
      toast.success(`Producto encontrado: ${producto.nombre}`);
    } else {
      handleShowModal();
      setFormData(prev => ({ ...prev, codigo: codigo }));
      toast.info(`Código "${codigo}" no registrado. Se abrió el formulario para crear un nuevo producto.`);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (lastSyncAt) fetchCategories();
  }, [lastSyncAt]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await productAPI.getAll({ activo: true });
      const data = Array.isArray(response.data) ? response.data : [];
      setCategories(data);
      cacheProductos(data);
    } catch {
      const cached = getCachedProductos();
      if (cached) {
        setCategories(cached.filter(p => p.activo !== false));
        toast.info('Mostrando productos en caché (sin conexión)');
      } else {
        setCategories([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const formVacio = (codigo = '') => ({
    codigo,
    nombre: '',
    descripcion: '',
    marca: '',
    modelo: '',
    precioCompra: 0,
    precioVenta: 0,
    stockDeposito: 0,
    stockLocal: 0,
    stockMinimoLocal: 5,
    stockMinimoDeposito: 5,
    stockMaximo: '',
    ubicacion: ''
  });

  const formDesdeProducto = (category) => ({
    codigo: category.codigo || '',
    nombre: category.nombre || '',
    descripcion: category.descripcion || '',
    marca: category.marca || '',
    modelo: category.modelo || '',
    precioCompra: category.precioCompra || 0,
    precioVenta: category.precioVenta || 0,
    stockDeposito: category.stockDeposito || 0,
    stockLocal: category.stockLocal || 0,
    stockMinimoLocal: category.stockMinimoLocal || 5,
    stockMinimoDeposito: category.stockMinimoDeposito || 5,
    stockMaximo: category.stockMaximo || '',
    ubicacion: category.ubicacion || ''
  });

  const handleShowModal = (category = null) => {
    setCargadoPorCodigo(false);
    if (category) {
      setEditingCategory(category);
      setFormData(formDesdeProducto(category));
    } else {
      setEditingCategory(null);
      setFormData(formVacio());
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setCargadoPorCodigo(false);
  };

  // Si el código tecleado a mano coincide con uno ya existente, cargar sus datos
  // automáticamente (igual que al escanear su QR). Si luego se corrige el código
  // y deja de coincidir, solo se revierte a "nuevo producto" cuando la carga fue
  // automática — así no se pierden datos si se está corrigiendo el código de un
  // producto abierto explícitamente con "Editar".
  const handleCodigoChange = (value) => {
    setFormData(prev => ({ ...prev, codigo: value }));
    const codigoTrim = value.trim();
    const match = codigoTrim ? categories.find(p => coincideCodigoBarras(p.codigo, codigoTrim)) : null;
    if (match) {
      if (!editingCategory || editingCategory._id !== match._id) {
        setEditingCategory(match);
        setCargadoPorCodigo(true);
        setFormData(formDesdeProducto(match));
        toast.info(`Producto encontrado: ${match.nombre} — se cargaron sus datos`);
      }
    } else if (cargadoPorCodigo) {
      setEditingCategory(null);
      setCargadoPorCodigo(false);
      setFormData(formVacio(value));
    }
  };

  // Abrir el formulario automáticamente cuando se llega desde el popup global
  // de la pistola de códigos (ver GlobalScanPopup): ?nuevoCodigo= para crear
  // un producto con ese código precargado, o ?editarCodigo= para editar uno
  // ya existente directamente.
  useEffect(() => {
    if (categories.length === 0) return;
    const params = new URLSearchParams(location.search);
    const nuevoCodigo = params.get('nuevoCodigo');
    const editarCodigo = params.get('editarCodigo');
    if (nuevoCodigo) {
      handleShowModal();
      handleCodigoChange(nuevoCodigo);
      navigate('/categorias', { replace: true });
    } else if (editarCodigo) {
      const match = categories.find(p => coincideCodigoBarras(p.codigo, editarCodigo));
      if (match) handleShowModal(match);
      navigate('/categorias', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones
    if (!formData.nombre || formData.nombre.trim() === '') {
      toast.error('El nombre es requerido');
      return;
    }
    if (formData.precioVenta <= 0) {
      toast.error('El precio de venta debe ser mayor a 0');
      return;
    }

    setSubmitting(true);
    const dataToSend = {
      codigo: formData.codigo.trim(),
      nombre: formData.nombre.trim(),
      descripcion: formData.descripcion ? formData.descripcion.trim() : '',
      marca: formData.marca ? formData.marca.trim() : '',
      modelo: formData.modelo ? formData.modelo.trim() : '',
      precioCompra: parseFloat(formData.precioCompra) || 0,
      precioVenta: parseFloat(formData.precioVenta) || 0,
      stockDeposito: parseInt(formData.stockDeposito) || 0,
      stockLocal: parseInt(formData.stockLocal) || 0,
      stockMinimoLocal: parseInt(formData.stockMinimoLocal) || 5,
      stockMinimoDeposito: parseInt(formData.stockMinimoDeposito) || 5,
      stockMaximo: formData.stockMaximo ? parseInt(formData.stockMaximo) : null,
      ubicacion: formData.ubicacion ? formData.ubicacion.trim() : ''
    };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      if (editingCategory) {
        enqueue('product-update', `/products/${editingCategory._id}`, 'put', dataToSend);
        const cached = getCachedProductos() || [];
        cacheProductos(cached.map(p => p._id === editingCategory._id ? { ...p, ...dataToSend } : p));
        toast.info('Sin conexión — producto actualizado localmente. Se sincronizará al reconectarse.');
      } else {
        const queued = enqueue('product-create', '/products', 'post', dataToSend);
        const cached = getCachedProductos() || [];
        cacheProductos([...cached, { ...dataToSend, _id: queued.tempId, activo: true, _offline: true }]);
        toast.info('Sin conexión — producto guardado localmente. Se sincronizará al reconectarse.');
      }
      refreshCount();
      handleCloseModal();
      fetchCategories();
      setSubmitting(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      if (editingCategory) {
        const response = await productAPI.update(editingCategory._id, dataToSend);
        toast.success(response.data?.message || 'Producto actualizado exitosamente');
      } else {
        const response = await productAPI.create(dataToSend);
        toast.success(response.data?.message || 'Producto creado exitosamente');
      }
      handleCloseModal();
      fetchCategories();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al guardar producto';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (product) => {
    setDeleteTarget(product);
    setShowDeleteModal(true);
  };

  const handleShowHistorial = (product) => {
    setHistorialProducto(product);
    setShowHistorialModal(true);
  };

  const handleCloseHistorial = () => {
    setShowHistorialModal(false);
    setHistorialProducto(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      enqueue('product-delete', `/products/${deleteTarget._id}`, 'delete', null);
      const cached = getCachedProductos() || [];
      cacheProductos(cached.filter(p => p._id !== deleteTarget._id));
      toast.info('Sin conexión — eliminación guardada localmente. Se sincronizará al reconectarse.');
      refreshCount();
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchCategories();
      setDeleting(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      const response = await productAPI.delete(deleteTarget._id);
      toast.success(response.data?.message || 'Producto eliminado exitosamente');
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchCategories();
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Error al eliminar el producto';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  // Estadísticas de stock calculadas del lado del cliente
  const stockStats = useMemo(() => {
    const local    = { normal: 0, bajo: 0, critico: 0, sinStock: 0 };
    const deposito = { normal: 0, bajo: 0, critico: 0, sinStock: 0 };
    const mapStatus = s => {
      if (s === StockStatus.SIN_STOCK) return 'sinStock';
      if (s === StockStatus.ROJO)      return 'critico';
      if (s === StockStatus.AMARILLO)  return 'bajo';
      return 'normal';
    };
    categories.forEach(p => {
      local[mapStatus(getStockStatus(p.stockLocal ?? 0, p.stockMinimoLocal ?? 5, p.stockMaximo ?? null))]++;
      deposito[mapStatus(getStockStatus(p.stockDeposito ?? 0, p.stockMinimoDeposito ?? 5, null))]++;
    });
    return { local, deposito };
  }, [categories]);

  // Marcas únicas presentes en el catálogo, para el filtro por marca
  const marcasDisponibles = useMemo(() => {
    const set = new Set(categories.map(c => c.marca).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [categories]);

  // Lista con búsqueda, filtros (estado de stock, marca) y orden combinados
  const productosFiltrados = useMemo(() => {
    let list = categories;
    if (busqueda) {
      if (campo === 'todos') {
        const tokens = normalize(busqueda).split(/\s+/).filter(Boolean);
        list = list.filter(c => {
          const haystack = `${normalize(c.nombre)} ${normalize(c.codigo)} ${normalize(c.marca)}`;
          return tokens.every(t => haystack.includes(t));
        });
      } else if (CAMPOS_NUMERICOS.includes(campo)) {
        const q = normalize(busqueda);
        list = list.filter(c => VALOR_CAMPO[campo](c).toString().includes(q));
      } else {
        const tokens = normalize(busqueda).split(/\s+/).filter(Boolean);
        list = list.filter(c => {
          const haystack = normalize(VALOR_CAMPO[campo](c));
          return tokens.every(t => haystack.includes(t));
        });
      }
    }
    if (activeFilter) {
      list = list.filter(p => {
        const stockVal = activeFilter.ubicacion === 'deposito' ? (p.stockDeposito ?? 0) : (p.stockLocal ?? 0);
        const minimo   = activeFilter.ubicacion === 'deposito' ? (p.stockMinimoDeposito ?? 5) : (p.stockMinimoLocal ?? 5);
        const s = getStockStatus(stockVal, minimo, activeFilter.ubicacion === 'deposito' ? null : (p.stockMaximo ?? null));
        const mapStatus = st => st === StockStatus.SIN_STOCK ? 'sinStock' : st === StockStatus.ROJO ? 'critico' : st === StockStatus.AMARILLO ? 'bajo' : 'normal';
        return mapStatus(s) === activeFilter.estado;
      });
    }
    if (marcaFiltro) {
      list = list.filter(p => p.marca === marcaFiltro);
    }
    // Los tres órdenes son independientes y siempre aplican; se combinan como
    // criterios de desempate en cascada: precio, luego cantidad, luego alfabético.
    const criterios = [];
    if (ordenPrecio) {
      const dir = ordenPrecio === 'desc' ? -1 : 1;
      criterios.push((a, b) => dir * ((a.precioVenta ?? 0) - (b.precioVenta ?? 0)));
    }
    if (ordenCantidad) {
      const dir = ordenCantidad === 'desc' ? -1 : 1;
      criterios.push((a, b) => dir * (
        ((a.stockLocal ?? 0) + (a.stockDeposito ?? 0)) - ((b.stockLocal ?? 0) + (b.stockDeposito ?? 0))
      ));
    }
    if (ordenAlfabetico) {
      const campoTexto = ['nombre', 'marca', 'codigo'].includes(campo) ? campo : 'nombre';
      const dir = ordenAlfabetico === 'desc' ? -1 : 1;
      criterios.push((a, b) => dir * (VALOR_CAMPO[campoTexto](a) || '').localeCompare(VALOR_CAMPO[campoTexto](b) || '', 'es', { sensitivity: 'base' }));
    }
    if (criterios.length > 0) {
      list = [...list].sort((a, b) => {
        for (const comparar of criterios) {
          const r = comparar(a, b);
          if (r !== 0) return r;
        }
        return 0;
      });
    }
    return list;
  }, [categories, busqueda, campo, activeFilter, marcaFiltro, ordenAlfabetico, ordenPrecio, ordenCantidad]);

  // Volver a la primera página cuando cambian los filtros/búsqueda/orden
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, campo, activeFilter, marcaFiltro, ordenAlfabetico, ordenPrecio, ordenCantidad]);

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA));
  const productosPagina = useMemo(() => {
    const inicio = (paginaActual - 1) * PRODUCTOS_POR_PAGINA;
    return productosFiltrados.slice(inicio, inicio + PRODUCTOS_POR_PAGINA);
  }, [productosFiltrados, paginaActual]);

  // Si se elimina el último producto de la página actual, retroceder a una página válida
  useEffect(() => {
    if (paginaActual > totalPaginas) setPaginaActual(totalPaginas);
  }, [paginaActual, totalPaginas]);

  const handleFilterClick = (ubicacion, estado) => {
    setActiveFilter(prev =>
      prev && prev.ubicacion === ubicacion && prev.estado === estado ? null : { ubicacion, estado }
    );
  };

  return (
    <Container fluid className="px-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-light">Productos</h2>
        </Col>
        <Col xs="auto">
          <Button variant="outline-dark" className="me-2" onClick={() => setShowQRScanner(true)}>
            <i className="fas fa-qrcode me-1"></i> Escanear QR
          </Button>
          <Button variant="dark" onClick={() => handleShowModal()}>
            Nuevo Producto
          </Button>
        </Col>

        {showQRScanner && (
          <QRScanner
            onScan={handleQRScan}
            onClose={() => setShowQRScanner(false)}
          />
        )}
      </Row>

      {/* ── Resumen de estado de stock ── */}
      {categories.length > 0 && (() => {
        const filtroActivo = (ub, est) => activeFilter?.ubicacion === ub && activeFilter?.estado === est;
        const StatBtn = ({ ubicacion, estado, count, label }) => {
          const isActive = filtroActivo(ubicacion, estado);
          const color = STAT_COLORS[estado];
          const btnStyle = isActive
            ? { background: color, borderColor: color, color: '#fff' }
            : { borderColor: color, color: color, background: 'transparent' };
          return (
            <button
              className="btn btn-sm mr-1 mb-1 px-3 py-2"
              style={btnStyle}
              onClick={() => handleFilterClick(ubicacion, estado)}
              title={`Ver productos ${label} en ${ubicacion === 'local' ? 'local' : 'depósito'}`}
            >
              {label}: <strong>{count}</strong>
            </button>
          );
        };
        return (
          <Row className="mb-3 g-2">
            <Col md={6}>
              <div className="card border-0 shadow-sm">
                <div className="card-body py-2 px-3">
                  <small className="text-muted d-block mb-1"><i className="fas fa-store mr-1"></i><strong>Stock Local</strong></small>
                  <StatBtn ubicacion="local" estado="normal"   count={stockStats.local.normal}   label="Normal"    />
                  <StatBtn ubicacion="local" estado="bajo"     count={stockStats.local.bajo}     label="Bajo"      />
                  <StatBtn ubicacion="local" estado="critico"  count={stockStats.local.critico}  label="Crítico"   />
                  <StatBtn ubicacion="local" estado="sinStock" count={stockStats.local.sinStock} label="Sin stock" />
                </div>
              </div>
            </Col>
            <Col md={6}>
              <div className="card border-0 shadow-sm">
                <div className="card-body py-2 px-3">
                  <small className="text-muted d-block mb-1"><i className="fas fa-warehouse mr-1"></i><strong>Stock Depósito</strong></small>
                  <StatBtn ubicacion="deposito" estado="normal"   count={stockStats.deposito.normal}   label="Normal"    />
                  <StatBtn ubicacion="deposito" estado="bajo"     count={stockStats.deposito.bajo}     label="Bajo"      />
                  <StatBtn ubicacion="deposito" estado="critico"  count={stockStats.deposito.critico}  label="Crítico"   />
                  <StatBtn ubicacion="deposito" estado="sinStock" count={stockStats.deposito.sinStock} label="Sin stock" />
                </div>
              </div>
            </Col>
          </Row>
        );
      })()}

      {activeFilter && (
        <div className="alert alert-info py-2 mb-3 d-flex justify-content-between align-items-center">
          <span>
            <i className="fas fa-filter mr-2"></i>
            Mostrando <strong>{productosFiltrados.length}</strong> producto(s) con stock{' '}
            <strong>{activeFilter.estado === 'sinStock' ? 'sin stock' : activeFilter.estado}</strong>{' '}
            en <strong>{activeFilter.ubicacion === 'local' ? 'local' : 'depósito'}</strong>
          </span>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setActiveFilter(null)}>
            <i className="fas fa-times mr-1"></i>Quitar filtro
          </button>
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <div className="mb-3">
            <label className="fw-semibold mb-1" style={{ color: '#2563EB', fontSize: '0.9rem' }}>
              <i className="fas fa-search me-1"></i>
              Buscar Producto
            </label>
            <div
              className="input-group input-group-lg"
              style={{ border: '2px solid #2563EB', borderRadius: '0.5rem', overflow: 'hidden' }}
            >
              <span className="input-group-text bg-white border-0">
                <i className="fas fa-search" style={{ color: '#2563EB' }}></i>
              </span>
              <input
                type="text"
                className="form-control border-0 ps-0"
                placeholder={
                  campo === 'precio' ? 'Escribe el precio a buscar...' :
                  campo === 'cantidad' ? 'Escribe la cantidad a buscar...' :
                  campo === 'nombre' ? 'Escribe el nombre...' :
                  campo === 'codigo' ? 'Escribe el código...' :
                  campo === 'marca' ? 'Escribe la marca...' :
                  'Escribe nombre, código o marca — en cualquier orden...'
                }
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoFocus
              />
              {busqueda && (
                <button className="btn btn-outline-secondary border-0" onClick={() => setBusqueda('')}>
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>

          <Row className="mb-3 g-2">
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-list me-1"></i>Campo
                </Form.Label>
                <Form.Select className="form-control" value={campo} onChange={e => setCampo(e.target.value)}>
                  <option value="todos">Todos los campos</option>
                  <option value="nombre">Nombre</option>
                  <option value="codigo">Código</option>
                  <option value="marca">Marca</option>
                  <option value="precio">Precio</option>
                  <option value="cantidad">Cantidad</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-tag me-1"></i>Marca
                </Form.Label>
                <Form.Select className="form-control" value={marcaFiltro} onChange={e => setMarcaFiltro(e.target.value)}>
                  <option value="">Todas las marcas</option>
                  {marcasDisponibles.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Row className="mb-3 g-2">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-sort-alpha-down me-1"></i>Orden alfabético
                </Form.Label>
                <Form.Select
                  className="form-control"
                  value={ordenAlfabetico}
                  onChange={e => setOrdenAlfabetico(e.target.value)}
                >
                  <option value="">Sin aplicar</option>
                  <option value="asc">A-Z</option>
                  <option value="desc">Z-A</option>
                </Form.Select>
                {!['nombre', 'marca', 'codigo'].includes(campo) && (
                  <Form.Text className="text-muted">Ordena por nombre</Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-dollar-sign me-1"></i>Orden por precio
                </Form.Label>
                <Form.Select
                  className="form-control"
                  value={ordenPrecio}
                  onChange={e => setOrdenPrecio(e.target.value)}
                >
                  <option value="">Sin aplicar</option>
                  <option value="asc">Menor a mayor</option>
                  <option value="desc">Mayor a menor</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-sort-numeric-down me-1"></i>Orden por cantidad
                </Form.Label>
                <Form.Select
                  className="form-control"
                  value={ordenCantidad}
                  onChange={e => setOrdenCantidad(e.target.value)}
                >
                  <option value="">Sin aplicar</option>
                  <option value="asc">Menor a mayor</option>
                  <option value="desc">Mayor a menor</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
              <p className="mt-3 text-muted">Cargando productos...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-5">
              <i className="fas fa-box-open fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">No hay productos registrados</h5>
              <p className="text-muted">Crea tu primer producto usando el botón "Nuevo Producto"</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover style={{ width: 'auto', maxWidth: '100%' }}>
                <thead className="table-light">
                  <tr>
                    <th className="text-nowrap">Código</th>
                    <th>Nombre</th>
                    <th className="text-nowrap">Marca</th>
                    <th className="text-center text-nowrap"><i className="fas fa-warehouse text-info mr-1"></i>Depósito</th>
                    <th className="text-center text-nowrap"><i className="fas fa-store text-primary mr-1"></i>Local</th>
                    <th className="text-nowrap">Estado</th>
                    <th className="text-end text-nowrap"><i className="fas fa-dollar-sign text-success mr-1"></i>Precio Venta</th>
                    <th className="text-nowrap d-none d-md-table-cell">Ubicación</th>
                    <th className="text-center text-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosPagina.map((category) => {
                    const stockLocal    = category.stockLocal    ?? 0;
                    const minimoLocal   = category.stockMinimoLocal ?? 5;
                    const stockDeposito = category.stockDeposito ?? 0;
                    const minimoDeposito = category.stockMinimoDeposito ?? 5;
                    const localStatus    = getStockStatus(stockLocal,    minimoLocal,    category.stockMaximo ?? null);
                    const depositoStatus = getStockStatus(stockDeposito, minimoDeposito, null);
                    const localBadge    = STOCK_BADGE[localStatus];
                    const depositoBadge = STOCK_BADGE[depositoStatus];
                    return (
                    <tr key={category._id}>
                      <td className="text-muted text-nowrap"><small>{category.codigo}</small></td>
                      <td style={{ maxWidth: 260, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        <strong>{category.nombre}</strong>
                      </td>
                      <td className="text-nowrap">{category.marca || '—'}</td>
                      <td className="text-center text-nowrap">
                        <span className={`badge ${depositoBadge.cls}`} style={depositoBadge.style || {}}>{stockDeposito}</span>
                        <small className="text-muted d-block">mín {minimoDeposito}</small>
                      </td>
                      <td className="text-center text-nowrap">
                        <span className={`badge ${localBadge.cls}`} style={localBadge.style || {}}>{stockLocal}</span>
                        <small className="text-muted d-block">mín {minimoLocal}</small>
                      </td>
                      <td className="text-nowrap">
                        <div><small className="text-primary" style={{ fontSize: '0.7rem' }}><i className="fas fa-store mr-1"></i>Local</small><br />
                          <span className={`badge ${localBadge.cls}`} style={localBadge.style || {}}>{localBadge.label}</span>
                        </div>
                        <div className="mt-1"><small className="text-info" style={{ fontSize: '0.7rem' }}><i className="fas fa-warehouse mr-1"></i>Depósito</small><br />
                          <span className={`badge ${depositoBadge.cls}`} style={depositoBadge.style || {}}>{depositoBadge.label}</span>
                        </div>
                      </td>
                      <td className="text-end text-nowrap">
                        <div className="fw-semibold">${category.precioVenta?.toFixed(2) ?? '0.00'}</div>
                        {tasaBs && (
                          <small className="text-info">
                            {formatBs(convertirABs(category.precioVenta ?? 0))}
                          </small>
                        )}
                      </td>
                      <td className="text-nowrap d-none d-md-table-cell">{category.ubicacion || '—'}</td>
                      <td className="text-center text-nowrap">
                        <Button
                          variant="link"
                          className="text-decoration-none p-2"
                          title="Editar"
                          onClick={() => handleShowModal(category)}
                        >
                          <i className="fas fa-edit"></i>
                        </Button>
                        <Button
                          variant="link"
                          className="text-decoration-none p-2"
                          title="Ver historial de cambios"
                          onClick={() => handleShowHistorial(category)}
                        >
                          <i className="fas fa-history"></i>
                        </Button>
                        <Button
                          variant="link"
                          className="text-danger text-decoration-none p-2"
                          title="Eliminar"
                          onClick={() => handleDeleteClick(category)}
                        >
                          <i className="fas fa-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ); })}
                </tbody>
              </Table>
            </div>
          )}

          {!loading && productosFiltrados.length > 0 && (
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center mt-3 pt-3 border-top gap-2">
              <small className="text-muted">
                Mostrando {(paginaActual - 1) * PRODUCTOS_POR_PAGINA + 1}
                –{Math.min(paginaActual * PRODUCTOS_POR_PAGINA, productosFiltrados.length)}{' '}
                de {productosFiltrados.length} producto(s)
              </small>
              {totalPaginas > 1 && (
                <>
                  {/* Móvil: control compacto, siempre entra en una fila */}
                  <div className="d-flex d-sm-none align-items-center gap-2 bg-light rounded-pill px-2 py-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary rounded-pill"
                      onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                    >
                      <i className="fas fa-angle-left"></i> Anterior
                    </button>
                    <span className="fw-semibold text-dark small text-nowrap">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary rounded-pill"
                      onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                    >
                      Siguiente <i className="fas fa-angle-right"></i>
                    </button>
                  </div>

                  {/* Escritorio/tablet: paginación numerada */}
                  <div className="d-none d-sm-flex align-items-center flex-wrap gap-1 bg-light rounded p-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      title="Primera página"
                      onClick={() => setPaginaActual(1)}
                      disabled={paginaActual === 1}
                    >
                      <i className="fas fa-angle-double-left"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      title="Página anterior"
                      onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
                      disabled={paginaActual === 1}
                    >
                      <i className="fas fa-angle-left"></i>
                    </button>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                      .filter(n => n === 1 || n === totalPaginas || Math.abs(n - paginaActual) <= 1)
                      .reduce((acc, n) => {
                        if (acc.length > 0 && n - acc[acc.length - 1] > 1) acc.push('…');
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((n, i) => n === '…' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-muted">…</span>
                      ) : (
                        <button
                          key={n}
                          type="button"
                          className={`btn btn-sm fw-semibold ${n === paginaActual ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setPaginaActual(n)}
                        >
                          {n}
                        </button>
                      ))}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      title="Página siguiente"
                      onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
                      disabled={paginaActual === totalPaginas}
                    >
                      <i className="fas fa-angle-right"></i>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      title="Última página"
                      onClick={() => setPaginaActual(totalPaginas)}
                      disabled={paginaActual === totalPaginas}
                    >
                      <i className="fas fa-angle-double-right"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ── Modal de confirmación de eliminación ── */}
      <Modal show={showDeleteModal} onHide={() => !deleting && setShowDeleteModal(false)} centered>
        <Modal.Header className="border-0 pb-0">
          <Modal.Title style={{ color: '#dc3545', fontSize: 18 }}>
            <i className="fas fa-exclamation-triangle me-2"></i>
            Eliminar producto
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <p className="text-secondary mb-3">
            ¿Estás seguro de que deseas eliminar permanentemente este producto?
          </p>
          {deleteTarget && (
            <div style={{
              background: '#fff5f5', border: '1px solid #f5c6cb',
              borderRadius: 8, padding: '12px 16px'
            }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{deleteTarget.nombre}</div>
              <div style={{ color: '#6c757d', fontSize: 13, marginTop: 2 }}>
                Código: {deleteTarget.codigo}
                {deleteTarget.marca && <span className="ms-3">Marca: {deleteTarget.marca}</span>}
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <span className={`badge ${deleteTarget.stock <= deleteTarget.stockMinimo ? 'bg-danger' : 'bg-success'}`}>
                  Stock: {deleteTarget.stock}
                </span>
              </div>
            </div>
          )}
          <div style={{
            marginTop: 16, padding: '10px 14px', background: '#fff3cd',
            borderRadius: 6, fontSize: 13, color: '#856404'
          }}>
            <i className="fas fa-info-circle me-2"></i>
            Esta acción es permanente y no se puede deshacer.
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? (
              <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Eliminando...</>
            ) : (
              <><i className="fas fa-trash me-2"></i>Eliminar permanentemente</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ── Modal de historial de cambios ── */}
      <Modal show={showHistorialModal} onHide={handleCloseHistorial} size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-light">
            Historial de Cambios{historialProducto && ` — ${historialProducto.nombre}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {historialProducto && (
            <HistorialCambiosProducto productoId={historialProducto._id} />
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseHistorial}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-light">
            {editingCategory ? 'Editar Producto' : 'Nuevo Producto'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Código</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => handleCodigoChange(e.target.value)}
                    onKeyDown={(e) => {
                      // El Enter que envía una pistola escáner no debe enviar
                      // el formulario todavía — solo terminar de escribir el código.
                      if (e.key === 'Enter') e.preventDefault();
                    }}
                    placeholder="Escanea o escribe el código de barras — déjalo vacío para generar uno automático"
                    autoFocus
                  />
                  <Form.Text className="text-muted">
                    {cargadoPorCodigo
                      ? 'Código existente: se cargaron los datos del producto, puedes editarlos.'
                      : 'Si el producto no tiene código de barras, déjalo vacío: el sistema le asignará uno para imprimir. Si escribes el código de un producto ya registrado, se cargarán sus datos automáticamente.'}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Nombre *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                    placeholder="Nombre del producto"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción del producto"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Marca</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="Marca"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Modelo</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    placeholder="Modelo"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-success"><i className="fas fa-dollar-sign mr-1"></i>Precio Compra</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioCompra}
                    onChange={(e) => {
                      const compra = parseFloat(e.target.value);
                      const ventaAuto = (!isNaN(compra) && compra > 0) ? parseFloat((compra * 1.30).toFixed(2)) : formData.precioVenta;
                      setFormData({ ...formData, precioCompra: e.target.value, precioVenta: ventaAuto });
                    }}
                    placeholder="0.00"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-success"><i className="fas fa-dollar-sign mr-1"></i>Precio Venta *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.precioVenta}
                    onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-info"><i className="fas fa-warehouse mr-1"></i>Stock Depósito</Form.Label>
                  <Form.Control
                    type="number" min="0"
                    value={formData.stockDeposito}
                    onChange={(e) => setFormData({ ...formData, stockDeposito: e.target.value })}
                    placeholder="0"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-primary"><i className="fas fa-store mr-1"></i>Stock Local</Form.Label>
                  <Form.Control
                    type="number" min="0"
                    value={formData.stockLocal}
                    onChange={(e) => setFormData({ ...formData, stockLocal: e.target.value })}
                    placeholder="0"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-primary"><i className="fas fa-store mr-1"></i>Mínimo Local</Form.Label>
                  <Form.Control
                    type="number" min="0"
                    value={formData.stockMinimoLocal}
                    onChange={(e) => setFormData({ ...formData, stockMinimoLocal: e.target.value })}
                    placeholder="5"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label className="text-info"><i className="fas fa-warehouse mr-1"></i>Mínimo Depósito</Form.Label>
                  <Form.Control
                    type="number" min="0"
                    value={formData.stockMinimoDeposito}
                    onChange={(e) => setFormData({ ...formData, stockMinimoDeposito: e.target.value })}
                    placeholder="5"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Stock Máximo</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={formData.stockMaximo}
                    onChange={(e) => setFormData({ ...formData, stockMaximo: e.target.value })}
                    placeholder="Opcional"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Ubicación</Form.Label>
              <Form.Control
                type="text"
                value={formData.ubicacion}
                onChange={(e) => setFormData({ ...formData, ubicacion: e.target.value })}
                placeholder="Ej: Estante A-1"
              />
            </Form.Group>

            {editingCategory && (
              <Card className="border-0 bg-light">
                <Card.Body>
                  <h6 className="fw-light text-center mb-2">Código QR del Producto</h6>
                  <ProductQRCode product={editingCategory} />
                </Card.Body>
              </Card>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="dark" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  {editingCategory ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                editingCategory ? 'Actualizar' : 'Crear'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Categories;
