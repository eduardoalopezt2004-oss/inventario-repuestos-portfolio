const xlsx = require('xlsx');

/**
 * Mapea filas de un sheet a objetos de producto buscando columnas por palabras clave.
 */
function mapSheetRows(rows) {
  if (!rows || rows.length === 0) return [];

  const keys = Object.keys(rows[0] || {});

  const find = (keywords) =>
    keys.find((k) => keywords.some((kw) => k.toLowerCase().includes(kw))) || null;

  const colCodigo = find(['código', 'codigo', 'sku', 'referencia', 'ref', 'cod', 'code']);
  const colNombre = find(['nombre', 'descripcion', 'descripción', 'producto', 'articulo', 'artículo', 'name', 'item']);
  const colMarca  = find(['marca', 'brand']);
  const colModelo = find(['modelo', 'model']);
  const colPrecio = find(['precio', 'costo', 'cost', 'price', 'compra', 'unitario']);
  const colStock  = find(['stock', 'cantidad', 'qty', 'quantity', 'existencia']);

  return rows
    .map((row) => ({
      codigo:       colCodigo ? String(row[colCodigo] || '').trim() : '',
      nombre:       colNombre ? String(row[colNombre] || '').trim() : '',
      descripcion:  '',
      marca:        colMarca  ? String(row[colMarca]  || '').trim() : '',
      modelo:       colModelo ? String(row[colModelo] || '').trim() : '',
      precioCompra: parseFloat(colPrecio ? row[colPrecio] : 0) || 0,
      stock:        parseInt(colStock  ? row[colStock]  : 0, 10) || 0
    }))
    .filter((p) => p.codigo || p.nombre);
}

/**
 * Parsea un archivo Excel o CSV y retorna un array de productos.
 * @param {Express.Multer.File} file
 * @returns {Array}
 */
function parseFile(file) {
  const { mimetype, buffer, originalname } = file;
  const ext = originalname.split('.').pop().toLowerCase();

  const isExcelOrCsv =
    mimetype === 'text/csv' ||
    mimetype === 'application/csv' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel' ||
    ['csv', 'xlsx', 'xls'].includes(ext);

  if (!isExcelOrCsv) {
    throw new Error(`Tipo de archivo no soportado: ${ext}. Use Excel (.xlsx, .xls) o CSV.`);
  }

  const workbook  = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows      = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  return mapSheetRows(rows);
}

module.exports = { parseFile };
