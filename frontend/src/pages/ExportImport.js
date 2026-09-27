import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import axios from '../services/api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  getCachedProductos, getCachedSales, getCachedMovements,
  getCachedCategories, cacheProductos, cacheSales,
  cacheMovements, cacheCategories, enqueue
} from '../utils/offlineQueue';

const CACHE_USERS_KEY = 'lube_cache_users';

const getCachedUsers = () => {
  try { return JSON.parse(localStorage.getItem(CACHE_USERS_KEY) || 'null'); } catch { return null; }
};
const cacheUsers = (data) => {
  try { localStorage.setItem(CACHE_USERS_KEY, JSON.stringify(data)); } catch {}
};

const ExportImport = () => {
  const { isOnline } = useOnlineStatus();
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [preview, setPreview] = useState(null);
  const [archivoListo, setArchivoListo] = useState(null);
  const fileRef = useRef();

  /* ── EXPORTAR ─────────────────────────────────────────── */

  const handleExportar = async () => {
    setExportando(true);
    try {
      if (isOnline) {
        // Con conexión: pedir al servidor datos completos y descargar
        const res = await axios.get('/export', { responseType: 'blob' });
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exportación completada desde el servidor');
      } else {
        // Sin conexión: construir desde caché local
        const products   = getCachedProductos()  || [];
        const sales      = getCachedSales()       || [];
        const movements  = getCachedMovements()   || [];
        const categories = getCachedCategories()  || [];
        const users      = getCachedUsers()       || [];

        if (!products.length && !sales.length) {
          toast.warning('No hay datos en caché para exportar. Conéctate al servidor al menos una vez.');
          return;
        }

        const payload = {
          _meta: {
            version: '1.0',
            exportadoEn: new Date().toISOString(),
            exportadoPor: 'offline',
            totales: { products: products.length, categories: categories.length, sales: sales.length, movements: movements.length, users: users.length }
          },
          products, categories, sales, movements, users
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_offline_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Exportación completada desde caché local');
      }
    } catch (error) {
      toast.error('Error al exportar: ' + (error.response?.data?.message || error.message));
    } finally {
      setExportando(false);
    }
  };

  /* ── IMPORTAR — leer archivo ──────────────────────────── */

  const handleArchivoSeleccionado = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.products && !data.sales && !data.movements) {
          toast.error('El archivo no tiene el formato correcto');
          return;
        }
        setArchivoListo(data);
        setPreview({
          exportadoEn: data._meta?.exportadoEn,
          exportadoPor: data._meta?.exportadoPor,
          totales: data._meta?.totales || {
            products:   (data.products   || []).length,
            categories: (data.categories || []).length,
            sales:      (data.sales      || []).length,
            movements:  (data.movements  || []).length,
            users:      (data.users      || []).length
          }
        });
      } catch {
        toast.error('El archivo no es un JSON válido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCancelarImport = () => {
    setArchivoListo(null);
    setPreview(null);
  };

  /* ── IMPORTAR — confirmar ─────────────────────────────── */

  const handleConfirmarImport = async () => {
    if (!archivoListo) return;
    setImportando(true);

    try {
      if (isOnline) {
        // Con conexión: enviar al servidor
        const res = await axios.post('/export/import', archivoListo, {
          headers: { 'Content-Type': 'application/json' },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        });
        const { resultados } = res.data;
        const resumen = Object.entries(resultados)
          .map(([col, r]) => `${col}: +${r.insertados} / ~${r.actualizados}`)
          .join(', ');
        toast.success(`Importación completada — ${resumen}`);
      } else {
        // Sin conexión: actualizar cachés locales y encolar para sincronizar
        if (archivoListo.products)   cacheProductos(archivoListo.products);
        if (archivoListo.sales)      cacheSales(archivoListo.sales);
        if (archivoListo.movements)  cacheMovements(archivoListo.movements);
        if (archivoListo.categories) cacheCategories(archivoListo.categories);
        if (archivoListo.users)      cacheUsers(archivoListo.users);

        // Encolar para que cuando vuelva la conexión se sincronice con el servidor
        enqueue('import', '/export/import', 'post', archivoListo);
        toast.info('Sin conexión — datos aplicados localmente. Se sincronizarán con el servidor al reconectarse.');
      }
      setArchivoListo(null);
      setPreview(null);
    } catch (error) {
      toast.error('Error al importar: ' + (error.response?.data?.message || error.message));
    } finally {
      setImportando(false);
    }
  };

  /* ── RENDER ───────────────────────────────────────────── */

  return (
    <>
      <section className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1>Exportar / Importar Datos</h1>
            </div>
            <div className="col-sm-6">
              <div className="float-right">
                <span className={`badge ${isOnline ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 13 }}>
                  <i className={`fas ${isOnline ? 'fa-wifi' : 'fa-wifi-slash'} mr-1`}></i>
                  {isOnline ? 'En línea' : 'Sin conexión'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="content">
        <div className="container-fluid">
          <div className="row">

            {/* ── EXPORTAR ── */}
            <div className="col-md-5">
              <div className="card card-success">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="fas fa-file-export mr-2"></i>
                    Exportar datos
                  </h3>
                </div>
                <div className="card-body">
                  <p className="text-muted" style={{ fontSize: 14 }}>
                    Genera un archivo <strong>.json</strong> con todos los datos del sistema
                    (productos, ventas, movimientos, usuarios).
                    Transfiérelo al otro dispositivo por USB, WhatsApp, email o cualquier medio.
                  </p>
                  {!isOnline && (
                    <div className="alert alert-warning py-2 mb-3" style={{ fontSize: 13 }}>
                      <i className="fas fa-exclamation-triangle mr-1"></i>
                      Sin conexión — el archivo se generará desde el <strong>caché local</strong>.
                      Puede no incluir cambios recientes del servidor.
                    </div>
                  )}
                </div>
                <div className="card-footer">
                  <button
                    className="btn btn-success btn-block"
                    onClick={handleExportar}
                    disabled={exportando}
                  >
                    {exportando
                      ? <><i className="fas fa-spinner fa-spin mr-2"></i>Generando archivo...</>
                      : <><i className="fas fa-download mr-2"></i>Descargar backup</>}
                  </button>
                </div>
              </div>
            </div>

            {/* ── IMPORTAR ── */}
            <div className="col-md-7">
              <div className="card card-primary">
                <div className="card-header">
                  <h3 className="card-title">
                    <i className="fas fa-file-import mr-2"></i>
                    Importar datos
                  </h3>
                </div>
                <div className="card-body">

                  {!preview ? (
                    <>
                      <p className="text-muted" style={{ fontSize: 14 }}>
                        Selecciona un archivo <strong>.json</strong> exportado previamente.
                        Los registros existentes se actualizarán y los nuevos se agregarán
                        sin eliminar nada.
                      </p>
                      {!isOnline && (
                        <div className="alert alert-warning py-2 mb-3" style={{ fontSize: 13 }}>
                          <i className="fas fa-exclamation-triangle mr-1"></i>
                          Sin conexión — los datos se aplicarán al <strong>caché local</strong> y
                          se sincronizarán con el servidor al reconectarse.
                        </div>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={handleArchivoSeleccionado}
                      />
                      <button
                        className="btn btn-outline-primary btn-block"
                        onClick={() => fileRef.current.click()}
                        style={{ border: '2px dashed #007bff', padding: '2rem' }}
                      >
                        <i className="fas fa-folder-open fa-2x d-block mb-2"></i>
                        Seleccionar archivo .json
                      </button>
                    </>
                  ) : (
                    /* Vista previa del archivo antes de confirmar */
                    <div>
                      <div className="alert alert-info py-2 mb-3" style={{ fontSize: 13 }}>
                        <i className="fas fa-info-circle mr-1"></i>
                        <strong>Archivo listo para importar</strong>
                        {preview.exportadoEn && (
                          <span className="ml-2 text-muted">
                            — Generado el {new Date(preview.exportadoEn).toLocaleString()}
                            {preview.exportadoPor && preview.exportadoPor !== 'desconocido' && ` por ${preview.exportadoPor}`}
                          </span>
                        )}
                      </div>

                      <table className="table table-sm table-bordered mb-3">
                        <thead className="thead-light">
                          <tr>
                            <th>Colección</th>
                            <th className="text-center">Registros en archivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { key: 'products',   label: 'Productos',            icon: 'fa-box' },
                            { key: 'categories', label: 'Categorías',           icon: 'fa-tags' },
                            { key: 'sales',      label: 'Ventas',               icon: 'fa-cash-register' },
                            { key: 'movements',  label: 'Movimientos',          icon: 'fa-exchange-alt' },
                            { key: 'users',      label: 'Usuarios',             icon: 'fa-users' }
                          ].map(({ key, label, icon }) => (
                            <tr key={key}>
                              <td><i className={`fas ${icon} mr-2 text-muted`}></i>{label}</td>
                              <td className="text-center">
                                <span className="badge badge-secondary">{preview.totales[key] ?? 0}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="alert alert-warning py-2" style={{ fontSize: 13 }}>
                        <i className="fas fa-exclamation-triangle mr-1"></i>
                        Los registros existentes serán <strong>actualizados</strong>. No se eliminará nada.
                      </div>
                    </div>
                  )}
                </div>

                {preview && (
                  <div className="card-footer d-flex justify-content-end" style={{ gap: 10 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={handleCancelarImport}
                      disabled={importando}
                    >
                      Cancelar
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleConfirmarImport}
                      disabled={importando}
                    >
                      {importando
                        ? <><i className="fas fa-spinner fa-spin mr-2"></i>Importando...</>
                        : <><i className="fas fa-check mr-2"></i>Confirmar importación</>}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Info ── */}
          <div className="row">
            <div className="col-12">
              <div className="card card-outline card-secondary">
                <div className="card-header">
                  <h3 className="card-title"><i className="fas fa-question-circle mr-2"></i>¿Cómo sincronizar dos dispositivos sin internet?</h3>
                </div>
                <div className="card-body">
                  <div className="row">
                    {[
                      { n: 1, icon: 'fa-laptop',         color: '#17a2b8', title: 'Exportar en dispositivo A', desc: 'Abre esta página en el dispositivo que tiene los datos más recientes y descarga el archivo backup.' },
                      { n: 2, icon: 'fa-share-alt',       color: '#28a745', title: 'Transferir el archivo',     desc: 'Envía el archivo por USB, WhatsApp, email, Bluetooth o cualquier medio disponible.' },
                      { n: 3, icon: 'fa-file-import',     color: '#ffc107', title: 'Importar en dispositivo B', desc: 'Abre esta página en el otro dispositivo, selecciona el archivo y confirma la importación.' },
                      { n: 4, icon: 'fa-check-circle',    color: '#6c757d', title: 'Listo',                     desc: 'Ambos dispositivos ahora tienen los mismos datos. Repite el proceso cada vez que haya cambios.' }
                    ].map(({ n, icon, color, title, desc }) => (
                      <div key={n} className="col-md-3 col-sm-6 mb-3">
                        <div className="d-flex align-items-start">
                          <div style={{ background: color, borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 12 }}>
                            <i className={`fas ${icon}`} style={{ color: '#fff', fontSize: 15 }}></i>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                              <span style={{ color, marginRight: 4 }}>{n}.</span>{title}
                            </div>
                            <div style={{ fontSize: 13, color: '#6c757d' }}>{desc}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>
    </>
  );
};

export default ExportImport;
