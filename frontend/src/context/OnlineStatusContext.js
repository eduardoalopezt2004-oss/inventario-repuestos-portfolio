import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getQueue, removeFromQueue, updateQueueItem } from '../utils/offlineQueue';
import axiosInstance, { onServerReachabilityChange } from '../services/api';
import { toast } from 'react-toastify';

const OnlineStatusContext = createContext(null);

const SYNC_INTERVAL_MS = 30000;

// Reasigna el id temporal (item.tempId, asignado en offlineQueue.enqueue al encolar
// la creación) al _id real devuelto por el servidor, en los items restantes de la
// misma cola — tanto en su url como en su body (data), donde también puede aparecer
// referenciado (ej. una venta o una entrada de inventario sobre un producto creado
// offline). Antes se adivinaba el tempId buscando el primer item con "offline-" en
// la url a partir de fromIndex, lo cual asignaba el id real equivocado en cuanto
// había más de una creación pendiente del mismo tipo en la cola (ej. crear dos
// productos offline y editar el segundo antes de reconectar terminaba aplicando la
// edición al primero). Ahora se usa el tempId exacto que generó esa creación.
function remapTempId(items, fromIndex, tempId, realId) {
  if (!tempId) return;
  for (let k = fromIndex; k < items.length; k++) {
    const it = items[k];
    let newUrl = it.url;
    let newData = it.data;
    let changed = false;

    if (it.url && it.url.includes(tempId)) {
      newUrl = it.url.split(tempId).join(realId);
      changed = true;
    }
    if (it.data) {
      const serialized = JSON.stringify(it.data);
      if (serialized.includes(tempId)) {
        newData = JSON.parse(serialized.split(tempId).join(realId));
        changed = true;
      }
    }

    if (changed) {
      items[k] = { ...it, url: newUrl, data: newData };
      updateQueueItem(it.id, { url: newUrl, data: newData });
    }
  }
}

export function OnlineStatusProvider({ children }) {
  const [navOnline, setNavOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);
  const isOnline = navOnline && serverReachable;
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingItems, setPendingItems] = useState(() => getQueue());
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const syncingRef = useRef(false);
  const prevOnlineRef = useRef(isOnline);
  const pendingCount = pendingItems.length;

  useEffect(() => onServerReachabilityChange(setServerReachable), []);

  const refreshCount = useCallback(() => {
    setPendingItems(getQueue());
  }, []);

  const processItem = useCallback(async (item, items, index) => {
    try {
      const response = await axiosInstance.request({ method: item.method, url: item.url, data: item.data });
      removeFromQueue(item.id);
      if (item.tipo && item.tipo.includes('-create') && response.data && response.data._id) {
        remapTempId(items, index + 1, item.tempId, response.data._id);
      }
      return true;
    } catch (error) {
      const mensaje = error.response?.data?.message || error.message || 'Error desconocido';
      const status = error.response?.status;
      updateQueueItem(item.id, {
        ultimoError: status ? `(${status}) ${mensaje}` : mensaje,
        ultimoIntento: new Date().toISOString()
      });
      return false;
    }
  }, []);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const items = getQueue();
    if (items.length === 0) return;

    syncingRef.current = true;
    setIsSyncing(true);
    let ok = 0;
    let fail = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        const success = await processItem(items[i], items, i);
        if (success) ok++; else fail++;
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      refreshCount();
    }

    if (ok > 0) {
      setLastSyncAt(Date.now());
      toast.success(`${ok} operación(es) sincronizada(s) con el servidor.`);
    }
    if (fail > 0) toast.warning(`${fail} operación(es) no pudieron sincronizarse. Se reintentarán.`);
  }, [processItem, refreshCount]);

  const retryItem = useCallback(async (id) => {
    if (syncingRef.current) return;
    const items = getQueue();
    const index = items.findIndex(i => i.id === id);
    if (index === -1) return;

    syncingRef.current = true;
    setIsSyncing(true);
    let success = false;

    try {
      success = await processItem(items[index], items, index);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      refreshCount();
    }

    if (success) {
      setLastSyncAt(Date.now());
      toast.success('Operación sincronizada con el servidor.');
    } else {
      toast.warning('No se pudo sincronizar. Se reintentará más adelante.');
    }
  }, [processItem, refreshCount]);

  const discardItem = useCallback((id) => {
    removeFromQueue(id);
    refreshCount();
  }, [refreshCount]);

  // Sincronizar una vez al montar si ya hay conexión (cola de una sesión anterior)
  useEffect(() => {
    if (isOnline) syncQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar cada vez que se recupera la conexión (red o servidor)
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) syncQueue();
    prevOnlineRef.current = isOnline;
  }, [isOnline, syncQueue]);

  // Reintento periódico mientras haya operaciones pendientes
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline && pendingCount > 0 && !isSyncing) syncQueue();
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOnline, pendingCount, isSyncing, syncQueue]);

  useEffect(() => {
    const onOnline = () => {
      setNavOnline(true);
      toast.info('Conexión restaurada. Sincronizando datos...');
    };
    const onOffline = () => {
      setNavOnline(false);
      toast.warning('Sin conexión. Las operaciones se guardarán localmente.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <OnlineStatusContext.Provider value={{
      isOnline, isSyncing, pendingCount, pendingItems, lastSyncAt,
      syncQueue, refreshCount, retryItem, discardItem
    }}>
      {children}
    </OnlineStatusContext.Provider>
  );
}

export function useOnlineStatus() {
  const ctx = useContext(OnlineStatusContext);
  if (!ctx) throw new Error('useOnlineStatus must be used within OnlineStatusProvider');
  return ctx;
}
