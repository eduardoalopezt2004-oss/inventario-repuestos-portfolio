import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { importAPI } from '../services/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const initialState = {
  step: 1,
  file: null,
  dragging: false,
  loading: false,
  error: null,
  productos: [],
  resultado: null
};

export default function ImportProveedores() {
  const { isOnline } = useOnlineStatus();
  const [state, setState] = useState(initialState);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  const handleDragOver = (e) => {
    e.preventDefault();
    set({ dragging: true });
  };

  const handleDragLeave = () => set({ dragging: false });

  const handleDrop = (e) => {
    e.preventDefault();
    set({ dragging: false });
    const dropped = e.dataTransfer.files[0];
    if (dropped) set({ file: dropped, error: null });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) set({ file: selected, error: null });
  };

  // ── Paso 1 → Analizar ────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!state.file) return;
    set({ loading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('archivo', state.file);
      const res = await importAPI.analyze(formData);
      const productos = res.data.productos.map((p, i) => ({ ...p, _id: i, precioVenta: '' }));
      set({ step: 2, productos, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err.response?.data?.message || 'Error al analizar el archivo.'
      });
    }
  };

  // ── Edición en tabla ─────────────────────────────────────────────────────
  const handlePrecioVenta = (idx, val) => {
    set({
      productos: state.productos.map((p, i) =>
        i === idx ? { ...p, precioVenta: val } : p
      )
    });
  };

  const handleRemove = (idx) => {
    set({ productos: state.productos.filter((_, i) => i !== idx) });
  };

  const allValid =
    state.productos.length > 0 &&
    state.productos.every((p) => parseFloat(p.precioVenta) > 0);

  // ── Paso 2 → Confirmar ───────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!allValid) return;
    set({ loading: true, error: null });
    try {
      const payload = state.productos.map((p) => ({
        ...p,
        precioVenta: parseFloat(p.precioVenta)
      }));
      const res = await importAPI.confirm(payload);
      set({ step: 3, resultado: res.data, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err.response?.data?.message || 'Error al importar los productos.'
      });
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setState(initialState);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="content-wrapper">
      <div className="content-header">
        <div className="container-fluid">
          <h1 className="m-0">
            <i className="fas fa-file-import mr-2 text-primary"></i>
            Importar Lista de Proveedor (Excel / CSV)
          </h1>
        </div>
      </div>

      <div className="content">
        <div className="container-fluid">

          {!isOnline && (
            <div className="alert alert-warning">
              <i className="fas fa-wifi mr-2"></i>
              <strong>Sin conexión.</strong> La importación de archivos requiere conexión al servidor. Conéctate a la red para usar esta función.
            </div>
          )}

          {/* Breadcrumb de pasos */}
          <div className="row mb-3">
            <div className="col-12">
              <ol className="breadcrumb" style={{ background: 'none', padding: 0 }}>
                <li className={`breadcrumb-item${state.step >= 1 ? ' active' : ''}`}>
                  <i className="fas fa-upload mr-1"></i>1. Subir archivo
                </li>
                <li className={`breadcrumb-item${state.step >= 2 ? ' active' : ''}`}>
                  <i className="fas fa-table mr-1"></i>2. Revisar productos
                </li>
                <li className={`breadcrumb-item${state.step >= 3 ? ' active' : ''}`}>
                  <i className="fas fa-check-circle mr-1"></i>3. Resultado
                </li>
              </ol>
            </div>
          </div>

          {/* ── PASO 1 ── */}
          {state.step === 1 && (
            <div className="card card-primary card-outline">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="fas fa-cloud-upload-alt mr-2"></i>
                  Selecciona el archivo del proveedor
                </h3>
              </div>
              <div className="card-body">
                <p className="text-muted">
                  Soporta Excel (.xlsx, .xls) y CSV. Las columnas se detectan automáticamente
                  por nombre (código, nombre, precio, stock, marca, etc.).
                </p>

                {/* Zona drag & drop */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current && inputRef.current.click()}
                  style={{
                    border: `2px dashed ${state.dragging ? '#007bff' : '#ced4da'}`,
                    borderRadius: '0.5rem',
                    padding: '3rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: state.dragging ? '#f0f7ff' : '#fafafa',
                    transition: 'all 0.2s'
                  }}
                >
                  <i
                    className="fas fa-file-upload"
                    style={{ fontSize: '3rem', color: state.dragging ? '#007bff' : '#adb5bd' }}
                  ></i>
                  <p className="mt-3 mb-1" style={{ fontSize: '1.1rem' }}>
                    {state.file
                      ? <><i className="fas fa-file-check text-success mr-1"></i>{state.file.name}</>
                      : 'Arrastra el archivo aquí o haz clic para seleccionar'}
                  </p>
                  {!state.file && (
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                      Máximo 10 MB
                    </p>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                </div>

                {state.error && (
                  <div className="alert alert-danger mt-3">
                    <i className="fas fa-exclamation-triangle mr-2"></i>
                    {state.error}
                  </div>
                )}
              </div>
              <div className="card-footer">
                <button
                  className="btn btn-primary btn-lg"
                  disabled={!state.file || state.loading || !isOnline}
                  onClick={handleAnalyze}
                >
                  {state.loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm mr-2" role="status"></span>
                      Procesando archivo...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload mr-2"></i>
                      Procesar archivo
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── PASO 2 ── */}
          {state.step === 2 && (
            <div className="card card-primary card-outline">
              <div className="card-header">
                <h3 className="card-title">
                  <i className="fas fa-table mr-2"></i>
                  Revisar y completar precios de venta
                </h3>
                <div className="card-tools">
                  <span className="badge badge-primary badge-lg" style={{ fontSize: '0.95rem', padding: '0.4em 0.8em' }}>
                    {state.productos.length} producto{state.productos.length !== 1 ? 's' : ''} encontrado{state.productos.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-bordered table-hover mb-0">
                    <thead className="thead-light">
                      <tr>
                        <th style={{ width: '40px' }}>#</th>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Marca</th>
                        <th>Precio Compra</th>
                        <th>
                          Precio Venta <span className="text-danger">*</span>
                        </th>
                        <th style={{ width: '60px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.productos.map((p, i) => (
                        <tr key={i}>
                          <td className="text-center text-muted">{i + 1}</td>
                          <td><code>{p.codigo || '—'}</code></td>
                          <td>{p.nombre || '—'}</td>
                          <td>{p.marca || '—'}</td>
                          <td className="text-right">
                            {p.precioCompra > 0
                              ? `$${Number(p.precioCompra).toFixed(2)}`
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>
                            <div className="input-group input-group-sm">
                              <div className="input-group-prepend">
                                <span className="input-group-text">$</span>
                              </div>
                              <input
                                type="number"
                                className={`form-control${parseFloat(p.precioVenta) > 0 ? ' is-valid' : ''}`}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={p.precioVenta}
                                onChange={(e) => handlePrecioVenta(i, e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Quitar"
                              onClick={() => handleRemove(i)}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer d-flex justify-content-between align-items-center">
                <button className="btn btn-secondary" onClick={handleReset}>
                  <i className="fas fa-arrow-left mr-1"></i>Volver
                </button>
                <div>
                  {!allValid && (
                    <small className="text-danger mr-3">
                      <i className="fas fa-info-circle mr-1"></i>
                      Completa el precio de venta de todos los productos
                    </small>
                  )}
                  {state.error && (
                    <small className="text-danger mr-3">{state.error}</small>
                  )}
                  <button
                    className="btn btn-success btn-lg"
                    disabled={!allValid || state.loading}
                    onClick={handleConfirm}
                  >
                    {state.loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm mr-2" role="status"></span>
                        Importando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-database mr-2"></i>
                        Importar {state.productos.length} producto{state.productos.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3 ── */}
          {state.step === 3 && state.resultado && (
            <div>
              <div className="row">
                <div className="col-md-4">
                  <div className="small-box bg-success">
                    <div className="inner">
                      <h3>{state.resultado.creados}</h3>
                      <p>Productos creados</p>
                    </div>
                    <div className="icon">
                      <i className="fas fa-plus-circle"></i>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="small-box bg-info">
                    <div className="inner">
                      <h3>{state.resultado.actualizados}</h3>
                      <p>Productos actualizados</p>
                    </div>
                    <div className="icon">
                      <i className="fas fa-sync-alt"></i>
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="small-box bg-danger">
                    <div className="inner">
                      <h3>{state.resultado.errores?.length || 0}</h3>
                      <p>Errores</p>
                    </div>
                    <div className="icon">
                      <i className="fas fa-exclamation-circle"></i>
                    </div>
                  </div>
                </div>
              </div>

              {state.resultado.errores?.length > 0 && (
                <div className="card card-danger card-outline">
                  <div className="card-header">
                    <h3 className="card-title">
                      <i className="fas fa-exclamation-triangle mr-2"></i>
                      Errores durante la importación
                    </h3>
                  </div>
                  <div className="card-body p-0">
                    <ul className="list-group list-group-flush">
                      {state.resultado.errores.map((e, i) => (
                        <li key={i} className="list-group-item">
                          <strong>{e.producto}</strong>
                          <span className="text-danger ml-2">— {e.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="d-flex gap-2 mt-3" style={{ gap: '1rem' }}>
                <button className="btn btn-primary btn-lg" onClick={handleReset}>
                  <i className="fas fa-file-import mr-2"></i>
                  Importar otra lista
                </button>
                <button
                  className="btn btn-outline-secondary btn-lg"
                  onClick={() => navigate('/categorias')}
                >
                  <i className="fas fa-boxes mr-2"></i>
                  Ver productos
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
