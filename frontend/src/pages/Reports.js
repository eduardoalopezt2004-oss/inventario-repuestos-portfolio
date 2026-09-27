import React, { useState } from 'react';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { cacheReport, computeReportFromCache } from '../utils/offlineQueue';

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);

  const reportTypes = [
    { value: 'sales', label: 'Reporte de Ventas', icon: 'fas fa-shopping-cart' },
    { value: 'inventory', label: 'Inventario General', icon: 'fas fa-boxes' },
    { value: 'inventory_deposito', label: 'Inventario Depósito', icon: 'fas fa-warehouse' },
    { value: 'inventory_local', label: 'Inventario Local', icon: 'fas fa-store' },
    { value: 'categories', label: 'Reporte de Categorías', icon: 'fas fa-tags' },
    { value: 'movements', label: 'Reporte de Movimientos', icon: 'fas fa-exchange-alt' },
  ];

  // Definición de columnas por tipo de reporte (mismos datos que muestra el sistema)
  const columnDefs = {
    sales: [
      { header: 'N° Venta', value: r => r.numeroVenta || '' },
      { header: 'Fecha', value: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '' },
      { header: 'Vendedor', value: r => r.vendedor?.nombre || '' },
      { header: 'Cliente', value: r => r.cliente?.nombre || 'N/A' },
      { header: 'Total (USD)', value: r => r.total != null ? `$${Number(r.total).toLocaleString()}` : '' },
      { header: 'Total (Bs)', value: r => r.totalBs != null ? `Bs. ${Number(r.totalBs).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' },
      { header: 'Método Pago', value: r => r.metodoPago || '' },
      { header: 'Estado', value: r => r.estado || '' },
    ],
    inventory: [
      { header: 'Código', value: r => r.codigo || '' },
      { header: 'Producto', value: r => r.nombre || '' },
      { header: 'Descripción', value: r => r.descripcion || '' },
      { header: 'Marca', value: r => r.marca || '' },
      { header: 'Modelo', value: r => r.modelo || '' },
      { header: 'Categoría', value: r => r.categoria?.nombre || '' },
      { header: 'Precio Compra', value: r => r.precioCompra != null ? Number(r.precioCompra) : '' },
      { header: 'Precio Venta', value: r => r.precioVenta != null ? Number(r.precioVenta) : '' },
      { header: 'Stock Depósito', value: r => r.stockDeposito ?? 0 },
      { header: 'Stock Local', value: r => r.stockLocal ?? 0 },
      { header: 'Stock Total', value: r => (r.stockDeposito ?? 0) + (r.stockLocal ?? 0) },
      { header: 'Mínimo Depósito', value: r => r.stockMinimoDeposito ?? '' },
      { header: 'Mínimo Local', value: r => r.stockMinimoLocal ?? '' },
      { header: 'Stock Máximo', value: r => r.stockMaximo ?? '' },
      { header: 'Ubicación', value: r => r.ubicacion || '' },
      { header: 'Activo', value: r => r.activo ? 'Sí' : 'No' },
      { header: 'Fecha Registro', value: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '' },
    ],
    inventory_deposito: [
      { header: 'Código', value: r => r.codigo || '' },
      { header: 'Producto', value: r => r.nombre || '' },
      { header: 'Stock Depósito', value: r => r.stockDeposito ?? 0 },
    ],
    inventory_local: [
      { header: 'Código', value: r => r.codigo || '' },
      { header: 'Producto', value: r => r.nombre || '' },
      { header: 'Stock Local', value: r => r.stockLocal ?? 0 },
    ],
    categories: [
      { header: 'Nombre', value: r => r.nombre || '' },
      { header: 'Descripción', value: r => r.descripcion || '' },
      { header: 'Activa', value: r => r.activo ? 'Sí' : 'No' },
    ],
    movements: [
      { header: 'Fecha', value: r => r.createdAt ? new Date(r.createdAt).toLocaleString() : '' },
      { header: 'Tipo', value: r => (r._tipo || '').replace(/_/g, ' ') },
      { header: 'Producto', value: r => r.producto ? `${r.producto.codigo || ''} - ${r.producto.nombre || ''}` : '' },
      { header: 'Cantidad', value: r => r.cantidad != null ? Math.abs(r.cantidad) : '' },
      { header: 'Stock Anterior', value: r => r.stockAnterior != null ? r.stockAnterior : '' },
      { header: 'Stock Nuevo', value: r => r.stockNuevo != null ? r.stockNuevo : '' },
      { header: 'Origen → Destino', value: r => r.ubicacionOrigen ? `${r.ubicacionOrigen} → ${r.ubicacionDestino || ''}` : '—' },
      { header: 'Usuario', value: r => r.usuario?.nombre || '' },
      { header: 'Motivo', value: r => r.motivo || '' },
      { header: 'Estado', value: r => r.cancelado ? 'Cancelado' : r.estado === 'cancelada' ? 'Cancelada' : r.aprobado === false ? 'Pendiente' : 'Aprobado' },
    ],
  };

  const getColumns = () => columnDefs[reportType] || [];

  const formatRow = (row) => getColumns().map(col => String(col.value(row) ?? ''));

  const generateReport = async () => {
    setLoading(true);
    try {
      let response;
      // Asegurar que "hasta" cubra el día completo (23:59:59)
      const hastaFinal = dateRange.endDate + 'T23:59:59.999Z';
      switch (reportType) {
        case 'sales':
          response = await api.get('/sales', {
            params: {
              desde: dateRange.startDate,
              hasta: hastaFinal
            }
          });
          break;
        case 'inventory':
        case 'inventory_deposito':
        case 'inventory_local':
          response = await api.get('/products');
          break;
        case 'categories':
          response = await api.get('/categories');
          break;
        case 'movements': {
          const [movRes, txRes] = await Promise.all([
            api.get('/inventory/movimientos', { params: { fechaDesde: dateRange.startDate, fechaHasta: hastaFinal, limit: 1000 } }),
            api.get('/inventory-advanced/transactions', { params: { fechaDesde: dateRange.startDate, fechaHasta: hastaFinal, limit: 1000 } }).catch(() => ({ data: [] }))
          ]);
          const movimientos = (Array.isArray(movRes.data) ? movRes.data : movRes.data?.movimientos || [])
            .map(r => ({ ...r, _tipo: r.tipo }));
          const transacciones = (Array.isArray(txRes.data) ? txRes.data : txRes.data?.transactions || [])
            .filter(r => r.tipoTransaccion === 'transferencia')
            .map(r => ({ ...r, _tipo: r.tipoTransaccion }));
          const combinado = [...movimientos, ...transacciones]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setReportData(combinado);
          cacheReport(reportType, combinado);
          toast.success(`Reporte generado: ${combinado.length} registros`);
          setLoading(false);
          return;
        }
        default:
          response = { data: [] };
      }
      // Normalizar siempre a array
      const data = response.data;
      let normalizado;
      if (Array.isArray(data)) {
        normalizado = data;
      } else if (data && Array.isArray(data.movimientos)) {
        normalizado = data.movimientos;
      } else if (data && Array.isArray(data.categories)) {
        normalizado = data.categories;
      } else if (data && Array.isArray(data.sales)) {
        normalizado = data.sales;
      } else {
        normalizado = [];
      }
      setReportData(normalizado);
      cacheReport(reportType, normalizado);
      if (normalizado.length > 0) {
        toast.success(`Reporte generado: ${normalizado.length} registros`);
      } else {
        toast.info('No se encontraron registros para el período seleccionado');
      }
    } catch {
      const local = computeReportFromCache(reportType, dateRange.startDate, dateRange.endDate);
      setReportData(local);
      if (local.length > 0) {
        toast.info(`Sin conexión — reporte calculado desde datos locales: ${local.length} registros`);
      } else {
        toast.warning('Sin conexión y sin datos locales para este reporte');
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) {
      toast.warning('No hay datos para exportar');
      return;
    }

    const columns = getColumns();
    const headers = columns.map(c => c.header);
    const rows = [
      headers.join(','),
      ...reportData.map(row =>
        columns.map(col => {
          const val = String(col.value(row) ?? '').replace(/,/g, ';');
          return `"${val}"`;
        }).join(',')
      )
    ];

    if (reportType === 'sales') {
      const totalUsd = reportData.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      const totalBs  = reportData.reduce((sum, r) => sum + (Number(r.totalBs) || 0), 0);
      const totalRow = columns.map((col, i) => {
        if (i === 3) return '"Total General:"';
        if (i === 4) return `"$${totalUsd.toLocaleString()}"`;
        if (i === 5) return totalBs > 0 ? `"Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"` : '"—"';
        return '""';
      }).join(',');
      rows.push(totalRow);
    }

    const csvContent = rows.join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_${reportType}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte exportado a CSV');
  };

  const exportToXLS = () => {
    if (!reportData || reportData.length === 0) {
      toast.warning('No hay datos para exportar');
      return;
    }

    const columns = getColumns();
    const headers = columns.map(c => c.header);
    const rows = [
      headers,
      ...reportData.map(row => columns.map(col => col.value(row) ?? ''))
    ];

    if (reportType === 'sales') {
      const totalUsd = reportData.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      const totalBs  = reportData.reduce((sum, r) => sum + (Number(r.totalBs) || 0), 0);
      const totalRow = columns.map((col, i) => {
        if (i === 3) return 'Total General:';
        if (i === 4) return `$${totalUsd.toLocaleString()}`;
        if (i === 5) return totalBs > 0 ? `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
        return '';
      });
      rows.push(totalRow);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');
    XLSX.writeFile(workbook, `reporte_${reportType}_${Date.now()}.xlsx`);
    toast.success('Reporte exportado a XLS');
  };

  const exportToPDF = () => {
    if (!reportData || reportData.length === 0) {
      toast.warning('No hay datos para exportar');
      return;
    }

    const columns = getColumns();
    const reportLabel = reportTypes.find(r => r.value === reportType)?.label || 'Reporte';
    const periodoTexto = `Per\u00edodo: ${dateRange.startDate} al ${dateRange.endDate}`;

    const tableRows = reportData.slice(0, 500).map(row =>
      `<tr>${columns.map(col =>
        `<td>${String(col.value(row) ?? '')}</td>`
      ).join('')}</tr>`
    ).join('');

    let totalFooter = '';
    if (reportType === 'sales') {
      const totalUsd = reportData.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      const totalBs  = reportData.reduce((sum, r) => sum + (Number(r.totalBs) || 0), 0);
      totalFooter = `<tfoot><tr style="font-weight:bold;background:#e9ecef;">
        <td colspan="4" style="text-align:right;padding:8px;">Total General:</td>
        <td style="padding:8px;">$${totalUsd.toLocaleString()}</td>
        <td style="padding:8px;">${totalBs > 0 ? `Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
        <td colspan="2"></td>
      </tr></tfoot>`;
    }

    const printContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    .info { font-size: 11px; color: #666; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #333; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 11px; word-break: break-word; }
    tr:nth-child(even) td { background: #f5f5f5; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <h1>${reportLabel}</h1>
  <p class="info">${periodoTexto} &mdash; Generado: ${new Date().toLocaleString('es-ES')} &mdash; ${reportData.length} registros</p>
  <table>
    <thead><tr>${columns.map(c => `<th>${c.header}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
    ${totalFooter}
  </table>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Verifica que no esté bloqueada por el navegador.');
      return;
    }
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
    toast.success('Ventana de impresión abierta');
  };

  return (
    <div className="content-wrapper">
      <div className="content-header">
        <div className="container-fluid">
          <div className="row mb-2">
            <div className="col-sm-6">
              <h1 className="m-0">
                <i className="fas fa-chart-line mr-2"></i>
                Reportes
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        <div className="container-fluid">
          {/* Selector de tipo de reporte */}
          <div className="row mb-4">
            {reportTypes.map((type) => (
              <div key={type.value} className="col-lg-2 col-md-4 col-sm-6 mb-3">
                <div
                  className={`card ${reportType === type.value ? 'border-primary' : ''}`}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: reportType === type.value ? 'scale(1.05)' : 'scale(1)'
                  }}
                  onClick={() => setReportType(type.value)}
                >
                  <div className="card-body text-center">
                    <i className={`${type.icon} fa-3x mb-3`} style={{
                      color: reportType === type.value ? '#2563EB' : '#6B7280'
                    }}></i>
                    <h5 className="card-title">{type.label}</h5>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filtros y opciones */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Configuración del Reporte</h3>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Fecha Inicio</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group">
                    <label>Fecha Fin</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <label>&nbsp;</label>
                  <button
                    className="btn btn-primary btn-block"
                    onClick={generateReport}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>
                        Generando...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-sync-alt mr-2"></i>
                        Generar Reporte
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultados del reporte */}
          {reportData && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Resultados del Reporte</h3>
                <div className="card-tools">
                  <button className="btn btn-success btn-sm mr-2" onClick={exportToCSV}>
                    <i className="fas fa-file-csv mr-1"></i>
                    Exportar CSV
                  </button>
                  <button className="btn btn-primary btn-sm mr-2" onClick={exportToXLS}>
                    <i className="fas fa-file-excel mr-1"></i>
                    Exportar XLS
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={exportToPDF}>
                    <i className="fas fa-file-pdf mr-1"></i>
                    Exportar PDF
                  </button>
                </div>
              </div>
              <div className="card-body">
                {reportData.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-inbox"></i>
                    <h4>No hay datos disponibles</h4>
                    <p>No se encontraron registros para el período seleccionado</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead>
                        <tr>
                          {getColumns().map((col, i) => (
                            <th key={i}>{col.header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.slice(0, 50).map((row, index) => (
                          <tr key={index}>
                            {formatRow(row).map((val, i) => (
                              <td key={i}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      {reportType === 'sales' && reportData.length > 0 && (
                        <tfoot>
                          <tr style={{ fontWeight: 'bold', backgroundColor: '#e9ecef' }}>
                            <td colSpan={4} style={{ textAlign: 'right' }}>Total General:</td>
                            <td>${reportData.reduce((sum, r) => sum + (Number(r.total) || 0), 0).toLocaleString()}</td>
                            <td>{(() => { const t = reportData.reduce((sum, r) => sum + (Number(r.totalBs) || 0), 0); return t > 0 ? `Bs. ${t.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'; })()}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    {reportData.length > 50 && (
                      <div className="text-center text-muted">
                        Mostrando 50 de {reportData.length} registros
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
