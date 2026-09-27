export const CAMPOS_LABEL = {
  codigo: 'Código',
  nombre: 'Nombre',
  descripcion: 'Descripción',
  marca: 'Marca',
  modelo: 'Modelo',
  categoria: 'Categoría',
  precioCompra: 'Precio de compra',
  precioVenta: 'Precio de venta',
  stockDeposito: 'Stock depósito',
  stockLocal: 'Stock local',
  stockMinimoLocal: 'Mínimo local',
  stockMinimoDeposito: 'Mínimo depósito',
  stockMaximo: 'Stock máximo',
  ubicacion: 'Ubicación',
  activo: 'Activo'
};

export const formatValorCambio = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
};
