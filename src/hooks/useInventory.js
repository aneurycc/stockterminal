import { useState, useEffect, useRef, useCallback } from 'react';
import localforage from 'localforage';

localforage.config({
  name: 'StockTerminalGPC',
  storeName: 'inventory_store'
});

// Versión del esquema de datos. Las migraciones solo se ejecutan una vez por versión
// (antes se ejecutaban en cada carga y borraban préstamos legítimos).
const SCHEMA_VERSION = 2;
const SCHEMA_KEY = 'gpc_schema_version';
const INVENTORY_KEY = 'gpc_inventory';
const LOGS_KEY = 'gpc_global_logs';
const CHANNEL_NAME = 'gpc_inventory_sync';

// Migración a v2:
// - 'Dañado' -> 'Inhabilitado'
// - área 'N/A' -> área por defecto de la terminal
// - ownerTerminal ausente -> terminal actual
// - owner y ownerTerminal se unifican: si difieren, 'owner' es el valor más reciente
//   (la "corrección de registro" solo actualizaba 'owner').
// - se descartan borradores de clonado que quedaron guardados (isDraft)
// Ya NO se deduce la propiedad a partir del texto del historial.
const migrateToV2 = (items) => items
  .filter(item => !item.isDraft)
  .map(item => {
    const next = { ...item };
    if (next.status === 'Dañado') next.status = 'Inhabilitado';
    if (next.area === 'N/A') next.area = next.terminal === 'Terminal B2' ? 'Gate 27' : 'Gate 1';
    if (next.owner && next.owner !== next.ownerTerminal) next.ownerTerminal = next.owner;
    // Foto principal huérfana (fallo antiguo al borrar/reemplazar fotos): apuntar a la última de la galería
    if (next.image && next.images && next.images.length > 0 && !next.images.some(img => img.data === next.image)) {
      next.image = next.images[next.images.length - 1].data;
    }
    if (!next.ownerTerminal) next.ownerTerminal = next.terminal;
    next.owner = next.ownerTerminal;
    return next;
  });

export function useInventory() {
  const [inventory, setInventoryState] = useState([]);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Copia siempre actualizada del inventario, para que varias escrituras seguidas
  // en el mismo evento no se pisen entre sí.
  const inventoryRef = useRef([]);
  const logsRef = useRef([]);
  const channelRef = useRef(null);

  const reloadFromStorage = useCallback(async () => {
    const [storedInventory, storedLogs] = await Promise.all([
      localforage.getItem(INVENTORY_KEY),
      localforage.getItem(LOGS_KEY)
    ]);
    inventoryRef.current = storedInventory || [];
    logsRef.current = storedLogs || [];
    setInventoryState(inventoryRef.current);
    setGlobalLogs(logsRef.current);
  }, []);

  useEffect(() => {
    const initStorage = async () => {
      try {
        let storedInventory = await localforage.getItem(INVENTORY_KEY);

        // Datos heredados de localStorage (versiones muy antiguas)
        if (!storedInventory) {
          const legacyData = localStorage.getItem(INVENTORY_KEY);
          if (legacyData) storedInventory = JSON.parse(legacyData);
        }

        const version = (await localforage.getItem(SCHEMA_KEY)) || 1;
        if (version < SCHEMA_VERSION) {
          if (storedInventory) storedInventory = migrateToV2(storedInventory);
          try {
            if (storedInventory) await localforage.setItem(INVENTORY_KEY, storedInventory);
            await localforage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
          } catch (err) {
            // No se marca la versión: la migración (idempotente) se reintentará en la próxima carga.
            console.error("Error guardando la migración", err);
          }
        }

        const storedLogs = await localforage.getItem(LOGS_KEY);
        inventoryRef.current = storedInventory || [];
        logsRef.current = storedLogs || [];
        setInventoryState(inventoryRef.current);
        setGlobalLogs(logsRef.current);
      } catch (err) {
        console.error("Error accessing IndexedDB", err);
      } finally {
        setIsLoading(false);
      }
    };

    initStorage();

    // Sincronización entre pestañas/ventanas del mismo navegador: cuando otra pestaña
    // guarda, esta recarga los datos en vez de pisarlos con su copia vieja.
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => { reloadFromStorage().catch(console.error); };
      channelRef.current = channel;
      return () => { channel.close(); channelRef.current = null; };
    }
  }, [reloadFromStorage]);

  const notifyOtherTabs = () => {
    try { channelRef.current?.postMessage('changed'); } catch { /* sin soporte */ }
  };

  // Acepta un array nuevo o una función (prev => next). Devuelve la promesa del guardado.
  const saveInventory = useCallback(async (nextOrUpdater) => {
    const next = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(inventoryRef.current)
      : nextOrUpdater;
    inventoryRef.current = next;
    setInventoryState(next);
    try {
      await localforage.setItem(INVENTORY_KEY, next);
      notifyOtherTabs();
      return true;
    } catch (err) {
      console.error("Error saving to IndexedDB", err);
      alert('⚠️ No se pudo guardar el inventario en este dispositivo (posible almacenamiento lleno). El último cambio se perderá al recargar.');
      return false;
    }
  }, []);

  const addGlobalLog = useCallback(async (user, action) => {
    const newLog = {
      id: Date.now() + Math.random(),
      date: new Date().toLocaleString(),
      user: user,
      action: action
    };
    const updated = [newLog, ...logsRef.current];
    logsRef.current = updated;
    setGlobalLogs(updated);
    try {
      await localforage.setItem(LOGS_KEY, updated);
      notifyOtherTabs();
    } catch (err) {
      console.error(err);
    }
  }, []);

  return { inventory, saveInventory, isLoading, globalLogs, addGlobalLog };
}
