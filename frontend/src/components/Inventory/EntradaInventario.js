import React, { useState, memo } from 'react';
import { toast } from 'react-toastify';
import axios from '../../services/api';
import QRScanner from '../QRScanner';
import ProductQRCode from '../ProductQRCode';
import useDolarRate from '../../hooks/useDolarRate';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { enqueue, updateLocalStock, addLocalMovement } from '../../utils/offlineQueue';
import { coincideCodigoBarras } from '../../utils/barcodeUtils';

const UBICACION_LABEL = { deposito: 'Depósito', local: 'Local' };

/* ─── Estado vacío del formulario de entrada ─── */
const FORM_VACIO = {
  cantidad: '',
  precioUnitario: '',
  precioVenta: '',
  motivo: '',
  numeroDocumento: '',
  proveedor: '',
  observaciones: '',
  ubicacion: 'deposito'
};

const EntradaInventario = ({ productos, categorias, onSuccess }) => {
  const { tasaBs, fuente, convertirABs, formatBs, loading: tasaLoading, error: tasaError } = useDolarRate();
  const { isOnline, refreshCount } = useOnlineStatus();

  /* ── Formulario principal (sin QR) ── */
  const [formData, setFormData] = useState({ producto: '', ...FORM_VACIO });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [advertencias, setAdvertencias] = useState([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [marcaEdit, setMarcaEdit] = useState('');

  /* ── QR ── */
  const [showQRScanner, setShowQRScanner] = useState(false);

  /* ── Modal post-escaneo ── */
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrProducto, setQrProducto] = useState(null);
  const [qrEsNuevo, setQrEsNuevo] = useState(false);
  const [qrCodigoNuevo, setQrCodigoNuevo] = useState('');
  const [qrNombre, setQrNombre] = useState('');
  const [qrForm, setQrForm] = useState(FORM_VACIO);
  const [qrErrors, setQrErrors] = useState({});
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAdvertencias, setQrAdvertencias] = useState([]);

  /* ─── Obtiene proveedor y documento de la última entrada del producto ─── */
  const fetchUltimaEntrada = async (productoId) => {
    try {
      const res = await axios.get(`/inventory/producto/${productoId}/historial`, { params: { limite: 20 } });
      const ultima = (res.data || []).find(m => m.tipo === 'ENTRADA' && !m.cancelado);
      if (ultima) return { proveedor: ultima.proveedor || '', numeroDocumento: ultima.numeroDocumento || '' };
    } catch {}
    return null;
  };

  /* ─────────────────────────────────────── QR handlers ─── */
  const handleQRScan = async (codigo) => {
    setShowQRScanner(false);
    const producto = productos.find(p => coincideCodigoBarras(p.codigo, codigo));
    if (producto) {
      setQrProducto(producto);
      setQrEsNuevo(false);
      setQrCodigoNuevo('');
      setQrNombre('');
      const ultima = await fetchUltimaEntrada(producto._id);
      setQrForm({
        ...FORM_VACIO,
        precioUnitario: producto.precioCompra ? String(producto.precioCompra) : '',
        motivo: 'Compra de mercancía',
        proveedor: ultima?.proveedor || '',
        numeroDocumento: ultima?.numeroDocumento || ''
      });
    } else {
      setQrProducto(null);
      setQrEsNuevo(true);
      setQrCodigoNuevo(codigo);
      setQrNombre('');
      setQrForm({ ...FORM_VACIO, motivo: 'Compra de mercancía' });
    }
    setQrErrors({});
    setQrAdvertencias([]);
    setShowQRModal(true);
  };

  /* ─────────────────────────── Formulario principal ─── */
  const handleChange = async (e) => {
    const { name, value } = e.target;
    if (name === 'precioUnitario') {
      const compra = parseFloat(value);
      const ventaAuto = (!isNaN(compra) && compra > 0) ? parseFloat((compra * 1.30).toFixed(2)) : '';
      setFormData(prev => ({ ...prev, precioUnitario: value, precioVenta: ventaAuto !== '' ? ventaAuto : prev.precioVenta }));
      if (errors.precioUnitario) setErrors(prev => ({ ...prev, precioUnitario: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    if (name === 'producto') {
      const prod = productos.find(p => p._id === value) || null;
      setProductoSeleccionado(prod);
      setMarcaEdit(prod?.marca || '');
      if (value) {
        const ultima = await fetchUltimaEntrada(value);
        if (ultima) {
          setFormData(prev => ({
            ...prev,
            proveedor: ultima.proveedor,
            numeroDocumento: ultima.numeroDocumento
          }));
        }
      }
    }
  };

  const validar = (data, productoObj) => {
    const err = {};
    if (!data.cantidad || data.cantidad <= 0) err.cantidad = 'La cantidad debe ser mayor a 0';
    else if (!Number.isInteger(Number(data.cantidad))) err.cantidad = 'Debe ser un número entero';
    else if (data.cantidad > 10000) err.cantidad = 'No puede exceder 10.000 unidades';
    if (!data.precioUnitario || data.precioUnitario <= 0) err.precioUnitario = 'El precio debe ser mayor a 0';
    if (!data.precioVenta || data.precioVenta <= 0) err.precioVenta = 'El precio de venta debe ser mayor a 0';
    if (!data.motivo || data.motivo.trim().length < 5) err.motivo = 'Mínimo 5 caracteres';
    if (!data.numeroDocumento || !data.numeroDocumento.trim()) err.numeroDocumento = 'Requerido';
    if (!data.proveedor || data.proveedor.trim().length < 3) err.proveedor = 'Mínimo 3 caracteres';
    return err;
  };

  const registrar = async (productoId, data) => {
    return axios.post('/inventory/entrada', {
      producto: productoId,
      cantidad: parseInt(data.cantidad),
      precioUnitario: parseFloat(data.precioUnitario),
      precioVenta: parseFloat(data.precioVenta),
      motivo: data.motivo,
      numeroDocumento: data.numeroDocumento,
      proveedor: data.proveedor,
      observaciones: data.observaciones,
      ubicacion: data.ubicacion || 'deposito',
      tasaBs: tasaBs || null
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAdvertencias([]);
    const err = validar(formData, productoSeleccionado);
    if (!formData.producto) err.producto = 'Seleccione un producto';
    setErrors(err);
    if (Object.keys(err).length > 0) { toast.error('Corrija los errores en el formulario'); return; }
    setLoading(true);

    const ubicacion = formData.ubicacion || 'deposito';
    const payload = {
      producto: formData.producto,
      cantidad: parseInt(formData.cantidad),
      precioUnitario: parseFloat(formData.precioUnitario),
      precioVenta: parseFloat(formData.precioVenta),
      motivo: formData.motivo,
      numeroDocumento: formData.numeroDocumento,
      proveedor: formData.proveedor,
      observaciones: formData.observaciones,
      ubicacion,
      tasaBs: tasaBs || null
    };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      const cant = parseInt(formData.cantidad);
      const campoStock = ubicacion === 'deposito' ? 'stockDeposito' : 'stockLocal';
      enqueue('entrada', '/inventory/entrada', 'post', payload);
      updateLocalStock(formData.producto, cant, ubicacion);
      addLocalMovement({
        _id: `offline-${Date.now()}`,
        tipo: 'ENTRADA',
        producto: { _id: productoSeleccionado._id, nombre: productoSeleccionado.nombre, codigo: productoSeleccionado.codigo },
        cantidad: cant,
        stockAnterior: productoSeleccionado[campoStock] || 0,
        stockNuevo: (productoSeleccionado[campoStock] || 0) + cant,
        ubicacion,
        motivo: formData.motivo,
        numeroDocumento: formData.numeroDocumento,
        proveedor: formData.proveedor,
        observaciones: formData.observaciones,
        createdAt: new Date().toISOString(),
        _offline: true
      });
      refreshCount();
      toast.info('Sin conexión — entrada guardada localmente. Se sincronizará al reconectarse.');
      setFormData({ producto: '', ...FORM_VACIO });
      setProductoSeleccionado(null);
      setLoading(false);
      if (onSuccess) onSuccess();
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      const response = await registrar(formData.producto, formData);
      if (response.data.advertencias?.length > 0) {
        setAdvertencias(response.data.advertencias);
        toast.warning('Entrada registrada con advertencias.');
      } else {
        toast.success('Entrada registrada exitosamente');
      }
      setFormData({ producto: '', ...FORM_VACIO });
      setProductoSeleccionado(null);
      if (onSuccess) onSuccess();
    } catch (error) {
      const data = error.response?.data;
      toast.error(data?.errors?.[0]?.message || data?.message || 'Error al registrar la entrada');
    } finally {
      setLoading(false);
    }
  };

  const actualizarMarca = async () => {
    if (!productoSeleccionado) return;
    const marca = marcaEdit.trim();
    if (marca && marca.length < 2) { toast.error('La marca debe tener al menos 2 caracteres'); return; }
    try {
      await axios.put(`/products/${productoSeleccionado._id}`, { marca: marca || null });
      setProductoSeleccionado(prev => ({ ...prev, marca }));
      toast.success('Marca actualizada');
      if (onSuccess) onSuccess();
    } catch {
      toast.error('Error al actualizar la marca');
    }
  };

  /* ─────────────────────────── Modal QR ─── */
  const handleQrChange = (e) => {
    const { name, value } = e.target;
    if (name === 'precioUnitario') {
      const compra = parseFloat(value);
      const ventaAuto = (!isNaN(compra) && compra > 0) ? parseFloat((compra * 1.30).toFixed(2)) : '';
      setQrForm(prev => ({ ...prev, precioUnitario: value, precioVenta: ventaAuto !== '' ? ventaAuto : prev.precioVenta }));
      if (qrErrors.precioUnitario) setQrErrors(prev => ({ ...prev, precioUnitario: '' }));
      return;
    }
    setQrForm(prev => ({ ...prev, [name]: value }));
    if (qrErrors[name]) setQrErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleQrSubmit = async (e) => {
    e.preventDefault();
    setQrAdvertencias([]);
    const err = validar(qrForm, qrProducto);
    if (qrEsNuevo && (!qrNombre || qrNombre.trim().length < 3)) {
      err.qrNombre = 'Mínimo 3 caracteres';
    }
    setQrErrors(err);
    if (Object.keys(err).length > 0) { toast.error('Corrija los errores'); return; }

    // Producto nuevo requiere conexión (necesita crear el producto primero)
    if (!isOnline && qrEsNuevo) {
      toast.warning('Conexión requerida para crear un producto nuevo.');
      return;
    }

    setQrLoading(true);

    // ── SIN CONEXIÓN (producto existente) ──
    if (!isOnline) {
      const cant = parseInt(qrForm.cantidad);
      const qrPayload = {
        producto: qrProducto._id,
        cantidad: cant,
        precioUnitario: parseFloat(qrForm.precioUnitario),
        precioVenta: parseFloat(qrForm.precioVenta),
        motivo: qrForm.motivo,
        numeroDocumento: qrForm.numeroDocumento,
        proveedor: qrForm.proveedor,
        observaciones: qrForm.observaciones,
        tasaBs: tasaBs || null
      };
      enqueue('entrada', '/inventory/entrada', 'post', qrPayload);
      updateLocalStock(qrProducto._id, cant);
      addLocalMovement({
        _id: `offline-${Date.now()}`,
        tipo: 'ENTRADA',
        producto: { _id: qrProducto._id, nombre: qrProducto.nombre, codigo: qrProducto.codigo },
        cantidad: cant,
        stockAnterior: qrProducto.stock,
        stockNuevo: (qrProducto.stock || 0) + cant,
        motivo: qrForm.motivo,
        numeroDocumento: qrForm.numeroDocumento,
        proveedor: qrForm.proveedor,
        createdAt: new Date().toISOString(),
        _offline: true
      });
      refreshCount();
      toast.info(`Sin conexión — entrada de "${qrProducto.nombre}" guardada localmente.`);
      setShowQRModal(false);
      setQrProducto(null);
      setQrEsNuevo(false);
      setQrLoading(false);
      if (onSuccess) onSuccess();
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      let productoId = qrProducto?._id;
      if (qrEsNuevo) {
        const res = await axios.post('/products', {
          codigo: qrCodigoNuevo,
          nombre: qrNombre.trim(),
          precioCompra: parseFloat(qrForm.precioUnitario),
          precioVenta: parseFloat(qrForm.precioVenta),
          stock: 0,
          stockMinimo: 0,
          stockMaximo: 0,
          activo: true
        });
        productoId = res.data._id;
      }
      const response = await registrar(productoId, qrForm);
      if (response.data.advertencias?.length > 0) {
        setQrAdvertencias(response.data.advertencias);
        toast.warning('Entrada registrada con advertencias.');
      } else {
        toast.success(`Entrada registrada: ${qrEsNuevo ? qrNombre : qrProducto.nombre}`);
      }
      setShowQRModal(false);
      setQrProducto(null);
      setQrEsNuevo(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      const data = error.response?.data;
      toast.error(data?.errors?.[0]?.message || data?.message || 'Error al registrar la entrada');
    } finally {
      setQrLoading(false);
    }
  };

  /* ─── helpers display ─── */
  const costoUsd = (d) => d.cantidad && d.precioUnitario
    ? (parseFloat(d.cantidad) * parseFloat(d.precioUnitario)).toFixed(2)
    : '0.00';

  const showBs = (valorUsd) => {
    const n = parseFloat(valorUsd);
    if (!tasaBs || isNaN(n) || n <= 0) return null;
    return (
      <small className="text-info d-block">
        = {formatBs(convertirABs(n))}
        {fuente && <span className="text-muted ml-1">({fuente})</span>}
      </small>
    );
  };

  /* ══════════════════════════════════ RENDER ══════════════════════════════════ */
  return (
    <>
    <div className="row">
      {/* ── Formulario principal ── */}
      <div className="col-md-8">
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header bg-success">
              <h3 className="card-title">
                <i className="fas fa-arrow-down mr-2"></i>
                Registrar Entrada de Productos
              </h3>
            </div>
            <div className="card-body">

              {/* Producto */}
              <div className="form-group">
                <label>Producto <span className="text-danger">*</span></label>
                <div className="input-group">
                  <select
                    name="producto"
                    className={`form-control ${errors.producto ? 'is-invalid' : ''}`}
                    value={formData.producto}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Seleccione un producto...</option>
                    {(productos || []).filter(p => p.activo).map(p => (
                      <option key={p._id} value={p._id}>
                        {p.codigo} - {p.nombre} (Stock: {p.stock})
                      </option>
                    ))}
                  </select>
                  <div className="input-group-append">
                    <button type="button" className="btn btn-outline-success"
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

              {/* Ubicación destino */}
              <div className="form-group">
                <label>Destino <span className="text-danger">*</span></label>
                <div className="d-flex" style={{ gap: 12 }}>
                  {['deposito', 'local'].map(ub => (
                    <label key={ub} className={`btn btn-sm ${formData.ubicacion === ub ? (ub === 'deposito' ? 'btn-primary' : 'btn-success') : 'btn-outline-secondary'}`}
                      style={{ cursor: 'pointer', marginBottom: 0 }}>
                      <input type="radio" name="ubicacion" value={ub} checked={formData.ubicacion === ub}
                        onChange={handleChange} style={{ display: 'none' }} />
                      <i className={`fas ${ub === 'deposito' ? 'fa-warehouse' : 'fa-store'} mr-1`}></i>
                      {UBICACION_LABEL[ub]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="row">
                <div className="col-md-3">
                  <div className="form-group">
                    <label>Cantidad <span className="text-danger">*</span></label>
                    <input type="number" name="cantidad"
                      className={`form-control ${errors.cantidad ? 'is-invalid' : ''}`}
                      value={formData.cantidad} onChange={handleChange}
                      placeholder="Ej: 100" disabled={loading} min="1" step="1" />
                    {errors.cantidad && <div className="invalid-feedback">{errors.cantidad}</div>}
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-group">
                    <label>Precio Compra ($) <span className="text-danger">*</span></label>
                    <input type="number" name="precioUnitario"
                      className={`form-control ${errors.precioUnitario ? 'is-invalid' : ''}`}
                      value={formData.precioUnitario} onChange={handleChange}
                      placeholder="0.00" disabled={loading} min="0" step="0.01" />
                    {errors.precioUnitario && <div className="invalid-feedback">{errors.precioUnitario}</div>}
                    {showBs(formData.precioUnitario)}
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-group">
                    <label>Precio Venta ($) <span className="text-danger">*</span></label>
                    <input type="number" name="precioVenta"
                      className={`form-control ${errors.precioVenta ? 'is-invalid' : ''}`}
                      value={formData.precioVenta} onChange={handleChange}
                      placeholder="0.00" disabled={loading} min="0" step="0.01" />
                    {errors.precioVenta && <div className="invalid-feedback">{errors.precioVenta}</div>}
                    {showBs(formData.precioVenta)}
                  </div>
                </div>

                <div className="col-md-3">
                  <div className="form-group">
                    <label>Costo Total ($)</label>
                    <input type="text" className="form-control"
                      value={`$${costoUsd(formData)}`} disabled readOnly />
                    {showBs(costoUsd(formData))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Proveedor <span className="text-danger">*</span></label>
                <input type="text" name="proveedor"
                  className={`form-control ${errors.proveedor ? 'is-invalid' : ''}`}
                  value={formData.proveedor} onChange={handleChange}
                  placeholder="Nombre del proveedor" disabled={loading} />
                {errors.proveedor && <div className="invalid-feedback">{errors.proveedor}</div>}
              </div>

              <div className="form-group">
                <label>Número de Documento (Factura/Remito) <span className="text-danger">*</span></label>
                <input type="text" name="numeroDocumento"
                  className={`form-control ${errors.numeroDocumento ? 'is-invalid' : ''}`}
                  value={formData.numeroDocumento} onChange={handleChange}
                  placeholder="Ej: FAC-001234" disabled={loading} />
                {errors.numeroDocumento && <div className="invalid-feedback">{errors.numeroDocumento}</div>}
              </div>

              <div className="form-group">
                <label>Motivo <span className="text-danger">*</span></label>
                <textarea name="motivo"
                  className={`form-control ${errors.motivo ? 'is-invalid' : ''}`}
                  value={formData.motivo} onChange={handleChange}
                  placeholder="Describa el motivo de la entrada (mínimo 5 caracteres)"
                  rows="2" disabled={loading} maxLength="500" />
                {errors.motivo && <div className="invalid-feedback">{errors.motivo}</div>}
                <small className="form-text text-muted">{formData.motivo.length}/500</small>
              </div>

              <div className="form-group">
                <label>Observaciones (Opcional)</label>
                <textarea name="observaciones" className="form-control"
                  value={formData.observaciones} onChange={handleChange}
                  placeholder="Información adicional" rows="2" disabled={loading} maxLength="1000" />
              </div>

              {advertencias.length > 0 && (
                <div className="alert alert-warning">
                  <h5><i className="icon fas fa-exclamation-triangle"></i> Advertencias:</h5>
                  <ul className="mb-0">{advertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading
                  ? <><i className="fas fa-spinner fa-spin mr-2"></i>Registrando...</>
                  : <><i className="fas fa-save mr-2"></i>Registrar Entrada</>}
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
                <div className="form-group mb-2">
                  <label className="mb-1"><strong>Marca:</strong></label>
                  <div className="input-group input-group-sm">
                    <input type="text" className="form-control" value={marcaEdit}
                      onChange={e => setMarcaEdit(e.target.value)}
                      placeholder="Ej: Castrol, Inca..." minLength="2" maxLength="50" />
                    <div className="input-group-append">
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={actualizarMarca}>
                        <i className="fas fa-save"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <p><strong>Stock Depósito:</strong> {productoSeleccionado.stockDeposito ?? 0}</p>
                <p><strong>Stock Local:</strong> {productoSeleccionado.stockLocal ?? 0}</p>
                <p>
                  <strong>Precio de Compra:</strong> ${productoSeleccionado.precioCompra?.toFixed(2) || '0.00'}
                  {tasaBs && (
                    <small className="text-info ml-2">
                      ({formatBs(convertirABs(productoSeleccionado.precioCompra || 0))})
                    </small>
                  )}
                </p>
                {formData.cantidad && (
                  <p className="text-success">
                    <strong>Nuevo Stock {UBICACION_LABEL[formData.ubicacion || 'deposito']}:</strong>{' '}
                    {((formData.ubicacion === 'local' ? productoSeleccionado.stockLocal : productoSeleccionado.stockDeposito) || 0) + parseInt(formData.cantidad || 0)}
                  </p>
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
              <li><i className="fas fa-check text-success mr-2"></i> Verificación de stock</li>
              <li><i className="fas fa-check text-success mr-2"></i> Validación de cantidades</li>
              <li><i className="fas fa-check text-success mr-2"></i> Detección de duplicados</li>
              <li><i className="fas fa-check text-success mr-2"></i> Verificación de precios</li>
              <li><i className="fas fa-check text-success mr-2"></i> Validación de documentos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    {/* ══════════════ MODAL POST-ESCANEO QR ══════════════ */}
    {showQRModal && (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1050,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}
        onClick={(e) => { if (e.target === e.currentTarget && !qrLoading) setShowQRModal(false); }}
      >
        <div style={{
          background: '#fff', borderRadius: 8, width: '100%', maxWidth: 640,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)'
        }}>

          {/* Header */}
          <div style={{
            background: '#28a745', color: '#fff', padding: '14px 20px',
            borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>
                <i className="fas fa-qrcode mr-2"></i>
                <strong>Registrar Entrada</strong>
                <span style={{ opacity: 0.85, fontWeight: 400, marginLeft: 6 }}>— via QR</span>
              </span>
              {tasaLoading && (
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                  <i className="fas fa-spinner fa-spin mr-1"></i>Cargando tasa...
                </span>
              )}
              {!tasaLoading && tasaBs && (
                <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                  <i className="fas fa-exchange-alt mr-1"></i>1 USD = {formatBs(tasaBs)} ({fuente})
                </span>
              )}
              {!tasaLoading && tasaError && (
                <span style={{ background: 'rgba(220,53,69,0.7)', borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>
                  <i className="fas fa-exclamation-triangle mr-1"></i>Sin tasa Bs
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => !qrLoading && setShowQRModal(false)}
              style={{
                background: 'none', border: 'none', color: '#fff',
                fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: '0 4px'
              }}
            >&times;</button>
          </div>

          {/* Producto info banner */}
          {qrEsNuevo ? (
            <div style={{
              background: '#fff3cd', borderBottom: '1px solid #ffc107',
              padding: '12px 20px', flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#856404' }}>
                  <i className="fas fa-exclamation-circle mr-1"></i>
                  Código <strong>{qrCodigoNuevo}</strong> no registrado — se creará al guardar
                </span>
              </div>
              <div className="form-group mt-2 mb-0">
                <label className="font-weight-bold" style={{ fontSize: 13 }}>
                  Nombre del producto <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className={`form-control form-control-sm ${qrErrors.qrNombre ? 'is-invalid' : ''}`}
                  value={qrNombre}
                  onChange={e => {
                    setQrNombre(e.target.value);
                    if (qrErrors.qrNombre) setQrErrors(prev => ({ ...prev, qrNombre: '' }));
                  }}
                  placeholder="Nombre del producto"
                  autoFocus
                />
                {qrErrors.qrNombre && <div className="invalid-feedback">{qrErrors.qrNombre}</div>}
              </div>
            </div>
          ) : (
            <div style={{
              background: '#f0fff4', borderBottom: '1px solid #c3e6cb',
              padding: '12px 20px', flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{qrProducto?.nombre}</span>
                  <span style={{ color: '#6c757d', marginLeft: 8, fontSize: 13 }}>#{qrProducto?.codigo}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#495057' }}>
                  <span>
                    Stock: <strong style={{ color: '#28a745' }}>{qrProducto?.stock}</strong>
                  </span>
                  {qrProducto?.precioCompra != null && (
                    <span>
                      Último costo: <strong>${qrProducto.precioCompra.toFixed(2)}</strong>
                      {tasaBs && (
                        <span style={{ color: '#17a2b8', marginLeft: 4 }}>
                          ({formatBs(convertirABs(qrProducto.precioCompra))})
                        </span>
                      )}
                    </span>
                  )}
                  {qrForm.cantidad > 0 && (
                    <span>
                      Nuevo stock: <strong style={{ color: '#007bff' }}>
                        {(qrProducto?.stock || 0) + parseInt(qrForm.cantidad || 0)}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Body scrollable */}
          <form onSubmit={handleQrSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ overflowY: 'auto', padding: '20px', flex: 1 }}>

              {/* Fila: Cantidad + Precio Compra + Precio Venta + Total */}
              <div className="row">
                <div className="col-sm-3">
                  <div className="form-group mb-3">
                    <label className="font-weight-bold">
                      Cantidad <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number" name="cantidad"
                      className={`form-control ${qrErrors.cantidad ? 'is-invalid' : ''}`}
                      value={qrForm.cantidad} onChange={handleQrChange}
                      placeholder="0" min="1" step="1" autoFocus
                    />
                    {qrErrors.cantidad && <div className="invalid-feedback">{qrErrors.cantidad}</div>}
                  </div>
                </div>

                <div className="col-sm-3">
                  <div className="form-group mb-3">
                    <label className="font-weight-bold">
                      P. Compra ($) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number" name="precioUnitario"
                      className={`form-control ${qrErrors.precioUnitario ? 'is-invalid' : ''}`}
                      value={qrForm.precioUnitario} onChange={handleQrChange}
                      placeholder="0.00" min="0" step="0.01"
                    />
                    {qrErrors.precioUnitario && <div className="invalid-feedback">{qrErrors.precioUnitario}</div>}
                    {showBs(qrForm.precioUnitario)}
                  </div>
                </div>

                <div className="col-sm-3">
                  <div className="form-group mb-3">
                    <label className="font-weight-bold">
                      P. Venta ($) <span className="text-danger">*</span>
                    </label>
                    <input
                      type="number" name="precioVenta"
                      className={`form-control ${qrErrors.precioVenta ? 'is-invalid' : ''}`}
                      value={qrForm.precioVenta} onChange={handleQrChange}
                      placeholder="0.00" min="0" step="0.01"
                    />
                    {qrErrors.precioVenta && <div className="invalid-feedback">{qrErrors.precioVenta}</div>}
                    {showBs(qrForm.precioVenta)}
                  </div>
                </div>

                <div className="col-sm-3">
                  <div className="form-group mb-3">
                    <label className="font-weight-bold">Costo Total</label>
                    <input
                      type="text" className="form-control font-weight-bold"
                      value={`$${costoUsd(qrForm)}`} disabled readOnly
                      style={{ background: '#f8f9fa', color: '#28a745' }}
                    />
                    {showBs(costoUsd(qrForm))}
                  </div>
                </div>
              </div>

              {/* Fila: Proveedor + Documento */}
              <div className="row">
                <div className="col-sm-6">
                  <div className="form-group mb-3">
                    <label className="font-weight-bold">
                      Proveedor <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text" name="proveedor"
                      className={`form-control ${qrErrors.proveedor ? 'is-invalid' : ''}`}
                      value={qrForm.proveedor} onChange={handleQrChange}
                      placeholder="Nombre del proveedor"
                    />
                    {qrErrors.proveedor && <div className="invalid-feedback">{qrErrors.proveedor}</div>}
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="form-group mb-3">
                    <label className="font-weight-bold">
                      Nro. Documento <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text" name="numeroDocumento"
                      className={`form-control ${qrErrors.numeroDocumento ? 'is-invalid' : ''}`}
                      value={qrForm.numeroDocumento} onChange={handleQrChange}
                      placeholder="Ej: FAC-001234"
                    />
                    {qrErrors.numeroDocumento && <div className="invalid-feedback">{qrErrors.numeroDocumento}</div>}
                  </div>
                </div>
              </div>

              {/* Motivo */}
              <div className="form-group mb-3">
                <label className="font-weight-bold">
                  Motivo <span className="text-danger">*</span>
                </label>
                <textarea
                  name="motivo"
                  className={`form-control ${qrErrors.motivo ? 'is-invalid' : ''}`}
                  value={qrForm.motivo} onChange={handleQrChange}
                  placeholder="Describa el motivo de la entrada (mínimo 5 caracteres)"
                  rows="2" maxLength="500"
                />
                {qrErrors.motivo && <div className="invalid-feedback">{qrErrors.motivo}</div>}
                <small className="text-muted">{qrForm.motivo.length}/500</small>
              </div>

              {/* Observaciones */}
              <div className="form-group mb-0">
                <label>Observaciones <span className="text-muted">(opcional)</span></label>
                <textarea
                  name="observaciones" className="form-control"
                  value={qrForm.observaciones} onChange={handleQrChange}
                  placeholder="Información adicional" rows="2" maxLength="1000"
                />
              </div>

              {qrAdvertencias.length > 0 && (
                <div className="alert alert-warning mt-3 mb-0">
                  <strong><i className="fas fa-exclamation-triangle mr-2"></i>Advertencias:</strong>
                  <ul className="mb-0 mt-1">{qrAdvertencias.map((a, i) => <li key={i}>{a}</li>)}</ul>
                </div>
              )}
            </div>

            {/* Footer siempre visible */}
            <div style={{
              borderTop: '1px solid #dee2e6', padding: '14px 20px',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              flexShrink: 0, background: '#f8f9fa', borderRadius: '0 0 8px 8px'
            }}>
              <button
                type="button" className="btn btn-secondary"
                onClick={() => setShowQRModal(false)} disabled={qrLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-success" disabled={qrLoading}
                style={{ minWidth: 160 }}>
                {qrLoading
                  ? <><i className="fas fa-spinner fa-spin mr-2"></i>Registrando...</>
                  : <><i className="fas fa-save mr-2"></i>Registrar Entrada</>}
              </button>
            </div>
          </form>

        </div>
      </div>
    )}

    </>

  );
};

export default memo(EntradaInventario);
