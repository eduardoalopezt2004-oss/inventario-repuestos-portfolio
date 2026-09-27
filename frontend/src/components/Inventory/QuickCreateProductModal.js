import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { productAPI } from '../../services/api';
import axios from '../../services/api';
import useDolarRate from '../../hooks/useDolarRate';

const QuickCreateProductModal = ({ codigo, onCreated, onClose }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    marca: '',
    precioCompra: '',
    precioVenta: '',
    cantidad: '',
    proveedor: '',
    numeroDocumento: '',
    motivo: '',
    observaciones: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { tasaBs, fuente, convertirABs, formatBs } = useDolarRate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }
    if (!formData.precioVenta || parseFloat(formData.precioVenta) <= 0) {
      newErrors.precioVenta = 'El precio de venta debe ser mayor a 0';
    }
    if (!formData.cantidad || parseInt(formData.cantidad) <= 0) {
      newErrors.cantidad = 'La cantidad debe ser mayor a 0';
    } else if (!Number.isInteger(Number(formData.cantidad))) {
      newErrors.cantidad = 'La cantidad debe ser un número entero';
    }
    if (!formData.proveedor || formData.proveedor.trim().length < 3) {
      newErrors.proveedor = 'El proveedor debe tener al menos 3 caracteres';
    }
    if (!formData.numeroDocumento || formData.numeroDocumento.trim().length === 0) {
      newErrors.numeroDocumento = 'El número de documento es requerido';
    }
    if (!formData.motivo || formData.motivo.trim().length < 5) {
      newErrors.motivo = 'El motivo debe tener al menos 5 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // 1. Crear el producto
      const precioCompraNum = parseFloat(formData.precioCompra) || 0;
      const productoPayload = {
        codigo,
        nombre: formData.nombre.trim(),
        precioCompra: precioCompraNum,
        precioVenta: parseFloat(formData.precioVenta)
      };
      if (formData.marca.trim()) productoPayload.marca = formData.marca.trim();
      const productoResponse = await productAPI.create(productoPayload);

      const producto = productoResponse.data;

      // 2. Registrar la entrada de inventario
      await axios.post('/inventory/entrada', {
        producto: producto._id,
        cantidad: parseInt(formData.cantidad),
        precioUnitario: precioCompraNum,
        motivo: formData.motivo.trim(),
        numeroDocumento: formData.numeroDocumento.trim(),
        proveedor: formData.proveedor.trim(),
        observaciones: formData.observaciones.trim(),
        tasaBs: tasaBs || null
      });

      toast.success(`Producto "${producto.nombre}" creado y entrada registrada (${formData.cantidad} unidades)`);
      onCreated(producto);
    } catch (error) {
      const data = error.response?.data;
      toast.error(data?.message || 'Error al crear el producto');
    } finally {
      setLoading(false);
    }
  };

  const costoTotal = formData.cantidad && formData.precioCompra
    ? parseInt(formData.cantidad) * parseFloat(formData.precioCompra)
    : 0;

  return (
    <div
      className="modal fade show"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-primary text-white">
            <h4 className="modal-title">
              <i className="fas fa-plus-circle mr-2"></i>
              Nuevo Producto — Registrar Entrada
            </h4>
            <button type="button" className="close text-white" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="alert alert-info">
                <i className="fas fa-info-circle mr-2"></i>
                Código QR no encontrado. Complete los datos del producto y la entrada de inventario.
              </div>

              {/* ── DATOS DEL PRODUCTO ── */}
              <h6 className="text-primary font-weight-bold mb-2">
                <i className="fas fa-box mr-1"></i> Datos del Producto
              </h6>

              <div className="form-group">
                <label>Código QR</label>
                <input type="text" className="form-control" value={codigo} readOnly />
              </div>

              <div className="row">
                <div className="col-md-8">
                  <div className="form-group">
                    <label>Nombre <span className="text-danger">*</span></label>
                    <input type="text" name="nombre"
                      className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
                      value={formData.nombre} onChange={handleChange}
                      placeholder="Nombre del producto" disabled={loading} autoFocus />
                    {errors.nombre && <div className="invalid-feedback">{errors.nombre}</div>}
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Marca</label>
                    <input type="text" name="marca" className="form-control"
                      value={formData.marca} onChange={handleChange}
                      placeholder="Ej: Castrol" disabled={loading} minLength="2" maxLength="50" />
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Precio de Compra (USD)</label>
                    <input
                      type="number"
                      name="precioCompra"
                      className="form-control"
                      value={formData.precioCompra}
                      onChange={handleChange}
                      placeholder="0.00"
                      disabled={loading}
                      min="0"
                      step="0.01"
                    />
                    {tasaBs && formData.precioCompra > 0 && (
                      <small className="form-text text-info">
                        = {formatBs(convertirABs(parseFloat(formData.precioCompra)))} ({fuente})
                      </small>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Precio de Venta (USD) <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      name="precioVenta"
                      className={`form-control ${errors.precioVenta ? 'is-invalid' : ''}`}
                      value={formData.precioVenta}
                      onChange={handleChange}
                      placeholder="0.00"
                      disabled={loading}
                      min="0.01"
                      step="0.01"
                    />
                    {errors.precioVenta && <div className="invalid-feedback">{errors.precioVenta}</div>}
                    {tasaBs && formData.precioVenta > 0 && (
                      <small className="form-text text-info">
                        = {formatBs(convertirABs(parseFloat(formData.precioVenta)))} ({fuente})
                      </small>
                    )}
                  </div>
                </div>
              </div>

              <hr />

              {/* ── DATOS DE LA ENTRADA ── */}
              <h6 className="text-success font-weight-bold mb-2">
                <i className="fas fa-arrow-down mr-1"></i> Datos de la Entrada
              </h6>

              <div className="row">
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Cantidad <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      name="cantidad"
                      className={`form-control ${errors.cantidad ? 'is-invalid' : ''}`}
                      value={formData.cantidad}
                      onChange={handleChange}
                      placeholder="Ej: 100"
                      disabled={loading}
                      min="1"
                      step="1"
                    />
                    {errors.cantidad && <div className="invalid-feedback">{errors.cantidad}</div>}
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Costo Total (USD)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={costoTotal > 0 ? `$${costoTotal.toFixed(2)}` : '$0.00'}
                      readOnly
                      disabled
                    />
                    {tasaBs && costoTotal > 0 && (
                      <small className="form-text text-info">
                        = {formatBs(convertirABs(costoTotal))} ({fuente})
                      </small>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Proveedor <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="proveedor"
                  className={`form-control ${errors.proveedor ? 'is-invalid' : ''}`}
                  value={formData.proveedor}
                  onChange={handleChange}
                  placeholder="Nombre del proveedor"
                  disabled={loading}
                />
                {errors.proveedor && <div className="invalid-feedback">{errors.proveedor}</div>}
              </div>

              <div className="form-group">
                <label>Número de Documento <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="numeroDocumento"
                  className={`form-control ${errors.numeroDocumento ? 'is-invalid' : ''}`}
                  value={formData.numeroDocumento}
                  onChange={handleChange}
                  placeholder="Ej: FAC-001234"
                  disabled={loading}
                />
                {errors.numeroDocumento && <div className="invalid-feedback">{errors.numeroDocumento}</div>}
              </div>

              <div className="form-group">
                <label>Motivo <span className="text-danger">*</span></label>
                <textarea
                  name="motivo"
                  className={`form-control ${errors.motivo ? 'is-invalid' : ''}`}
                  value={formData.motivo}
                  onChange={handleChange}
                  placeholder="Describa el motivo de la entrada (mínimo 5 caracteres)"
                  rows="2"
                  disabled={loading}
                  maxLength="500"
                />
                {errors.motivo && <div className="invalid-feedback">{errors.motivo}</div>}
              </div>

              <div className="form-group">
                <label>Observaciones (Opcional)</label>
                <textarea
                  name="observaciones"
                  className="form-control"
                  value={formData.observaciones}
                  onChange={handleChange}
                  placeholder="Información adicional"
                  rows="2"
                  disabled={loading}
                  maxLength="1000"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Registrando...</>
                ) : (
                  <><i className="fas fa-save mr-2"></i>Crear Producto y Registrar Entrada</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuickCreateProductModal;
