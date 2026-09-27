import React, { useState, memo } from 'react';
import { toast } from 'react-toastify';
import axios from '../../services/api';
import QRScanner from '../QRScanner';
import ProductQRCode from '../ProductQRCode';
import QuickCreateProductModal from './QuickCreateProductModal';
import useDolarRate from '../../hooks/useDolarRate';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { printFactura, openFacturaWindow } from '../../utils/printFactura';
import { enqueue, updateLocalStock, addLocalMovement } from '../../utils/offlineQueue';
import { coincideCodigoBarras } from '../../utils/barcodeUtils';

const FORM_VACIO = {
  cantidad: '',
  motivo: '',
  metodoPago: 'efectivo',
  numeroDocumento: '',
  observaciones: ''
};

const SalidaInventario = ({ productos, onSuccess }) => {
  const { tasaBs, fuente, formatBs } = useDolarRate();
  const { isOnline, refreshCount } = useOnlineStatus();
  const [usarTasaCustom, setUsarTasaCustom] = useState(false);
  const [tasaCustomInput, setTasaCustomInput] = useState('');
  const tasaEfectiva = usarTasaCustom && parseFloat(tasaCustomInput) > 0
    ? parseFloat(tasaCustomInput)
    : tasaBs;
  const toBs = (usd) => {
    const n = parseFloat(usd);
    if (!tasaEfectiva || isNaN(n) || n <= 0) return null;
    return n * tasaEfectiva;
  };

  /* ── Formulario principal ── */
  const [formData, setFormData] = useState({ producto: '', ...FORM_VACIO });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [advertencias, setAdvertencias] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);

  /* ── QR ── */
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [codigoQR, setCodigoQR] = useState('');

  /* ── Modal post-escaneo ── */
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrProducto, setQrProducto] = useState(null);
  const [qrForm, setQrForm] = useState(FORM_VACIO);
  const [qrErrors, setQrErrors] = useState({});
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAdvertencias, setQrAdvertencias] = useState([]);

  /* ────────────────────── QR handlers ─── */
  const handleQRScan = (codigo) => {
    const producto = productos.find(p => coincideCodigoBarras(p.codigo, codigo));
    if (producto) {
      setQrProducto(producto);
      setQrForm(FORM_VACIO);
      setQrErrors({});
      setQrAdvertencias([]);
      setShowQRModal(true);
    } else {
      setCodigoQR(codigo);
      setShowQuickCreate(true);
    }
  };

  const handleProductCreated = (producto) => {
    setFormData(prev => ({ ...prev, producto: producto._id }));
    setProductoSeleccionado(producto);
    setShowQuickCreate(false);
    if (onSuccess) onSuccess();
    toast.success(`Producto "${producto.nombre}" creado y seleccionado`);
  };

  /* ─────────────────── Formulario principal ─── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (name === 'producto') {
      const p = productos.find(p => p._id === value) || null;
      setProductoSeleccionado(p);
      setAdvertencias([]);
    }
    if (name === 'cantidad' && productoSeleccionado) {
      const cant = parseInt(value);
      const stockLocal = productoSeleccionado.stockLocal || 0;
      const minimoLocal = productoSeleccionado.stockMinimoLocal || 5;
      if (cant > stockLocal) {
        setAdvertencias([`⚠️ La cantidad (${cant}) excede el stock disponible en local (${stockLocal})`]);
      } else if (stockLocal - cant < minimoLocal) {
        setAdvertencias([`⚠️ Quedará por debajo del mínimo local (${minimoLocal}). Stock local resultante: ${stockLocal - cant}`]);
      } else {
        setAdvertencias([]);
      }
    }
  };

  const validar = (data, prod) => {
    const err = {};
    if (!data.cantidad || data.cantidad <= 0) err.cantidad = 'La cantidad debe ser mayor a 0';
    else if (!Number.isInteger(Number(data.cantidad))) err.cantidad = 'Debe ser un número entero';
    else if (prod && parseInt(data.cantidad) > (prod.stockLocal || 0)) err.cantidad = `Stock insuficiente en local. Disponible: ${prod.stockLocal || 0}`;
    if (!data.motivo) err.motivo = 'Seleccione un motivo';
    return err;
  };

  const registrar = async (productoId, data) => {
    return axios.post('/inventory/salida', {
      producto: productoId,
      cantidad: parseInt(data.cantidad),
      motivo: data.motivo,
      metodoPago: data.metodoPago || 'efectivo',
      numeroDocumento: data.numeroDocumento,
      observaciones: data.observaciones,
      tasaBs: tasaEfectiva || null
    });
  };

  const generarComprobante = (prod, data, numeroDoc, win) => {
    const cant = parseInt(data.cantidad);
    const totalUsd = prod.precioVenta ? prod.precioVenta * cant : 0;
    printFactura({
      tipo: 'salida',
      numeroDoc: numeroDoc || data.numeroDocumento || `SAL-${Date.now()}`,
      fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      items: [{
        nombre: prod.nombre,
        codigo: prod.codigo,
        marca: prod.marca,
        cantidad: cant,
        precio: prod.precioVenta || 0
      }],
      totalUsd,
      totalBs: tasaEfectiva ? totalUsd * tasaEfectiva : null,
      tasaEfectiva,
      fuente,
      usarTasaCustom,
      metodoPago: data.metodoPago,
      motivo: data.motivo,
      observaciones: data.observaciones
    }, win);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAdvertencias([]);
    const err = validar(formData, productoSeleccionado);
    if (!formData.producto) err.producto = 'Seleccione un producto';
    setErrors(err);
    if (Object.keys(err).length > 0) { toast.error('Corrija los errores en el formulario'); return; }
    setLoading(true);

    const payload = {
      producto: formData.producto,
      cantidad: parseInt(formData.cantidad),
      motivo: formData.motivo,
      metodoPago: formData.metodoPago || 'efectivo',
      numeroDocumento: formData.numeroDocumento,
      observaciones: formData.observaciones,
      tasaBs: tasaEfectiva || null
    };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      const cant = parseInt(formData.cantidad);
      enqueue('salida', '/inventory/salida', 'post', payload);
      updateLocalStock(formData.producto, -cant, 'local');
      addLocalMovement({
        _id: `offline-${Date.now()}`,
        tipo: 'SALIDA',
        producto: { _id: productoSeleccionado._id, nombre: productoSeleccionado.nombre, codigo: productoSeleccionado.codigo },
        cantidad: cant,
        stockAnterior: productoSeleccionado.stockLocal || 0,
        stockNuevo: Math.max(0, (productoSeleccionado.stockLocal || 0) - cant),
        ubicacion: 'local',
        motivo: formData.motivo,
        numeroDocumento: formData.numeroDocumento,
        observaciones: formData.observaciones,
        createdAt: new Date().toISOString(),
        _offline: true
      });
      refreshCount();
      const tempNum = formData.numeroDocumento || `SAL-${Date.now().toString().slice(-8)}`;
      generarComprobante(productoSeleccionado, formData, tempNum);
      toast.info('Sin conexión — salida guardada localmente. Se sincronizará al reconectarse.');
      setFormData({ producto: '', ...FORM_VACIO });
      setProductoSeleccionado(null);
      setLoading(false);
      if (onSuccess) onSuccess();
      return;
    }

    // ── CON CONEXIÓN ──
    const facturaWin = openFacturaWindow();
    try {
      const response = await registrar(formData.producto, formData);
      let numeroDoc = formData.numeroDocumento;
      if (response.data.errorVenta) {
        toast.warning(`Salida registrada, pero no se pudo crear la venta: ${response.data.errorVenta}`);
      } else if (response.data.advertencias?.length > 0) {
        setAdvertencias(response.data.advertencias);
        toast.warning('Salida registrada con advertencias.');
      } else if (response.data.ventaGenerada) {
        numeroDoc = response.data.ventaGenerada;
        toast.success(`Salida registrada. Venta generada: ${response.data.ventaGenerada}`);
      } else {
        toast.success('Salida registrada exitosamente');
      }
      generarComprobante(productoSeleccionado, formData, numeroDoc, facturaWin);
      setFormData({ producto: '', ...FORM_VACIO });
      setProductoSeleccionado(null);
      if (onSuccess) onSuccess();
    } catch (error) {
      facturaWin?.close();
      const data = error.response?.data;
      toast.error(data?.errors?.[0]?.message || data?.message || 'Error al registrar la salida');
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────── Modal QR ─── */
  const handleQrChange = (e) => {
    const { name, value } = e.target;
    setQrForm(prev => ({ ...prev, [name]: value }));
    if (qrErrors[name]) setQrErrors(prev => ({ ...prev, [name]: '' }));
    if (name === 'cantidad' && qrProducto) {
      const cant = parseInt(value);
      const qrStockLocal = qrProducto.stockLocal || 0;
      const qrMinimoLocal = qrProducto.stockMinimoLocal || 5;
      if (cant > qrStockLocal) {
        setQrAdvertencias([`⚠️ La cantidad (${cant}) excede el stock local (${qrStockLocal})`]);
      } else if (qrStockLocal - cant < qrMinimoLocal) {
        setQrAdvertencias([`⚠️ Quedará por debajo del mínimo local (${qrMinimoLocal}). Stock local resultante: ${qrStockLocal - cant}`]);
      } else {
        setQrAdvertencias([]);
      }
    }
  };

  const handleQrSubmit = async (e) => {
    e.preventDefault();
    setQrAdvertencias([]);
    const err = validar(qrForm, qrProducto);
    setQrErrors(err);
    if (Object.keys(err).length > 0) { toast.error('Corrija los errores'); return; }
    setQrLoading(true);

    const payload = {
      producto: qrProducto._id,
      cantidad: parseInt(qrForm.cantidad),
      motivo: qrForm.motivo,
      metodoPago: qrForm.metodoPago || 'efectivo',
      numeroDocumento: qrForm.numeroDocumento,
      observaciones: qrForm.observaciones,
      tasaBs: tasaEfectiva || null
    };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      const cant = parseInt(qrForm.cantidad);
      enqueue('salida', '/inventory/salida', 'post', payload);
      updateLocalStock(qrProducto._id, -cant, 'local');
      addLocalMovement({
        _id: `offline-${Date.now()}`,
        tipo: 'SALIDA',
        producto: { _id: qrProducto._id, nombre: qrProducto.nombre, codigo: qrProducto.codigo },
        cantidad: cant,
        stockAnterior: qrProducto.stockLocal || 0,
        stockNuevo: Math.max(0, (qrProducto.stockLocal || 0) - cant),
        ubicacion: 'local',
        motivo: qrForm.motivo,
        numeroDocumento: qrForm.numeroDocumento,
        observaciones: qrForm.observaciones,
        createdAt: new Date().toISOString(),
        _offline: true
      });
      refreshCount();
      const tempNum = qrForm.numeroDocumento || `SAL-${Date.now().toString().slice(-8)}`;
      generarComprobante(qrProducto, qrForm, tempNum);
      toast.info('Sin conexión — salida guardada localmente. Se sincronizará al reconectarse.');
      setShowQRModal(false);
      setQrProducto(null);
      setQrLoading(false);
      if (onSuccess) onSuccess();
      return;
    }

    // ── CON CONEXIÓN ──
    const facturaWinQr = openFacturaWindow();
    try {
      const response = await registrar(qrProducto._id, qrForm);
      let numeroDoc = qrForm.numeroDocumento;
      if (response.data.errorVenta) {
        toast.warning(`Salida registrada, pero no se pudo crear la venta: ${response.data.errorVenta}`);
      } else if (response.data.ventaGenerada) {
        numeroDoc = response.data.ventaGenerada;
        toast.success(`Salida de ${qrProducto.nombre} registrada. Venta generada: ${response.data.ventaGenerada}`);
      } else {
        toast.success(`Salida registrada: ${qrProducto.nombre}`);
      }
      generarComprobante(qrProducto, qrForm, numeroDoc, facturaWinQr);
      setShowQRModal(false);
      setQrProducto(null);
      if (onSuccess) onSuccess();
    } catch (error) {
      facturaWinQr?.close();
      const data = error.response?.data;
      toast.error(data?.errors?.[0]?.message || data?.message || 'Error al registrar la salida');
    } finally {
      setQrLoading(false);
    }
  };

  const totalVenta = (prod, cant) =>
    prod && cant ? (prod.precioVenta * parseInt(cant)).toFixed(2) : null;

  /* ══════════════════════════════════ RENDER ══════════════════════════════════ */
  return (
    <>
    <div className="row">
      {/* ── Formulario principal ── */}
      <div className="col-md-8">
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header bg-danger">
              <h3 className="card-title">
                <i className="fas fa-arrow-up mr-2"></i>
                Registrar Salida de Productos
              </h3>
            </div>
            <div className="card-body">

              {/* Selector de tasa de cambio */}
              <div className="d-flex align-items-center flex-wrap gap-2 p-2 mb-3 rounded border bg-light" style={{ fontSize: 13 }}>
                <span className="fw-semibold text-secondary">
                  <i className="fas fa-exchange-alt mr-1"></i> Tasa Bs:
                </span>
                <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="radio" checked={!usarTasaCustom} onChange={() => setUsarTasaCustom(false)} />
                  <span style={{ marginLeft: 4 }}>BCV{tasaBs ? ` — Bs. ${tasaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : ' (cargando...)'}</span>
                </label>
                <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input type="radio" checked={usarTasaCustom} onChange={() => setUsarTasaCustom(true)} />
                  <span style={{ marginLeft: 4 }}>Personalizada:</span>
                </label>
                {usarTasaCustom && (
                  <input
                    type="number"
                    value={tasaCustomInput}
                    onChange={e => setTasaCustomInput(e.target.value)}
                    placeholder="Bs. por USD"
                    min="0" step="0.01"
                    style={{ width: 140, padding: '3px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ced4da' }}
                  />
                )}
                {tasaEfectiva && (
                  <span style={{ marginLeft: 'auto', color: '#666' }}>
                    1 USD = <strong>Bs. {tasaEfectiva.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong>
                    {usarTasaCustom && <span className="text-warning ml-1" style={{ fontSize: 11 }}>(personalizada)</span>}
                  </span>
                )}
              </div>

              {/* Producto */}
              <div className="form-group">
                <label>Producto <span className="text-danger">*</span></label>
                <div className="input-group">
                  <select name="producto"
                    className={`form-control ${errors.producto ? 'is-invalid' : ''}`}
                    value={formData.producto} onChange={handleChange} disabled={loading}>
                    <option value="">Seleccione un producto...</option>
                    {(productos || []).filter(p => p.activo && p.stock > 0).map(p => (
                      <option key={p._id} value={p._id}>
                        {p.codigo} - {p.nombre} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                  <div className="input-group-append">
                    <button type="button" className="btn btn-outline-danger"
                      onClick={() => setShowQRScanner(true)} disabled={loading}>
                      <i className="fas fa-qrcode"></i> Escanear QR
                    </button>
                  </div>
                  {errors.producto && <div className="invalid-feedback">{errors.producto}</div>}
                </div>
              </div>

              {showQRScanner && (
                <QRScanner onScan={handleQRScan} onClose={() => setShowQRScanner(false)} />
              )}

              <div className="form-group">
                <label>Cantidad <span className="text-danger">*</span></label>
                <input type="number" name="cantidad"
                  className={`form-control ${errors.cantidad ? 'is-invalid' : ''}`}
                  value={formData.cantidad} onChange={handleChange}
                  placeholder="Ej: 10" disabled={loading || !productoSeleccionado}
                  min="1" step="1" max={productoSeleccionado?.stockLocal || undefined} />
                {errors.cantidad && <div className="invalid-feedback">{errors.cantidad}</div>}
                {productoSeleccionado && (
                  <small className="form-text text-muted">Disponible en local: {productoSeleccionado.stockLocal || 0} unidades</small>
                )}
              </div>

              <div className="form-group">
                <label>Motivo <span className="text-danger">*</span></label>
                <select name="motivo"
                  className={`form-control ${errors.motivo ? 'is-invalid' : ''}`}
                  value={formData.motivo} onChange={handleChange} disabled={loading}>
                  <option value="">Seleccione un motivo...</option>
                  <option value="Venta a cliente">Venta a cliente</option>
                  <option value="Uso interno del taller">Uso interno del taller</option>
                  <option value="Reparación garantía">Reparación de garantía</option>
                  <option value="Devolución a proveedor">Devolución a proveedor</option>
                  <option value="Donación">Donación</option>
                  <option value="Otro motivo">Otro (especificar en observaciones)</option>
                </select>
                {errors.motivo && <div className="invalid-feedback">{errors.motivo}</div>}
              </div>

              <div className="form-group">
                <label>Método de Pago</label>
                <select name="metodoPago" className="form-control"
                  value={formData.metodoPago} onChange={handleChange} disabled={loading}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="divisa">Divisa</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <div className="form-group">
                <label>Número de Documento (Opcional)</label>
                <input type="text" name="numeroDocumento" className="form-control"
                  value={formData.numeroDocumento} onChange={handleChange}
                  placeholder="Ej: VENTA-001234" disabled={loading} />
                <small className="form-text text-muted">Número de venta, orden de trabajo, etc.</small>
              </div>

              <div className="form-group">
                <label>Observaciones (Opcional)</label>
                <textarea name="observaciones" className="form-control"
                  value={formData.observaciones} onChange={handleChange}
                  placeholder="Información adicional sobre la salida"
                  rows="3" disabled={loading} maxLength="1000" />
              </div>

              {advertencias.length > 0 && (
                <div className="alert alert-warning">
                  <h5><i className="icon fas fa-exclamation-triangle"></i> Advertencias:</h5>
                  <ul className="mb-0">{advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button type="submit" className="btn btn-danger"
                disabled={loading || !productoSeleccionado}>
                {loading
                  ? <><i className="fas fa-spinner fa-spin mr-2"></i>Registrando...</>
                  : <><i className="fas fa-save mr-2"></i>Registrar Salida</>}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Panel info ── */}
      <div className="col-md-4">
        <div className="card">
          <div className="card-header bg-info">
            <h3 className="card-title"><i className="fas fa-info-circle mr-2"></i>Información del Producto</h3>
          </div>
          <div className="card-body">
            {productoSeleccionado ? (
              <>
                <p><strong>Código:</strong> {productoSeleccionado.codigo}</p>
                <p><strong>Nombre:</strong> {productoSeleccionado.nombre}</p>
                <p>
                  <strong>Stock Local:</strong>{' '}
                  <span className={(productoSeleccionado.stockLocal || 0) <= (productoSeleccionado.stockMinimoLocal || 5) ? 'text-danger' : 'text-success'}>
                    {productoSeleccionado.stockLocal || 0}
                  </span>
                </p>
                <p><strong>Stock Depósito:</strong> {productoSeleccionado.stockDeposito || 0}</p>
                <p><strong>Mínimo Local:</strong> {productoSeleccionado.stockMinimoLocal || 5}</p>
                {productoSeleccionado.precioVenta != null && (
                  <p>
                    <strong>Precio Venta:</strong> ${productoSeleccionado.precioVenta.toFixed(2)}
                    {tasaEfectiva && (
                      <span style={{ display: 'block', marginTop: 4, fontSize: 15, fontWeight: 600 }} className="text-secondary">
                        {formatBs(toBs(productoSeleccionado.precioVenta))}
                        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }} className="text-muted">
                          {usarTasaCustom ? '(personalizada)' : fuente}
                        </span>
                      </span>
                    )}
                  </p>
                )}
                {formData.cantidad && (
                  <>
                    <hr />
                    <p className={(productoSeleccionado.stockLocal || 0) - parseInt(formData.cantidad || 0) < (productoSeleccionado.stockMinimoLocal || 5)
                      ? 'text-danger font-weight-bold' : 'text-success font-weight-bold'}>
                      <strong>Nuevo Stock Local:</strong> {(productoSeleccionado.stockLocal || 0) - parseInt(formData.cantidad || 0)}
                    </p>
                    {tasaEfectiva && productoSeleccionado.precioVenta != null && (
                      <p className="text-info">
                        <strong>Total:</strong>{' '}
                        ${totalVenta(productoSeleccionado, formData.cantidad)}
                        {' '}= {formatBs(toBs(parseFloat(totalVenta(productoSeleccionado, formData.cantidad))))}
                      </p>
                    )}
                  </>
                )}
                <hr />
                <ProductQRCode product={productoSeleccionado} />
              </>
            ) : (
              <p className="text-muted">Seleccione un producto para ver su información</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-warning">
            <h3 className="card-title"><i className="fas fa-shield-alt mr-2"></i>Validaciones Activas</h3>
          </div>
          <div className="card-body">
            <ul className="list-unstyled">
              <li><i className="fas fa-check text-success mr-2"></i> Verificación de stock suficiente</li>
              <li><i className="fas fa-check text-success mr-2"></i> Alerta de stock mínimo</li>
              <li><i className="fas fa-check text-success mr-2"></i> Detección de duplicados</li>
              <li><i className="fas fa-check text-success mr-2"></i> Validación de cantidades</li>
              <li><i className="fas fa-check text-success mr-2"></i> Prevención de errores</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    {/* ══════════════ MODAL POST-ESCANEO QR ══════════════ */}
    {showQRModal && qrProducto && (
      <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                <i className="fas fa-qrcode mr-2"></i>
                Registrar Salida — Producto escaneado
              </h5>
              <button type="button" className="close text-white"
                onClick={() => setShowQRModal(false)}>
                <span>&times;</span>
              </button>
            </div>

            <form onSubmit={handleQrSubmit}>
              <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '65vh' }}>

                {/* Info del producto escaneado */}
                <div className="alert alert-danger d-flex align-items-start mb-4">
                  <i className="fas fa-box mr-3 mt-1"></i>
                  <div>
                    <strong>{qrProducto.codigo}</strong> — {qrProducto.nombre}
                    <br />
                    <small>
                      Stock disponible: <strong>{qrProducto.stock}</strong>
                      {qrProducto.precioVenta != null && (
                        <span className="ml-3">
                          Precio venta: <strong>${qrProducto.precioVenta.toFixed(2)}</strong>
                          {tasaEfectiva && (
                            <span className="ml-1 text-dark">
                              ({formatBs(toBs(qrProducto.precioVenta))})
                            </span>
                          )}
                        </span>
                      )}
                    </small>
                  </div>
                </div>

                {/* Cantidad */}
                <div className="form-group">
                  <label>Cantidad <span className="text-danger">*</span></label>
                  <input type="number" name="cantidad"
                    className={`form-control ${qrErrors.cantidad ? 'is-invalid' : ''}`}
                    value={qrForm.cantidad} onChange={handleQrChange}
                    placeholder="Ej: 5" min="1" step="1"
                    max={qrProducto.stock} autoFocus />
                  {qrErrors.cantidad && <div className="invalid-feedback">{qrErrors.cantidad}</div>}
                  <small className="form-text text-muted">Disponible: {qrProducto.stock} unidades</small>
                  {tasaEfectiva && qrForm.cantidad && qrProducto.precioVenta != null && (
                    <small className="form-text text-info">
                      Total: ${(qrProducto.precioVenta * parseInt(qrForm.cantidad)).toFixed(2)}
                      {' '}= {formatBs(toBs(qrProducto.precioVenta * parseInt(qrForm.cantidad)))}
                    </small>
                  )}
                </div>

                {/* Motivo */}
                <div className="form-group">
                  <label>Motivo <span className="text-danger">*</span></label>
                  <select name="motivo"
                    className={`form-control ${qrErrors.motivo ? 'is-invalid' : ''}`}
                    value={qrForm.motivo} onChange={handleQrChange}>
                    <option value="">Seleccione un motivo...</option>
                    <option value="Venta a cliente">Venta a cliente</option>
                    <option value="Uso interno del taller">Uso interno del taller</option>
                    <option value="Reparación garantía">Reparación de garantía</option>
                    <option value="Devolución a proveedor">Devolución a proveedor</option>
                    <option value="Donación">Donación</option>
                    <option value="Otro motivo">Otro (especificar en observaciones)</option>
                  </select>
                  {qrErrors.motivo && <div className="invalid-feedback">{qrErrors.motivo}</div>}
                </div>

                {/* Método de pago */}
                <div className="form-group">
                  <label>Método de Pago</label>
                  <select name="metodoPago" className="form-control"
                    value={qrForm.metodoPago} onChange={handleQrChange}>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="pago_movil">Pago Móvil</option>
                    <option value="divisa">Divisa</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {/* Número de documento */}
                <div className="form-group">
                  <label>Número de Documento (Opcional)</label>
                  <input type="text" name="numeroDocumento" className="form-control"
                    value={qrForm.numeroDocumento} onChange={handleQrChange}
                    placeholder="Ej: VENTA-001234" />
                  <small className="form-text text-muted">Número de venta, orden de trabajo, etc.</small>
                </div>

                {/* Observaciones */}
                <div className="form-group">
                  <label>Observaciones (Opcional)</label>
                  <textarea name="observaciones" className="form-control"
                    value={qrForm.observaciones} onChange={handleQrChange}
                    placeholder="Información adicional sobre la salida"
                    rows="2" maxLength="1000" />
                </div>

                {qrAdvertencias.length > 0 && (
                  <div className="alert alert-warning">
                    <h5><i className="icon fas fa-exclamation-triangle"></i> Advertencias:</h5>
                    <ul className="mb-0">{qrAdvertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowQRModal(false)} disabled={qrLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={qrLoading}>
                  {qrLoading
                    ? <><i className="fas fa-spinner fa-spin mr-2"></i>Registrando...</>
                    : <><i className="fas fa-save mr-2"></i>Registrar Salida</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

    {showQuickCreate && (
      <QuickCreateProductModal
        codigo={codigoQR}
        onCreated={handleProductCreated}
        onClose={() => setShowQuickCreate(false)}
      />
    )}

    </>

  );
};

export default memo(SalidaInventario);
