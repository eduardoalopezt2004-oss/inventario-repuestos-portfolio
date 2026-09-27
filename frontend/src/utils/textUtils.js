// Elimina tildes/diacríticos y convierte a minúsculas para búsqueda insensible a acentos
export const normalize = str =>
  (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
