import React from 'react';
import { Modal, Table, Button } from 'react-bootstrap';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { describeQueueItem } from '../../utils/offlineQueue';

const TIPO_LABEL = {
  'product-create': 'Crear producto',
  'product-update': 'Actualizar producto',
  'product-delete': 'Eliminar producto',
  'ajuste-aprobar': 'Aprobar ajuste',
  'user-create': 'Crear usuario',
  'user-update': 'Actualizar usuario',
  'user-delete': 'Eliminar usuario',
  pago: 'Pago de crédito',
  prorroga: 'Prórroga de crédito',
  entrada: 'Entrada de inventario',
  salida: 'Salida de inventario',
  transferencia: 'Transferencia de inventario',
  sale: 'Venta',
  import: 'Importación'
};

const PendingSyncModal = ({ show, onHide }) => {
  const { pendingItems, retryItem, discardItem, isSyncing, syncQueue } = useOnlineStatus();

  const handleDiscard = (item) => {
    if (window.confirm('¿Está seguro de descartar esta operación pendiente? No se sincronizará con el servidor.')) {
      discardItem(item.id);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="fw-light">
          <i className="fas fa-clock me-2"></i>
          Operaciones pendientes de sincronización
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {pendingItems.length === 0 ? (
          <div className="alert alert-info mb-0">
            <i className="fas fa-info-circle mr-2"></i>
            No hay operaciones pendientes
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover>
              <thead>
                <tr>
                  <th>Fecha/Hora</th>
                  <th>Tipo</th>
                  <th>Operación</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                    <td>{TIPO_LABEL[item.tipo] || item.tipo}</td>
                    <td>{describeQueueItem(item)}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        className="me-2"
                        disabled={isSyncing}
                        onClick={() => retryItem(item.id)}
                      >
                        <i className="fas fa-redo me-1"></i>
                        Reintentar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        disabled={isSyncing}
                        onClick={() => handleDiscard(item)}
                      >
                        <i className="fas fa-trash me-1"></i>
                        Descartar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cerrar
        </Button>
        <Button variant="dark" disabled={isSyncing || pendingItems.length === 0} onClick={syncQueue}>
          {isSyncing ? (
            <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Sincronizando...</>
          ) : (
            <><i className="fas fa-sync me-2"></i>Reintentar todo</>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default PendingSyncModal;
