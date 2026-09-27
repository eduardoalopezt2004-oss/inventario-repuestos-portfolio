import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Badge } from 'react-bootstrap';
import { saleAPI, productAPI } from '../services/api';
import api from '../services/api';
import { toast } from 'react-toastify';
import QRScanner from '../components/QRScanner';
import useDolarRate from '../hooks/useDolarRate';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import AuthContext from '../context/AuthContext';
import { printFactura, openFacturaWindow } from '../utils/printFactura';
import {
  enqueue, cacheProductos, getCachedProductos,
  cacheSales, getCachedSales, cacheSaleMax, nextOfflineSaleNumber,
  updateLocalStock, addLocalSale, mergeClientes, getCachedClientes
} from '../utils/offlineQueue';
import { normalize } from '../utils/textUtils';
import { coincideCodigoBarras } from '../utils/barcodeUtils';

const CLIENTE_VACIO = { nombre: '', cedula: '', telefono: '' };

const Sales = () => {
  const { user } = useContext(AuthContext);
  const [sales, setSales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [busquedaProducto, setBusquedaProducto] = useState('');

  // Autocompletado de cliente
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [campoActivo, setCampoActivo] = useState(null); // 'nombre' | 'cedula'
  const searchTimeout = useRef(null);
  const dropdownRef = useRef(null);

  const clienteNombreRef = useRef(null);
  const clienteCedulaRef = useRef(null);

  const { tasaBs, fuente, loading: loadingTasa, formatBs } = useDolarRate();
  const { isOnline, lastSyncAt, refreshCount } = useOnlineStatus();

  const [usarTasaCustom, setUsarTasaCustom] = useState(false);
  const [tasaCustomInput, setTasaCustomInput] = useState('');
  const tasaEfectiva = usarTasaCustom && parseFloat(tasaCustomInput) > 0
    ? parseFloat(tasaCustomInput)
    : tasaBs;
  const toBs = (usd) => tasaEfectiva ? parseFloat(usd) * tasaEfectiva : null;

  const defaultFechaVenc = () => { const d = new Date(); d.setDate(d.getDate() + 15); return d.toISOString().split('T')[0]; };
  const [esCredito, setEsCredito] = useState(false);
  const [abonoInicial, setAbonoInicial] = useState('');
  const [fechaVencimientoCredito, setFechaVencimientoCredito] = useState('');

  // ── Cerrar dropdown al hacer clic fuera ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMostrarSugerencias(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Búsqueda de clientes con debounce de 200 ms ──────────────────────────
  const buscarClientes = useCallback(async (valor) => {
    if (!valor || valor.trim().length < 1) {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    if (isOnline) {
      try {
        const res = await api.get(`/clientes/search?q=${encodeURIComponent(valor.trim())}`);
        const data = res.data || [];
        setSugerencias(data);
        setMostrarSugerencias(data.length > 0);
        if (data.length > 0) mergeClientes(data);
      } catch {
        buscarOffline(valor);
      }
    } else {
      buscarOffline(valor);
    }
  }, [isOnline]);

  const buscarOffline = (valor) => {
    const cache = getCachedClientes() || [];
    const q = normalize(valor.trim());
    const matches = cache.filter(c =>
      normalize(c.nombre).includes(q) || normalize(c.cedula).includes(q)
    ).slice(0, 8);
    setSugerencias(matches);
    setMostrarSugerencias(matches.length > 0);
  };

  const handleClienteChange = (field, value) => {
    setCliente(prev => ({ ...prev, [field]: value }));
    setCampoActivo(field);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => buscarClientes(value), 200);
  };

  const seleccionarCliente = (c) => {
    setCliente({ nombre: c.nombre || '', cedula: c.cedula || '', telefono: c.telefono || '' });
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  // ── QR ───────────────────────────────────────────────────────────────────
  const handleQRScan = (codigo) => {
    const producto = productos.find(p => coincideCodigoBarras(p.codigo, codigo));
    if (producto) { addToCart(producto); toast.success(`Producto agregado: ${producto.nombre}`); }
    else toast.error(`No se encontró un producto con código: ${codigo}`);
  };

  useEffect(() => { fetchSales(); fetchProductos(); }, []);
  useEffect(() => { if (lastSyncAt) { fetchSales(); fetchProductos(); } }, [lastSyncAt]);

  const fetchSales = async () => {
    try {
      const response = await saleAPI.getAll({ limit: 500 });
      setSales(response.data);
      cacheSales(response.data);
      cacheSaleMax(response.data);
    } catch {
      const cached = getCachedSales();
      if (cached) { setSales(cached); toast.info('Mostrando ventas en caché (sin conexión)'); }
      else toast.error('Error al cargar ventas');
    }
  };

  const fetchProductos = async () => {
    try {
      const response = await productAPI.getAll({ activo: true });
      const data = Array.isArray(response.data) ? response.data : [];
      setProductos(data);
      cacheProductos(data);
    } catch {
      const cached = getCachedProductos();
      if (cached) { setProductos(cached); toast.info('Mostrando productos en caché (sin conexión)'); }
      else toast.error('Error al cargar productos');
    }
  };

  const handleShowModal = () => {
    setShowModal(true);
    setCart([]);
    setCliente(CLIENTE_VACIO);
    setMetodoPago('efectivo');
    setUsarTasaCustom(false);
    setTasaCustomInput('');
    setEsCredito(false);
    setAbonoInicial('');
    setFechaVencimientoCredito(defaultFechaVenc());
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  const handleCloseModal = () => { setShowModal(false); setBusquedaProducto(''); setSugerencias([]); setMostrarSugerencias(false); };

  // ── Carrito ──────────────────────────────────────────────────────────────
  const stockDisponible = (producto) => producto.stockLocal ?? 0;

  const addToCart = (producto) => {
    const stock = stockDisponible(producto);
    const existing = cart.find(item => item.producto === producto._id);
    if (existing) {
      if (existing.cantidad >= stock) { toast.warning('Stock insuficiente'); return; }
      setCart(cart.map(item =>
        item.producto === producto._id ? { ...item, cantidad: item.cantidad + 1 } : item
      ));
    } else {
      if (stock < 1) { toast.warning('Sin stock en local'); return; }
      setCart([...cart, { producto: producto._id, cantidad: 1, nombre: producto.nombre, codigo: producto.codigo, marca: producto.marca, precio: producto.precioVenta }]);
    }
  };

  const removeFromCart = (productoId) => setCart(cart.filter(item => item.producto !== productoId));

  const updateQuantity = (productoId, cantidad) => {
    const producto = productos.find(p => p._id === productoId);
    if (!producto) return;
    if (cantidad > stockDisponible(producto)) { toast.warning('Stock insuficiente'); return; }
    if (cantidad < 1) { removeFromCart(productoId); return; }
    setCart(cart.map(item => item.producto === productoId ? { ...item, cantidad: parseInt(cantidad) } : item));
  };

  const updatePrice = (productoId, precio) => {
    if (precio !== '' && parseFloat(precio) < 0) return;
    setCart(cart.map(item => item.producto === productoId ? { ...item, precio } : item));
  };

  const calculateTotal = () => cart.reduce((total, item) => total + (parseFloat(item.precio) || 0) * item.cantidad, 0);
  const buildFacturaItems = (cartItems) =>
    cartItems.map(item => ({ nombre: item.nombre, codigo: item.codigo, marca: item.marca, cantidad: item.cantidad, precio: parseFloat(item.precio) }));

  // ── Envío ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) { toast.error('Agregue productos a la venta'); return; }

    const invalidPrice = cart.find(item => item.precio === '' || isNaN(parseFloat(item.precio)) || parseFloat(item.precio) <= 0);
    if (invalidPrice) { toast.error(`El precio de "${invalidPrice.nombre}" no es válido`); return; }

    if (!cliente.nombre.trim()) { toast.error('El nombre del cliente es obligatorio'); clienteNombreRef.current?.focus(); return; }
    if (!cliente.cedula.trim()) { toast.error('La cédula del cliente es obligatoria'); clienteCedulaRef.current?.focus(); return; }

    const totalUsd = calculateTotal();
    const abono = esCredito ? parseFloat(abonoInicial || 0) : 0;
    const debeFactura = !esCredito;
    const montoFactura = totalUsd;

    const saleData = {
      items: cart.map(item => ({ producto: item.producto, cantidad: item.cantidad, precioUnitario: parseFloat(item.precio) })),
      cliente,
      metodoPago,
      tasaBs: tasaEfectiva || null,
      esCredito,
      ...(esCredito && { abonoInicial: abono, fechaVencimientoCredito })
    };

    // ── SIN CONEXIÓN ──────────────────────────────────────────────────────
    if (!isOnline) {
      const tempNum = nextOfflineSaleNumber();
      enqueue('sale', '/sales', 'post', saleData);
      cart.forEach(item => updateLocalStock(item.producto, -item.cantidad));
      const localSale = {
        _id: tempNum, numeroVenta: tempNum,
        createdAt: new Date().toISOString(),
        vendedor: { nombre: user?.nombre },
        cliente, metodoPago,
        total: totalUsd,
        totalBs: tasaEfectiva ? totalUsd * tasaEfectiva : null,
        tasaBs: tasaEfectiva,
        estado: 'completada', esCredito, _offline: true,
        items: cart.map(item => ({
          producto: { _id: item.producto, nombre: item.nombre, codigo: item.codigo, marca: item.marca },
          cantidad: item.cantidad, precioUnitario: item.precio
        }))
      };
      addLocalSale(localSale);
      setSales(prev => [localSale, ...prev]);
      refreshCount();
      if (debeFactura) {
        printFactura({
          tipo: esCredito ? 'abono' : 'venta',
          numeroDoc: tempNum,
          fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          vendedor: user?.nombre, cliente,
          items: buildFacturaItems(cart),
          totalUsd: montoFactura,
          totalBs: tasaEfectiva ? montoFactura * tasaEfectiva : null,
          tasaEfectiva, fuente, usarTasaCustom, metodoPago
        });
      }
      toast.info('Sin conexión — venta guardada localmente. Se sincronizará al reconectarse.');
      handleCloseModal();
      return;
    }

    // ── CON CONEXIÓN ─────────────────────────────────────────────────────
    const facturaWin = debeFactura ? openFacturaWindow() : null;
    try {
      const response = await saleAPI.create(saleData);
      const sale = response.data;
      toast.success(`Venta ${sale.numeroVenta ? sale.numeroVenta + ' ' : ''}registrada${esCredito ? ' (crédito)' : ''}.`);
      if (debeFactura) {
        printFactura({
          tipo: esCredito ? 'abono' : 'venta',
          numeroDoc: sale.numeroVenta,
          fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          vendedor: sale.vendedor?.nombre || user?.nombre, cliente,
          items: buildFacturaItems(cart),
          totalUsd: montoFactura,
          totalBs: tasaEfectiva ? montoFactura * tasaEfectiva : null,
          tasaEfectiva, fuente, usarTasaCustom, metodoPago
        }, facturaWin);
      }
      handleCloseModal();
      fetchSales();
      fetchProductos();
    } catch (error) {
      facturaWin?.close();
      toast.error(error.response?.data?.message || 'Error al registrar venta');
    }
  };

  const descargarFacturaSale = (sale) => {
    printFactura({
      tipo: 'venta',
      numeroDoc: sale.numeroVenta,
      fecha: new Date(sale.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      vendedor: sale.vendedor?.nombre,
      cliente: sale.cliente,
      items: (sale.items || []).map(item => ({
        nombre: item.producto?.nombre || 'Producto',
        codigo: item.producto?.codigo,
        marca: item.producto?.marca,
        cantidad: item.cantidad,
        precio: item.precioUnitario
      })),
      totalUsd: sale.total, totalBs: sale.totalBs,
      tasaEfectiva: sale.tasaBs || tasaEfectiva,
      fuente: sale.tasaBs ? 'BCV' : (usarTasaCustom ? 'personalizada' : fuente),
      usarTasaCustom: false,
      metodoPago: sale.metodoPago
    });
  };

  const totalUsd = calculateTotal();
  const totalBs = toBs(totalUsd);

  return (
    <Container fluid className="px-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-light">
            Ventas
            {!loadingTasa && tasaEfectiva && (
              <span className="ms-3 fs-6 text-muted fw-normal">
                1 USD = {formatBs(tasaEfectiva)} {usarTasaCustom ? '(personalizada)' : `(${fuente})`}
              </span>
            )}
          </h2>
        </Col>
        <Col xs="auto" className="d-flex align-items-center gap-3">
          {!loadingTasa && tasaBs && (
            <span className="text-muted small">
              <i className="fas fa-dollar-sign me-1"></i>
              1 USD = <strong>Bs. {tasaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
              <span className="ms-1 text-secondary">({fuente})</span>
            </span>
          )}
          <Button variant="dark" onClick={handleShowModal}>Nueva Venta</Button>
        </Col>
      </Row>

      <Card className="border-0 shadow-sm">
        <Card.Body>
          <div className="table-responsive">
            <Table hover>
              <thead className="table-light">
                <tr>
                  <th>N° Venta</th>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th>Cliente</th>
                  <th className="text-end">Total (USD)</th>
                  <th className="text-end">Total (Bs)</th>
                  <th>Método Pago</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale._id}>
                    <td className="text-muted">{sale.numeroVenta}</td>
                    <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td>{sale.vendedor?.nombre}</td>
                    <td>{sale.cliente?.nombre || 'N/A'}</td>
                    <td className="text-end">${sale.total?.toLocaleString()}</td>
                    <td className="text-end text-secondary small">{sale.totalBs ? formatBs(sale.totalBs) : '—'}</td>
                    <td>{{ efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', pago_movil: 'Pago Móvil', divisa: 'Divisa', otro: 'Otro' }[sale.metodoPago] || sale.metodoPago}</td>
                    <td>
                      <Badge bg={sale.estado === 'completada' ? 'success' : sale.estado === 'cancelada' ? 'danger' : 'warning'}>{sale.estado}</Badge>
                      {sale.esCredito && <Badge bg="warning" text="dark" className="ms-1">crédito</Badge>}
                    </td>
                    <td>
                      <Button variant="outline-secondary" size="sm" title="Descargar factura" onClick={() => descargarFacturaSale(sale)}>
                        <i className="fas fa-file-invoice"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={handleCloseModal} size="xl">
        <Modal.Header closeButton>
          <Modal.Title className="fw-light">Nueva Venta</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body style={{ background: 'white' }}>
            {/* Tasa de cambio */}
            <div className="d-flex align-items-center flex-wrap gap-3 p-2 mb-3 rounded border bg-light" style={{ fontSize: 13 }}>
              <span className="fw-semibold text-secondary"><i className="fas fa-exchange-alt me-1"></i> Tasa Bs:</span>
              <Form.Check type="radio" id="sales-tasa-bcv"
                label={loadingTasa ? 'BCV (cargando...)' : `BCV${tasaBs ? ` — Bs. ${tasaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : ' (sin datos)'}`}
                checked={!usarTasaCustom} onChange={() => setUsarTasaCustom(false)} style={{ marginBottom: 0 }} />
              <Form.Check type="radio" id="sales-tasa-custom" label="Personalizada:"
                checked={usarTasaCustom} onChange={() => setUsarTasaCustom(true)} style={{ marginBottom: 0 }} />
              {usarTasaCustom && (
                <Form.Control type="number" value={tasaCustomInput} onChange={e => setTasaCustomInput(e.target.value)}
                  placeholder="Bs. por USD" size="sm" style={{ width: 140 }} min="0" step="0.01" />
              )}
              {tasaEfectiva && (
                <span className="ms-auto text-muted small">
                  1 USD = <strong>Bs. {tasaEfectiva.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                  {usarTasaCustom && <span className="ms-1 text-warning">(personalizada)</span>}
                </span>
              )}
            </div>

            <Row>
              {/* ── Columna izquierda: productos ── */}
              <Col md={7}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-light mb-0">Productos Disponibles</h6>
                  <Button variant="outline-dark" size="sm" onClick={() => setShowQRScanner(true)}>
                    <i className="fas fa-qrcode me-1"></i> Escanear QR
                  </Button>
                </div>

                <div className="input-group mb-2">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="fas fa-search text-muted"></i>
                  </span>
                  <Form.Control type="text" className="border-start-0 ps-0"
                    placeholder="Buscar por nombre, código o marca..."
                    value={busquedaProducto} onChange={e => setBusquedaProducto(e.target.value)} size="sm" />
                  {busquedaProducto && (
                    <Button variant="outline-secondary" size="sm" onClick={() => setBusquedaProducto('')}>
                      <i className="fas fa-times"></i>
                    </Button>
                  )}
                </div>

                {showQRScanner && <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />}

                <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  <Table hover size="sm">
                    <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#f8f9fa' }}>
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th className="text-end">Precio USD</th>
                        <th className="text-end">Precio Bs</th>
                        <th className="text-end">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productos.filter(p => {
                        if (!busquedaProducto) return true;
                        const q = normalize(busquedaProducto);
                        return normalize(p.nombre).includes(q) || normalize(p.codigo).includes(q) || normalize(p.marca).includes(q);
                      }).map((producto) => {
                        const stock = stockDisponible(producto);
                        const enCarrito = cart.find(i => i.producto === producto._id);
                        const sinStock = stock < 1;
                        return (
                          <tr
                            key={producto._id}
                            onClick={() => !sinStock && addToCart(producto)}
                            style={{ cursor: sinStock ? 'not-allowed' : 'pointer', opacity: sinStock ? 0.45 : 1, background: enCarrito ? '#f0fff4' : undefined }}
                            title={sinStock ? 'Sin stock en local' : 'Clic para agregar al carrito'}
                          >
                            <td className="text-muted small">{producto.codigo}</td>
                            <td>
                              {producto.nombre}
                              {enCarrito && <Badge bg="success" className="ms-1" style={{ fontSize: '0.65rem' }}>{enCarrito.cantidad}</Badge>}
                            </td>
                            <td className="text-end">${(producto.precioVenta ?? 0).toLocaleString()}</td>
                            <td className="text-end text-secondary small">{tasaEfectiva ? formatBs(toBs(producto.precioVenta ?? 0)) : '—'}</td>
                            <td className="text-end">
                              <span className={stock < 1 ? 'text-danger' : stock <= 5 ? 'text-warning fw-semibold' : ''}>{stock}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </Col>

              {/* ── Columna derecha: carrito + cliente ── */}
              <Col md={5}>
                <h6 className="fw-light mb-3">Carrito de Venta</h6>

                <Card className="mb-3 border-0 bg-light">
                  <Card.Body>
                    {cart.length === 0 ? (
                      <p className="text-muted text-center mb-0 small">Haz clic en un producto para agregarlo</p>
                    ) : (
                      <div>
                        {cart.map((item) => (
                          <div key={item.producto} className="mb-3 pb-2 border-bottom">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <small className="fw-semibold flex-grow-1">{item.nombre}</small>
                              <Button variant="link" size="sm" className="text-danger p-0 ms-2" onClick={() => removeFromCart(item.producto)}>
                                <i className="fas fa-times"></i>
                              </Button>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                              <div style={{ flex: 1 }}>
                                <small className="text-muted d-block mb-1">Precio ($)</small>
                                <Form.Control type="number" size="sm" value={item.precio}
                                  onChange={(e) => updatePrice(item.producto, e.target.value)} min="0" step="0.01" />
                                {tasaEfectiva && <small className="text-secondary">{formatBs(toBs(item.precio))}</small>}
                              </div>
                              <div style={{ width: '70px' }}>
                                <small className="text-muted d-block mb-1">Cant.</small>
                                <Form.Control type="number" size="sm" value={item.cantidad}
                                  onChange={(e) => updateQuantity(item.producto, e.target.value)} min="1" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card.Body>
                </Card>

                <div className="text-end mb-3">
                  <h5 className="mb-1">Total: <strong>${totalUsd.toLocaleString()}</strong></h5>
                  {tasaEfectiva && totalBs != null && (
                    <div className="text-secondary">
                      <strong>{formatBs(totalBs)}</strong>
                      {usarTasaCustom && <span className="ms-1 text-warning small">(personalizada)</span>}
                    </div>
                  )}
                </div>

                {/* ── Datos del cliente con autocompletado ── */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <Form.Label className="mb-1 fw-semibold" style={{ fontSize: 13 }}>Cliente</Form.Label>

                  <Form.Group className="mb-2">
                    <Form.Control
                      ref={clienteNombreRef}
                      type="text" size="sm" placeholder="Nombre *"
                      value={cliente.nombre}
                      autoComplete="off"
                      onChange={e => handleClienteChange('nombre', e.target.value)}
                      onFocus={() => { setCampoActivo('nombre'); if (cliente.nombre.length >= 1) buscarClientes(cliente.nombre); }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Control
                      ref={clienteCedulaRef}
                      type="text" size="sm" placeholder="Cédula *"
                      value={cliente.cedula}
                      autoComplete="off"
                      onChange={e => handleClienteChange('cedula', e.target.value)}
                      onFocus={() => { setCampoActivo('cedula'); if (cliente.cedula.length >= 1) buscarClientes(cliente.cedula); }}
                    />
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Control
                      type="text" size="sm" placeholder="Teléfono (opcional)"
                      value={cliente.telefono}
                      onChange={e => setCliente(prev => ({ ...prev, telefono: e.target.value }))}
                    />
                  </Form.Group>

                  {/* Dropdown de sugerencias */}
                  {mostrarSugerencias && sugerencias.length > 0 && (
                    <div style={{
                      position: 'absolute', top: campoActivo === 'nombre' ? '28px' : '62px',
                      left: 0, right: 0, zIndex: 1050,
                      background: '#fff', border: '1px solid #dee2e6',
                      borderRadius: '0.375rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      maxHeight: '200px', overflowY: 'auto'
                    }}>
                      {sugerencias.map((c, i) => (
                        <div
                          key={c._id || i}
                          onMouseDown={(e) => { e.preventDefault(); seleccionarCliente(c); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nombre}</div>
                          <div style={{ fontSize: 11, color: '#6c757d' }}>
                            {c.cedula && <span className="me-2">CI: {c.cedula}</span>}
                            {c.telefono && <span>Tel: {c.telefono}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Método de pago */}
                <Form.Group className="mb-3">
                  <Form.Label>Método de Pago</Form.Label>
                  <Form.Select size="sm" value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="divisa">Divisa</option>
                    <option value="otro">Otro</option>
                  </Form.Select>
                </Form.Group>

                {/* Modo crédito */}
                <div className="p-2 rounded border mb-2" style={{ background: esCredito ? '#fffbeb' : '#f8f9fa' }}>
                  <div className="d-flex gap-3 mb-2">
                    <Form.Check type="radio" id="modo-contado" label="Contado" checked={!esCredito} onChange={() => setEsCredito(false)} />
                    <Form.Check type="radio" id="modo-credito" label="Crédito" checked={esCredito} onChange={() => setEsCredito(true)} />
                  </div>
                  {esCredito && (
                    <>
                      <Form.Group className="mb-2">
                        <Form.Label style={{ fontSize: 12 }}>Abono inicial ($) <span className="text-muted">(0 = sin abono)</span></Form.Label>
                        <Form.Control type="number" size="sm" value={abonoInicial}
                          onChange={e => setAbonoInicial(e.target.value)} placeholder="0.00" min="0" step="0.01" max={totalUsd} />
                        {abonoInicial && tasaEfectiva && <small className="text-muted">≈ {formatBs(parseFloat(abonoInicial) * tasaEfectiva)}</small>}
                      </Form.Group>
                      <Form.Group>
                        <Form.Label style={{ fontSize: 12 }}>Fecha vencimiento</Form.Label>
                        <Form.Control type="date" size="sm" value={fechaVencimientoCredito}
                          onChange={e => setFechaVencimientoCredito(e.target.value)}
                          min={new Date().toISOString().split('T')[0]} />
                      </Form.Group>
                    </>
                  )}
                </div>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>Cancelar</Button>
            <Button variant={esCredito ? 'warning' : 'dark'} type="submit">
              <i className={`fas fa-${esCredito ? 'hand-holding-usd' : 'check'} me-1`}></i>
              {esCredito ? 'Registrar Crédito' : 'Registrar Venta'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Sales;
