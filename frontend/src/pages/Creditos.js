import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Form, InputGroup } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { creditoAPI, saleAPI } from '../services/api';
import AuthContext from '../context/AuthContext';
import useDolarRate from '../hooks/useDolarRate';
import { printFactura, openFacturaWindow } from '../utils/printFactura';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { enqueue, cacheCreditos, getCachedCreditos, updateLocalCreditoPago, updateLocalCreditoProrroga } from '../utils/offlineQueue';

const ESTADO_BADGE = { pendiente: 'warning', parcial: 'info', cancelado: 'success', vencido: 'danger' };
const ESTADO_LABEL = { pendiente: 'Pendiente', parcial: 'Pago parcial', cancelado: 'Cancelado', vencido: 'Vencido' };

const pendienteDe = (c) => Math.max(0, (c.montoPendiente !== undefined ? c.montoPendiente : c.montoTotal - c.montoPagado));

const Creditos = () => {
  const { user } = useContext(AuthContext);
  const { tasaBs, formatBs } = useDolarRate();
  const { isOnline, lastSyncAt, refreshCount } = useOnlineStatus();

  const [creditos, setCreditos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState({ vencidos: 0, porVencer: 0 });
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Detalle
  const [showDetalle, setShowDetalle] = useState(false);
  const [creditoDetalle, setCreditoDetalle] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Pago
  const [showPago, setShowPago] = useState(false);
  const [creditoPago, setCreditoPago] = useState(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoUsarTasa, setPagoUsarTasa] = useState(true);
  const [pagoTasaCustom, setPagoTasaCustom] = useState('');
  const [loadingPago, setLoadingPago] = useState(false);

  // Prórroga
  const [showProrroga, setShowProrroga] = useState(false);
  const [creditoProrroga, setCreditoProrroga] = useState(null);
  const [prorrogaFecha, setProrrogaFecha] = useState('');
  const [prorrogaMotivo, setProrrogaMotivo] = useState('');
  const [loadingProrroga, setLoadingProrroga] = useState(false);

  const fetchCreditos = async (estado = filtroEstado, q = busqueda) => {
    setLoading(true);
    try {
      const params = {};
      if (estado) params.estado = estado;
      if (q) params.q = q;
      const res = await creditoAPI.getAll(params);
      setCreditos(res.data);
      if (!estado && !q) cacheCreditos(res.data);
    } catch {
      const cached = getCachedCreditos();
      if (cached) {
        setCreditos(cached);
        toast.info('Mostrando créditos en caché (sin conexión)');
      } else {
        toast.error('Error al cargar créditos');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAlertas = async () => {
    try {
      const res = await creditoAPI.getAlertas();
      setAlertas(res.data);
    } catch {}
  };

  useEffect(() => {
    fetchCreditos();
    fetchAlertas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  useEffect(() => {
    if (lastSyncAt) { fetchCreditos(); fetchAlertas(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncAt]);

  const handleBuscar = (e) => {
    e.preventDefault();
    fetchCreditos(filtroEstado, busqueda);
  };

  const limpiarFiltros = () => {
    setFiltroEstado('');
    setBusqueda('');
    fetchCreditos('', '');
  };

  const verDetalle = async (id) => {
    setLoadingDetalle(true);
    setShowDetalle(true);
    try {
      const res = await creditoAPI.getById(id);
      setCreditoDetalle(res.data);
    } catch {
      toast.error('Error al cargar detalle');
      setShowDetalle(false);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const abrirPago = (credito) => {
    setCreditoPago(credito);
    setPagoMonto('');
    setPagoUsarTasa(true);
    setPagoTasaCustom('');
    setShowPago(true);
  };

  const handlePago = async (e) => {
    e.preventDefault();
    const monto = parseFloat(pagoMonto);
    if (!monto || monto <= 0) { toast.error('Ingrese un monto válido'); return; }
    setLoadingPago(true);
    const tasaPago = pagoUsarTasa ? (tasaBs || 0) : parseFloat(pagoTasaCustom || 0);
    const pagoData = { monto, montoBs: tasaPago ? parseFloat((monto * tasaPago).toFixed(2)) : 0, tasaBs: tasaPago };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      enqueue('pago', `/creditos/${creditoPago._id}/pago`, 'post', pagoData);
      updateLocalCreditoPago(creditoPago._id, monto);
      refreshCount();
      toast.info('Sin conexión — pago guardado localmente. Se sincronizará al reconectarse.');
      setShowPago(false);
      fetchCreditos();
      setLoadingPago(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      const res = await creditoAPI.registrarPago(creditoPago._id, pagoData);
      toast.success('Pago registrado exitosamente');
      setShowPago(false);
      fetchCreditos();
      fetchAlertas();
      if (showDetalle && creditoDetalle?._id === creditoPago._id) {
        verDetalle(creditoPago._id);
      }

      // Imprimir factura solo si el crédito quedó cancelado (totalmente pagado)
      if (res.data?.credito?.estadoCredito === 'cancelado') {
        try {
          const ventaId = res.data.credito.venta;
          const facturaWin = openFacturaWindow();
          const saleRes = await saleAPI.getById(ventaId);
          const sale = saleRes.data;
          printFactura({
            tipo: 'venta',
            numeroDoc: sale.numeroVenta,
            fecha: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            vendedor: sale.vendedor?.nombre,
            cliente: creditoPago.cliente,
            items: (sale.items || []).map(item => ({
              nombre: item.producto?.nombre || 'Producto',
              codigo: item.producto?.codigo,
              marca: item.producto?.marca,
              cantidad: item.cantidad,
              precio: item.precioUnitario
            })),
            totalUsd: sale.total,
            totalBs: sale.totalBs,
            tasaEfectiva: tasaPago || sale.tasaBs,
            metodoPago: sale.metodoPago
          }, facturaWin);
        } catch { /* factura no crítica */ }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar pago');
    } finally {
      setLoadingPago(false);
    }
  };

  const abrirProrroga = (credito) => {
    setCreditoProrroga(credito);
    const d = new Date(credito.fechaVencimiento);
    d.setDate(d.getDate() + 15);
    setProrrogaFecha(d.toISOString().split('T')[0]);
    setProrrogaMotivo('');
    setShowProrroga(true);
  };

  const handleProrroga = async (e) => {
    e.preventDefault();
    if (!prorrogaFecha) { toast.error('Seleccione una nueva fecha'); return; }
    setLoadingProrroga(true);
    const prorrogaData = { fechaNueva: prorrogaFecha, motivo: prorrogaMotivo };

    // ── SIN CONEXIÓN ──
    if (!isOnline) {
      enqueue('prorroga', `/creditos/${creditoProrroga._id}/prorroga`, 'put', prorrogaData);
      updateLocalCreditoProrroga(creditoProrroga._id, prorrogaFecha);
      refreshCount();
      toast.info('Sin conexión — prórroga guardada localmente. Se sincronizará al reconectarse.');
      setShowProrroga(false);
      fetchCreditos();
      setLoadingProrroga(false);
      return;
    }

    // ── CON CONEXIÓN ──
    try {
      await creditoAPI.registrarProrroga(creditoProrroga._id, prorrogaData);
      toast.success('Prórroga registrada exitosamente');
      setShowProrroga(false);
      fetchCreditos();
      if (showDetalle && creditoDetalle?._id === creditoProrroga._id) {
        verDetalle(creditoProrroga._id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al registrar prórroga');
    } finally {
      setLoadingProrroga(false);
    }
  };

  const tasaPago = pagoUsarTasa ? (tasaBs || 0) : parseFloat(pagoTasaCustom || 0);

  return (
    <Container fluid className="px-4">
      <Row className="mb-4">
        <Col>
          <h2 className="fw-light">Créditos</h2>
        </Col>
      </Row>

      {/* Alertas */}
      {(alertas.vencidos > 0 || alertas.porVencer > 0) && (
        <Row className="mb-3 g-2">
          {alertas.vencidos > 0 && (
            <Col xs={12} sm="auto">
              <div className="alert alert-danger py-2 mb-0 d-flex align-items-center gap-2">
                <i className="fas fa-exclamation-circle"></i>
                <strong>{alertas.vencidos}</strong> crédito{alertas.vencidos > 1 ? 's' : ''} vencido{alertas.vencidos > 1 ? 's' : ''}
                <Button size="sm" variant="outline-danger" className="ms-2 py-0" onClick={() => setFiltroEstado('vencido')}>Ver</Button>
              </div>
            </Col>
          )}
          {alertas.porVencer > 0 && (
            <Col xs={12} sm="auto">
              <div className="alert alert-warning py-2 mb-0 d-flex align-items-center gap-2">
                <i className="fas fa-clock"></i>
                <strong>{alertas.porVencer}</strong> crédito{alertas.porVencer > 1 ? 's' : ''} por vencer (próx. 3 días)
              </div>
            </Col>
          )}
        </Row>
      )}

      {/* Filtros */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="py-3">
          <Row className="align-items-end g-2">
            <Col xs={12} md={5}>
              <Form onSubmit={handleBuscar}>
                <InputGroup size="sm">
                  <Form.Control
                    placeholder="Buscar por nombre o cédula..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                  />
                  <Button variant="outline-secondary" type="submit">
                    <i className="fas fa-search"></i>
                  </Button>
                  {busqueda && (
                    <Button variant="outline-secondary" onClick={limpiarFiltros}>
                      <i className="fas fa-times"></i>
                    </Button>
                  )}
                </InputGroup>
              </Form>
            </Col>
            <Col xs={12} md={4}>
              <Form.Select size="sm" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="parcial">Pago parcial</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Button size="sm" variant="outline-secondary" onClick={limpiarFiltros} title="Limpiar filtros">
                <i className="fas fa-redo"></i>
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabla */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Cliente</th>
                  <th>Cédula</th>
                  <th className="text-end">Total ($)</th>
                  <th className="text-end">Pagado ($)</th>
                  <th className="text-end">Pendiente ($)</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-4"><div className="spinner-border spinner-border-sm"></div></td></tr>
                ) : creditos.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-4 text-muted">No hay créditos registrados</td></tr>
                ) : creditos.map(c => {
                  const pend = pendienteDe(c);
                  const hoy = new Date();
                  const fv = new Date(c.fechaVencimiento);
                  const diasRestantes = Math.ceil((fv - hoy) / 86400000);
                  const vencido = c.estadoCredito === 'vencido';
                  const porVencer = !vencido && diasRestantes <= 3 && diasRestantes >= 0 && c.estadoCredito !== 'cancelado';
                  return (
                    <tr key={c._id} className={vencido ? 'table-danger' : porVencer ? 'table-warning' : ''}>
                      <td className="fw-semibold">{c.cliente?.nombre}</td>
                      <td className="text-muted">{c.cliente?.cedula || '—'}</td>
                      <td className="text-end">${c.montoTotal.toFixed(2)}</td>
                      <td className="text-end">${c.montoPagado.toFixed(2)}</td>
                      <td className="text-end fw-semibold">${pend.toFixed(2)}</td>
                      <td>
                        <span className={vencido ? 'text-danger' : porVencer ? 'text-warning fw-semibold' : ''}>
                          {fv.toLocaleDateString('es-VE')}
                          {porVencer && (
                            <small className="d-block" style={{ fontSize: 11 }}>
                              {diasRestantes === 0 ? 'Vence hoy' : `${diasRestantes}d restante${diasRestantes > 1 ? 's' : ''}`}
                            </small>
                          )}
                        </span>
                      </td>
                      <td>
                        <Badge bg={ESTADO_BADGE[c.estadoCredito] || 'secondary'} text={c.estadoCredito === 'pendiente' ? 'dark' : undefined}>
                          {ESTADO_LABEL[c.estadoCredito] || c.estadoCredito}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-end flex-wrap">
                          <Button variant="outline-secondary" size="sm" onClick={() => verDetalle(c._id)} title="Ver detalle">
                            <i className="fas fa-eye"></i>
                          </Button>
                          {c.estadoCredito !== 'cancelado' && (
                            <Button variant="outline-success" size="sm" onClick={() => abrirPago(c)} title="Registrar pago">
                              <i className="fas fa-dollar-sign"></i>
                            </Button>
                          )}
                          {user?.rol === 'admin' && c.estadoCredito !== 'cancelado' && (
                            <Button variant="outline-warning" size="sm" onClick={() => abrirProrroga(c)} title="Prórroga">
                              <i className="fas fa-calendar-plus"></i>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Modal Detalle */}
      <Modal show={showDetalle} onHide={() => { setShowDetalle(false); setCreditoDetalle(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fw-light">Detalle del Crédito</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetalle ? (
            <div className="text-center py-4"><div className="spinner-border"></div></div>
          ) : creditoDetalle ? (
            <>
              <Row className="mb-3">
                <Col sm={6}>
                  <div className="text-muted small mb-1">Cliente</div>
                  <div className="fw-semibold">{creditoDetalle.cliente?.nombre}</div>
                  <div className="text-muted small">
                    CI: {creditoDetalle.cliente?.cedula || '—'} · Tel: {creditoDetalle.cliente?.telefono || '—'}
                  </div>
                </Col>
                <Col sm={3}>
                  <div className="text-muted small mb-1">Estado</div>
                  <Badge bg={ESTADO_BADGE[creditoDetalle.estadoCredito]} text={creditoDetalle.estadoCredito === 'pendiente' ? 'dark' : undefined} style={{ fontSize: 13 }}>
                    {ESTADO_LABEL[creditoDetalle.estadoCredito]}
                  </Badge>
                </Col>
                <Col sm={3}>
                  <div className="text-muted small mb-1">Vencimiento</div>
                  <div>{new Date(creditoDetalle.fechaVencimiento).toLocaleDateString('es-VE')}</div>
                </Col>
              </Row>

              <Row className="mb-4 g-2">
                <Col xs={4}>
                  <div className="p-2 bg-light rounded text-center">
                    <div className="text-muted small">Total</div>
                    <div className="fw-bold">${creditoDetalle.montoTotal?.toFixed(2)}</div>
                  </div>
                </Col>
                <Col xs={4}>
                  <div className="p-2 bg-light rounded text-center">
                    <div className="text-muted small">Pagado</div>
                    <div className="fw-bold text-success">${creditoDetalle.montoPagado?.toFixed(2)}</div>
                  </div>
                </Col>
                <Col xs={4}>
                  <div className="p-2 bg-light rounded text-center">
                    <div className="text-muted small">Pendiente</div>
                    <div className="fw-bold text-danger">${pendienteDe(creditoDetalle).toFixed(2)}</div>
                  </div>
                </Col>
              </Row>

              <h6 className="fw-light mb-2">Historial de Pagos</h6>
              {!creditoDetalle.pagos?.length ? (
                <p className="text-muted small">Sin pagos registrados</p>
              ) : (
                <Table size="sm" bordered hover className="mb-4">
                  <thead className="table-light">
                    <tr>
                      <th>Fecha</th>
                      <th className="text-end">Monto ($)</th>
                      <th className="text-end">Monto (Bs)</th>
                      <th>Registrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditoDetalle.pagos.map((p, i) => (
                      <tr key={i}>
                        <td>{new Date(p.fecha).toLocaleDateString('es-VE')}</td>
                        <td className="text-end">${p.monto?.toFixed(2)}</td>
                        <td className="text-end text-muted">{p.montoBs ? `Bs. ${p.montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : '—'}</td>
                        <td className="text-muted">{p.registradoPor?.nombre || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              {creditoDetalle.prorrogas?.length > 0 && (
                <>
                  <h6 className="fw-light mb-2">Historial de Prórrogas</h6>
                  <Table size="sm" bordered hover>
                    <thead className="table-light">
                      <tr>
                        <th>Fecha anterior</th>
                        <th>Fecha nueva</th>
                        <th>Motivo</th>
                        <th>Otorgado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditoDetalle.prorrogas.map((p, i) => (
                        <tr key={i}>
                          <td>{new Date(p.fechaAnterior).toLocaleDateString('es-VE')}</td>
                          <td>{new Date(p.fechaNueva).toLocaleDateString('es-VE')}</td>
                          <td className="text-muted">{p.motivo || '—'}</td>
                          <td className="text-muted">{p.otorgadoPor?.nombre || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              )}
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          {creditoDetalle && creditoDetalle.estadoCredito !== 'cancelado' && (
            <>
              <Button variant="success" onClick={() => { setShowDetalle(false); abrirPago(creditoDetalle); }}>
                <i className="fas fa-dollar-sign me-1"></i> Registrar Pago
              </Button>
              {user?.rol === 'admin' && (
                <Button variant="warning" onClick={() => { setShowDetalle(false); abrirProrroga(creditoDetalle); }}>
                  <i className="fas fa-calendar-plus me-1"></i> Prórroga
                </Button>
              )}
            </>
          )}
          <Button variant="secondary" onClick={() => { setShowDetalle(false); setCreditoDetalle(null); }}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Pago */}
      <Modal show={showPago} onHide={() => setShowPago(false)}>
        <Modal.Header closeButton>
          <Modal.Title className="fw-light">Registrar Pago</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handlePago}>
          <Modal.Body>
            {creditoPago && (
              <div className="mb-3 p-2 bg-light rounded">
                <div className="fw-semibold">{creditoPago.cliente?.nombre}</div>
                <div className="text-muted small">
                  Pendiente: <strong>${pendienteDe(creditoPago).toFixed(2)}</strong>
                </div>
              </div>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Monto en USD <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                min="0.01"
                value={pagoMonto}
                onChange={e => setPagoMonto(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
              />
              {pagoMonto && tasaPago > 0 && (
                <Form.Text className="text-muted">
                  ≈ {formatBs(parseFloat(pagoMonto) * tasaPago)}
                </Form.Text>
              )}
            </Form.Group>
            <Form.Group>
              <Form.Label>Tasa de cambio</Form.Label>
              <div className="d-flex gap-3 align-items-center mb-2">
                <Form.Check
                  type="radio"
                  id="pago-tasa-bcv"
                  label={tasaBs ? `BCV — Bs. ${tasaBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}` : 'BCV (sin datos)'}
                  checked={pagoUsarTasa}
                  onChange={() => setPagoUsarTasa(true)}
                />
                <Form.Check
                  type="radio"
                  id="pago-tasa-custom"
                  label="Personalizada"
                  checked={!pagoUsarTasa}
                  onChange={() => setPagoUsarTasa(false)}
                />
              </div>
              {!pagoUsarTasa && (
                <Form.Control
                  type="number"
                  size="sm"
                  value={pagoTasaCustom}
                  onChange={e => setPagoTasaCustom(e.target.value)}
                  placeholder="Bs. por USD"
                  min="0"
                  step="0.01"
                  style={{ maxWidth: 180 }}
                />
              )}
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPago(false)}>Cancelar</Button>
            <Button variant="success" type="submit" disabled={loadingPago}>
              {loadingPago ? <><i className="fas fa-spinner fa-spin me-1"></i>Registrando...</> : 'Registrar Pago'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal Prórroga */}
      <Modal show={showProrroga} onHide={() => setShowProrroga(false)}>
        <Modal.Header closeButton>
          <Modal.Title className="fw-light">Registrar Prórroga</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleProrroga}>
          <Modal.Body>
            {creditoProrroga && (
              <div className="mb-3 p-2 bg-light rounded">
                <div className="fw-semibold">{creditoProrroga.cliente?.nombre}</div>
                <div className="text-muted small">
                  Vencimiento actual: {new Date(creditoProrroga.fechaVencimiento).toLocaleDateString('es-VE')}
                </div>
              </div>
            )}
            <Form.Group className="mb-3">
              <Form.Label>Nueva fecha de vencimiento <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="date"
                value={prorrogaFecha}
                onChange={e => setProrrogaFecha(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Motivo <span className="text-muted">(opcional)</span></Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={prorrogaMotivo}
                onChange={e => setProrrogaMotivo(e.target.value)}
                placeholder="Razón de la prórroga..."
                maxLength={500}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowProrroga(false)}>Cancelar</Button>
            <Button variant="warning" type="submit" disabled={loadingProrroga}>
              {loadingProrroga ? <><i className="fas fa-spinner fa-spin me-1"></i>Registrando...</> : 'Registrar Prórroga'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default Creditos;
