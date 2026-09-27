const https = require('https');
const TasaBCV = require('../models/TasaBCV');

const CACHE_DURATION_MS = 5 * 60 * 1000;

let cache = {
  tasa: null,
  fuente: null,
  ultimaActualizacion: null,
  timestamp: null
};

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Timeout al consultar el BCV'));
    });
    req.on('error', reject);
  });
}

async function scrapearBCV() {
  // BCV usa un certificado con cadena incompleta; rejectUnauthorized:false es necesario
  const html = await fetchUrl('https://www.bcv.org.ve/', { rejectUnauthorized: false });

  const dolarMatch = html.match(/<div id="dolar"[\s\S]*?<strong class="strong-tb">\s*([\d,\.]+)\s*<\/strong>/);
  if (!dolarMatch) throw new Error('No se pudo extraer la tasa del sitio BCV');

  const tasa = parseFloat(dolarMatch[1].replace(',', '.'));
  if (isNaN(tasa) || tasa <= 0) throw new Error('Tasa inválida en el sitio BCV');

  const fechaMatch = html.match(/class="date-display-single"[^>]*content="([^"]+T[^"]+)"/);
  const fechaActualizacion = fechaMatch ? fechaMatch[1] : new Date().toISOString();

  return { tasa, fechaActualizacion };
}

async function guardarEnMongo(tasa, fechaActualizacion) {
  try {
    await TasaBCV.findByIdAndUpdate(
      'singleton',
      { tasa, fechaActualizacion, actualizadoEn: new Date() },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.warn('[Dólar] No se pudo guardar en MongoDB:', e.message);
  }
}

async function obtenerDesdeMongo() {
  try {
    return await TasaBCV.findById('singleton');
  } catch {
    return null;
  }
}

async function obtenerTasa() {
  const ahora = Date.now();

  if (cache.tasa && cache.timestamp && (ahora - cache.timestamp) < CACHE_DURATION_MS) {
    return { ...cache, desdeCache: true };
  }

  try {
    const { tasa, fechaActualizacion } = await scrapearBCV();

    cache = { tasa, fuente: 'BCV', ultimaActualizacion: fechaActualizacion, timestamp: ahora };
    guardarEnMongo(tasa, fechaActualizacion);

    console.log(`[Dólar] Tasa actualizada desde BCV: ${tasa} Bs/USD (${fechaActualizacion})`);
    return { ...cache, desdeCache: false };
  } catch (error) {
    if (cache.tasa) {
      console.warn('[Dólar] Error scrapeando BCV, usando caché memoria:', error.message);
      return { ...cache, desdeCache: true, advertencia: 'Usando tasa en caché' };
    }

    const mongo = await obtenerDesdeMongo();
    if (mongo) {
      cache = { tasa: mongo.tasa, fuente: 'BCV', ultimaActualizacion: mongo.fechaActualizacion, timestamp: ahora };
      console.warn('[Dólar] Error scrapeando BCV, usando tasa de MongoDB:', error.message);
      return { ...cache, desdeCache: true, advertencia: 'Usando tasa guardada (sin conexión al BCV)' };
    }

    throw error;
  }
}

module.exports = { obtenerTasa };
