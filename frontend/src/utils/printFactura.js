const METODO_PAGO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  pago_movil: 'Pago Móvil',
  divisa: 'Divisa',
  otro: 'Otro'
};

const fmtBs = (v) =>
  `Bs. ${parseFloat(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildHTML({ tipo, numeroDoc, fecha, vendedor, cliente, items = [],
  tasaEfectiva, fuente, usarTasaCustom, metodoPago, motivo, observaciones, empresa }) {

  const hasTasa = !!tasaEfectiva;

  // Calcular precios base (sin IVA) en Bs para cada ítem
  const itemsCalc = items.map(item => {
    const cant = item.cantidad;
    const precioUsd = parseFloat(item.precio || 0);
    if (hasTasa) {
      const precioBaseBs = (precioUsd * tasaEfectiva) / 1.16;
      return {
        ...item,
        precioUnit: fmtBs(precioBaseBs),
        subtotalBase: precioBaseBs * cant,
        subtotalFmt: fmtBs(precioBaseBs * cant)
      };
    }
    return {
      ...item,
      precioUnit: '—',
      subtotalBase: 0,
      subtotalFmt: '—'
    };
  });

  const subtotal = itemsCalc.reduce((s, i) => s + i.subtotalBase, 0);
  const iva      = subtotal * 0.16;
  const total    = subtotal + iva;

  const subtotalFmt = hasTasa ? fmtBs(subtotal) : '—';
  const ivaFmt      = hasTasa ? fmtBs(iva)      : '—';
  const totalFmt    = hasTasa ? fmtBs(total)     : '—';

  const tasaRow = hasTasa
    ? `<p><strong>Tasa:</strong> ${fmtBs(tasaEfectiva)}/USD ${usarTasaCustom ? '(personalizada)' : `(${fuente || 'BCV'})`}</p>`
    : '';

  const itemsHTML = itemsCalc.map(item => `<tr>
    <td>${item.nombre}${item.codigo ? `<br/><span style="color:#888;font-size:10px">Cod: ${item.codigo}</span>` : ''}</td>
    <td style="font-size:11px;color:#555">${item.marca || '—'}</td>
    <td style="text-align:center">${item.cantidad}</td>
    <td style="text-align:right">${item.precioUnit}</td>
    <td style="text-align:right">${item.subtotalFmt}</td>
  </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${tipo === 'venta' ? 'Factura' : 'Comprobante'} ${numeroDoc || ''}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{font-family:Arial,sans-serif;font-size:13px;color:#222;padding:28px;max-width:800px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;flex-wrap:wrap;gap:12px}
    .company{font-size:22px;font-weight:700;color:#1a1a2e}
    .sub{color:#666;font-size:12px;margin-top:4px}
    .doc-title{font-size:18px;font-weight:700;color:#1a1a2e}
    hr{border:none;border-top:2px solid #1a1a2e;margin:12px -28px}
    .meta{display:flex;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px}
    .meta p{margin:4px 0;font-size:12px}
    table{width:100%;border-collapse:collapse;margin:14px 0}
    thead th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tbody td{padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
    tfoot td{padding:8px 10px;font-size:13px}
    tfoot tr.subtotal td,tfoot tr.iva td{background:#f8f8f8;font-weight:400;color:#444;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    tfoot tr.total td{background:#f0f0f0;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .obs{margin-top:10px;font-size:12px}
    .footer{margin-top:28px;text-align:center;color:#999;font-size:11px;border-top:1px solid #eee;padding-top:12px}
    .btn{display:block;margin:22px auto 0;padding:12px 30px;background:#1a1a2e;color:#fff;
         border:none;border-radius:4px;cursor:pointer;font-size:14px;font-weight:600;width:100%;max-width:280px}
    @media print{.btn{display:none}}
    @media(max-width:600px){
      .header,.meta{flex-direction:column}
      table{font-size:11px}
      thead th,tbody td,tfoot td{padding:5px 6px}
      .btn{display:none}
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company">${empresa}</div>
      <div class="sub">Sistema de Gestión de Inventario</div>
    </div>
    <div>
      <div class="doc-title">${tipo === 'venta' ? 'FACTURA' : 'COMPROBANTE DE SALIDA'}</div>
      <p style="margin-top:6px;font-size:13px"><strong>N°:</strong> ${numeroDoc || 'N/A'}</p>
      <p style="font-size:13px"><strong>Fecha:</strong> ${fecha}</p>
    </div>
  </div>
  <hr/>
  <div class="meta">
    <div>
      ${vendedor ? `<p><strong>Vendedor:</strong> ${vendedor}</p>` : ''}
      ${cliente?.nombre   ? `<p><strong>Cliente:</strong> ${cliente.nombre}</p>`   : ''}
      ${cliente?.cedula   ? `<p><strong>Cédula:</strong> ${cliente.cedula}</p>`    : ''}
      ${cliente?.telefono ? `<p><strong>Teléfono:</strong> ${cliente.telefono}</p>` : ''}
      ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
    </div>
    <div>
      <p><strong>Método de Pago:</strong> ${METODO_PAGO[metodoPago] || metodoPago || '—'}</p>
      ${tasaRow}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th>Marca</th>
        <th style="text-align:center">Cant.</th>
        <th style="text-align:right">P. Unit (Bs)</th>
        <th style="text-align:right">Subtotal (Bs)</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
    <tfoot>
      <tr class="subtotal">
        <td colspan="4" style="text-align:right">Subtotal:</td>
        <td style="text-align:right">${subtotalFmt}</td>
      </tr>
      <tr class="iva">
        <td colspan="4" style="text-align:right">IVA (16%):</td>
        <td style="text-align:right">${ivaFmt}</td>
      </tr>
      <tr class="total">
        <td colspan="4" style="text-align:right">TOTAL:</td>
        <td style="text-align:right">${totalFmt}</td>
      </tr>
    </tfoot>
  </table>
  ${observaciones ? `<p class="obs"><strong>Observaciones:</strong> ${observaciones}</p>` : ''}
  <div class="footer"><p>Gracias por su preferencia &mdash; ${empresa}</p></div>
  <button class="btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
</body>
</html>`;
}

function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 150);
}

export function openFacturaWindow() {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) return null;
  return window.open('', '_blank');
}

export function printFactura(opts, preOpenedWindow) {
  const options = { tipo: 'venta', items: [], empresa: 'Lubrieduarcars', ...opts };
  const html = buildHTML(options);
  const prefix = options.tipo === 'venta' ? 'factura' : 'comprobante';
  const filename = `${prefix}-${options.numeroDoc || Date.now()}.html`;

  const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (isMobile) {
    downloadHTML(html, filename);
    return;
  }

  const win = preOpenedWindow || window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  } else {
    downloadHTML(html, filename);
  }
}
