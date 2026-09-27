import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Container, Card, Row, Col, Form, Table, Pagination } from 'react-bootstrap';
import { productAPI } from '../services/api';
import { toast } from 'react-toastify';
import { CAMPOS_LABEL, formatValorCambio } from '../utils/productChangeFields';

const POR_PAGINA = 20;

const HistorialCambios = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const productoFiltro = searchParams.get('producto') || '';

  const [historial, setHistorial] = useState([]);
  const [paginacion, setPaginacion] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(false);
  const [productoInfo, setProductoInfo] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [campo, setCampo] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [orden, setOrden] = useState('desc');

  const cargarHistorial = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: POR_PAGINA, orden };
      if (productoFiltro) params.producto = productoFiltro;
      else if (busqueda) params.search = busqueda;
      if (campo) params.campo = campo;
      if (fechaDesde) params.fechaDesde = fechaDesde;
      if (fechaHasta) params.fechaHasta = fechaHasta;

      const response = await productAPI.getHistorialGlobal(params);
      setHistorial(response.data.historial || []);
      setPaginacion(response.data.paginacion || null);
      setPagina(p);
    } catch {
      toast.error('Error al cargar el historial de cambios');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoFiltro, orden]);

  useEffect(() => {
    cargarHistorial(1);
  }, [cargarHistorial]);

  useEffect(() => {
    if (!productoFiltro) {
      setProductoInfo(null);
      return;
    }
    productAPI.getById(productoFiltro)
      .then(res => setProductoInfo(res.data))
      .catch(() => setProductoInfo(null));
  }, [productoFiltro]);

  const handleBuscar = () => cargarHistorial(1);

  const handleQuitarFiltroProducto = () => {
    searchParams.delete('producto');
    setSearchParams(searchParams);
  };

  const handleLimpiarFiltros = () => {
    setBusqueda('');
    setCampo('');
    setFechaDesde('');
    setFechaHasta('');
    setOrden('desc');
    setTimeout(() => cargarHistorial(1), 0);
  };

  const totalPaginas = paginacion?.paginas ?? 1;

  return (
    <Container fluid className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">
          <i className="fas fa-history me-2 text-primary"></i>
          Historial de Cambios de Productos
        </h4>
        <Link to="/categorias" className="btn btn-outline-secondary btn-sm">
          <i className="fas fa-arrow-left me-1"></i>Volver a Productos
        </Link>
      </div>

      {productoFiltro && (
        <div className="alert alert-info d-flex justify-content-between align-items-center">
          <span>
            <i className="fas fa-filter me-2"></i>
            Mostrando solo los cambios de{' '}
            <strong>{productoInfo ? `${productoInfo.codigo} — ${productoInfo.nombre}` : 'este producto'}</strong>
          </span>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleQuitarFiltroProducto}>
            <i className="fas fa-times me-1"></i>Ver todos los productos
          </button>
        </div>
      )}

      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          {!productoFiltro && (
            <div className="mb-3">
              <label className="fw-semibold mb-1" style={{ color: '#2563EB', fontSize: '0.9rem' }}>
                <i className="fas fa-search me-1"></i>
                Buscar por producto
              </label>
              <div
                className="input-group"
                style={{ border: '2px solid #2563EB', borderRadius: '0.5rem', overflow: 'hidden' }}
              >
                <span className="input-group-text bg-white border-0">
                  <i className="fas fa-search" style={{ color: '#2563EB' }}></i>
                </span>
                <input
                  type="text"
                  className="form-control border-0 ps-0"
                  placeholder="Código, nombre o marca del producto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBuscar()}
                />
                {busqueda && (
                  <button className="btn btn-outline-secondary border-0" onClick={() => setBusqueda('')}>
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
            </div>
          )}

          <Row className="g-2 align-items-end">
            <Col xs={12} sm={6} lg={3}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-list me-1"></i>Campo modificado
                </Form.Label>
                <Form.Select className="form-control" value={campo} onChange={e => setCampo(e.target.value)}>
                  <option value="">Todos los campos</option>
                  {Object.entries(CAMPOS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                  <i className="fas fa-sort me-1"></i>Orden
                </Form.Label>
                <Form.Select className="form-control" value={orden} onChange={e => setOrden(e.target.value)}>
                  <option value="desc">Más reciente primero</option>
                  <option value="asc">Más antiguo primero</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>Desde</Form.Label>
                <Form.Control type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              </Form.Group>
            </Col>
            <Col xs={6} sm={6} lg={2}>
              <Form.Group>
                <Form.Label className="fw-semibold" style={{ fontSize: '0.9rem' }}>Hasta</Form.Label>
                <Form.Control type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
              </Form.Group>
            </Col>
            <Col xs={12} sm={12} lg={2} className="d-flex gap-2">
              <button className="btn btn-primary flex-grow-1" onClick={handleBuscar} disabled={loading}>
                <i className="fas fa-search me-1"></i>Buscar
              </button>
              <button className="btn btn-outline-secondary" onClick={handleLimpiarFiltros} disabled={loading} title="Limpiar filtros">
                <i className="fas fa-eraser"></i>
              </button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Cargando...</span>
              </div>
            </div>
          ) : historial.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fas fa-inbox fa-3x mb-3"></i>
              <p>No hay cambios registrados con estos filtros</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="text-nowrap">Fecha</th>
                    <th className="text-nowrap">Producto</th>
                    <th className="text-nowrap">Usuario</th>
                    <th className="text-nowrap">Campo</th>
                    <th className="text-nowrap">Valor anterior</th>
                    <th className="text-nowrap">Valor nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((log) => (
                    (log.cambios || []).map((cambio, idx) => (
                      <tr key={`${log._id}-${idx}`}>
                        {idx === 0 && (
                          <>
                            <td rowSpan={log.cambios.length} className="text-nowrap">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td rowSpan={log.cambios.length} className="text-nowrap">
                              {log.producto ? (
                                <Link to={`/historial-cambios?producto=${log.producto._id}`}>
                                  <strong>{log.producto.codigo}</strong>
                                  <br /><small>{log.producto.nombre}</small>
                                </Link>
                              ) : (
                                <span className="text-muted">Producto eliminado</span>
                              )}
                            </td>
                            <td rowSpan={log.cambios.length}>
                              <small>{log.usuario?.nombre || '—'}</small>
                            </td>
                          </>
                        )}
                        <td>{CAMPOS_LABEL[cambio.campo] || cambio.campo}</td>
                        <td>{formatValorCambio(cambio.valorAnterior)}</td>
                        <td>{formatValorCambio(cambio.valorNuevo)}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>

        {paginacion && paginacion.total > 0 && (
          <Card.Footer className="d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2">
            <small className="text-muted">
              Mostrando {(pagina - 1) * POR_PAGINA + 1}
              –{Math.min(pagina * POR_PAGINA, paginacion.total)} de {paginacion.total}
            </small>
            {totalPaginas > 1 && (
              <div className="overflow-auto align-self-stretch">
              <Pagination className="mb-0">
                <Pagination.First onClick={() => cargarHistorial(1)} disabled={pagina === 1} />
                <Pagination.Prev onClick={() => cargarHistorial(Math.max(1, pagina - 1))} disabled={pagina === 1} />
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1)
                  .map((n, i, arr) => (
                    <React.Fragment key={n}>
                      {i > 0 && arr[i - 1] !== n - 1 && <Pagination.Ellipsis disabled />}
                      <Pagination.Item active={n === pagina} onClick={() => cargarHistorial(n)}>
                        {n}
                      </Pagination.Item>
                    </React.Fragment>
                  ))}
                <Pagination.Next onClick={() => cargarHistorial(Math.min(totalPaginas, pagina + 1))} disabled={pagina === totalPaginas} />
                <Pagination.Last onClick={() => cargarHistorial(totalPaginas)} disabled={pagina === totalPaginas} />
              </Pagination>
              </div>
            )}
          </Card.Footer>
        )}
      </Card>
    </Container>
  );
};

export default HistorialCambios;
