/**
 * Un código UPC-A (12 dígitos) es, numéricamente, un EAN-13 (13 dígitos)
 * con un "0" al inicio — es el mismo código físico visto por dos estándares
 * distintos. El problema en la práctica: según el lector, el mismo código
 * de barras llega distinto —
 *   - la cámara del teléfono (vía el detector del navegador) suele
 *     reportarlo como EAN-13, con el "0" agregado al inicio.
 *   - una pistola física normalmente transmite el UPC-A "crudo", tal cual
 *     está impreso, sin ese "0".
 * Esta utilidad genera las variantes equivalentes de un código para que,
 * sin importar cuál lector lo haya leído (ni con cuál se haya registrado
 * el producto originalmente), la búsqueda lo reconozca igual.
 */

/**
 * Dado un código escaneado/tecleado, devuelve la lista de formas
 * equivalentes a comparar (incluye siempre el código tal cual se recibió).
 *
 * - "0" + 12 dígitos (13 en total) → también prueba sin el "0" (UPC-A).
 * - 12 dígitos exactos → también prueba con un "0" al inicio (EAN-13).
 *
 * @param {string} codigo
 * @returns {string[]}
 */
export function variantesCodigoBarras(codigo) {
  const limpio = String(codigo ?? '').trim();
  const variantes = [limpio];

  if (/^0\d{12}$/.test(limpio)) {
    variantes.push(limpio.slice(1));
  } else if (/^\d{12}$/.test(limpio)) {
    variantes.push(`0${limpio}`);
  }

  return variantes;
}

/**
 * true si `codigoProducto` coincide con `codigoEscaneado` considerando el
 * caso UPC-A ⇄ EAN-13 (con o sin el "0" inicial).
 *
 * @param {string} codigoProducto
 * @param {string} codigoEscaneado
 * @returns {boolean}
 */
export function coincideCodigoBarras(codigoProducto, codigoEscaneado) {
  const variantes = variantesCodigoBarras(codigoEscaneado);
  return variantes.includes(String(codigoProducto ?? '').trim());
}
