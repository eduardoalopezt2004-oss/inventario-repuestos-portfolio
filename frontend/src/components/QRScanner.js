import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useHardwareScanner, useSuspendGlobalScanner } from '../hooks/useHardwareScanner';

const QRScanner = ({ onScan, onClose }) => {
  const [error, setError] = useState('');

  const procesarCodigo = (codigo) => {
    if (codigo) {
      onScan(codigo);
      onClose();
    }
  };

  const handleScan = (result) => {
    if (result && result.length > 0) {
      procesarCodigo(result[0].rawValue);
    }
  };

  const handleError = (err) => {
    console.error('Error en escáner QR:', err);
    setError('No se pudo acceder a la cámara. Verifica los permisos.');
  };

  // Mientras este modal está abierto, una pistola conectada a la PC funciona
  // exactamente igual que la cámara: dispara el mismo procesarCodigo(). Y
  // se avisa al popup global de la pistola que no se abra encima de este modal.
  useHardwareScanner(procesarCodigo, { ignorarPausaGlobal: true });
  useSuspendGlobalScanner();

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-qrcode mr-2"></i>
              Escanear QR de Producto
            </h5>
            <button type="button" className="close" onClick={onClose}>
              <span>&times;</span>
            </button>
          </div>
          <div className="modal-body text-center">
            <div className="alert alert-info text-left py-2 mb-3">
              <i className="fas fa-info-circle mr-2"></i>
              Puedes escanear con la <strong>cámara</strong> de este equipo o con una <strong>pistola lectora</strong> conectada a la PC (USB/Bluetooth) — cualquiera de las dos funciona igual, en cualquier momento.
            </div>
            {error ? (
              <div className="alert alert-danger">{error}</div>
            ) : (
              <div style={{ maxWidth: '100%', margin: '0 auto' }}>
                <Scanner
                  onScan={handleScan}
                  onError={handleError}
                  constraints={{
                    facingMode: 'environment',
                    width: { min: 1280, ideal: 1920, max: 1920 },
                    height: { min: 720, ideal: 1080, max: 1080 }
                  }}
                  components={{ zoom: true, torch: true, finder: true }}
                  styles={{ container: { width: '100%' } }}
                />
              </div>
            )}
            <small className="text-muted d-block mt-2">
              Apunta la cámara al código de barras o QR del producto.
              Si el código es muy pequeño, usa el <strong>+</strong> de zoom o acerca la cámara para que se vea grande y nítido.
            </small>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="fas fa-times mr-2"></i>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
