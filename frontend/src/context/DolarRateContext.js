import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dolarAPI } from '../services/api';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const CACHE_KEY = 'lube_tasa_dolar';

function saveTasaCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, cachedAt: new Date().toISOString() })); } catch {}
}
function getTasaCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}

const DolarRateContext = createContext(null);

export function DolarRateProvider({ children }) {
  const [tasaBs, setTasaBs] = useState(null);
  const [fuente, setFuente] = useState('');
  const [ultimaActualizacion, setUltimaActualizacion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasa = useCallback(async () => {
    try {
      const response = await dolarAPI.getTasa();
      const data = response.data;
      setTasaBs(data.tasa);
      setFuente(data.fuente || 'BCV');
      setUltimaActualizacion(data.ultimaActualizacion || '');
      setError(null);
      saveTasaCache(data);
    } catch {
      const cached = getTasaCache();
      if (cached) {
        setTasaBs(cached.tasa);
        setFuente(cached.fuente || 'BCV');
        setUltimaActualizacion(cached.ultimaActualizacion || '');
        setError(null);
      } else {
        setError('No se pudo obtener la tasa de cambio');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasa();
    const interval = setInterval(fetchTasa, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchTasa]);

  const convertirABs = useCallback(
    (montoUsd) => {
      if (!tasaBs || montoUsd == null) return null;
      return montoUsd * tasaBs;
    },
    [tasaBs]
  );

  const convertirADolar = useCallback(
    (montoBs) => {
      if (!tasaBs || montoBs == null || tasaBs === 0) return null;
      return montoBs / tasaBs;
    },
    [tasaBs]
  );

  const formatBs = useCallback((montoBs) => {
    if (montoBs == null) return 'Bs. —';
    return `Bs. ${montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  return (
    <DolarRateContext.Provider value={{ tasaBs, fuente, ultimaActualizacion, loading, error, convertirABs, convertirADolar, formatBs }}>
      {children}
    </DolarRateContext.Provider>
  );
}

export function useDolarRate() {
  const ctx = useContext(DolarRateContext);
  if (!ctx) throw new Error('useDolarRate must be used within DolarRateProvider');
  return ctx;
}
