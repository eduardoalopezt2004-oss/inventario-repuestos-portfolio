import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const ProductQRCode = ({ product }) => {
  const qrRef = useRef();

  const handlePrint = () => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>QR - ${product.codigo}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .label { text-align: center; padding: 20px; }
            .label h3 { margin: 10px 0 5px; }
            .label p { margin: 0; color: #666; }
          </style>
        </head>
        <body>
          <div class="label">
            ${svgData}
            <h3>${product.codigo}</h3>
            <p>${product.nombre}</p>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="text-center mt-3" ref={qrRef}>
      <QRCodeSVG value={product.codigo} size={128} level="M" />
      <p className="mt-2 mb-1"><small className="text-muted">{product.codigo}</small></p>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handlePrint}>
        <i className="fas fa-print mr-1"></i>
        Imprimir QR
      </button>
    </div>
  );
};

export default ProductQRCode;
