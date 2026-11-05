import { useState, useEffect, useRef, useCallback } from 'react';
import localforage from 'localforage';

localforage.config({
  name: 'StockTerminalGPC',
  storeName: 'inventory_store'
});

// Versión del esquema de datos. Las migraciones solo se ejecutan una vez por versión
// (antes se ejecutaban en cada carga y borraban préstamos legítimos).
// v3: las fotos de cada equipo se guardan en su propia clave (img:<id>:<rev>), fuera del inventario,
// para que cada cambio no reescriba todas las fotos.
const SCHEMA_VERSION = 3;
const SCHEMA_KEY = 'gpc_schema_version';
const INVENTORY_KEY = 'gpc_inventory';
const LOGS_KEY = 'gpc_global_logs';
const CHANNEL_NAME = 'gpc_inventory_sync';
const PHOTO_PREFIX = 'img:';
// Una clave de fotos sin referencia solo se borra si tiene más de 10 minutos:
// puede ser de un guardado de otra pestaña que todavía no ha escrito el inventario.
const ORPHAN_MIN_AGE_MS = 10 * 60 * 1000;

const photoKey = (id, rev) => `${PHOTO_PREFIX}${id}:${rev}`;
const newPhotoRev = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const ORPHAN_MARKS_KEY = 'gpc_orphan_photo_marks';
const hasPhotos = (item) => !!item.image || (Array.isArray(item.images) && item.images.length > 0);

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
  // Fotos ya guardadas, por id de equipo: { image, images, rev }. Las fotos que no cambiaron
  // (misma referencia) no se vuelven a escribir.
  const photoCacheRef = useRef(new Map());
  // Cola de lecturas y escrituras: cada operación espera a la anterior, así no se pisan.
  const queueRef = useRef(Promise.resolve());
  // Si la carga inicial falla, no se permite guardar: guardar una lista vacía o incompleta
  // borraría el inventario real.
  const loadFailedRef = useRef(false);

  const enqueue = useCallback((task) => {
    const job = queueRef.current.then(task);
    queueRef.current = job.catch(() => {});
    return job;
  }, []);

  const notifyOtherTabs = useCallback(() => {
    try { channelRef.current?.postMessage('changed'); } catch { /* sin soporte */ }
  }, []);

  // Registros guardados -> equipos completos, con sus fotos.
  const hydrate = useCallback(async (records) => {
    const prevCache = photoCacheRef.current;
    const cache = new Map();
    const items = await Promise.all((records || []).filter(r => !r.isDraft).map(async (record) => {
      const { photoRev, ...item } = record;
      if (!photoRev) return item; // sin fotos, o formato antiguo con las fotos dentro del registro
      const id = String(item.id);
      const cached = prevCache.get(id);
      const photos = (cached && cached.rev === photoRev)
        ? cached
        : await localforage.getItem(photoKey(id, photoRev));
      if (!photos) return item;
      const full = { ...item, image: photos.image ?? null };
      if (photos.images) full.images = photos.images;
      cache.set(id, { image: full.image, images: full.images, rev: photoRev });
      return full;
    }));
    photoCacheRef.current = cache;
    return items;
  }, []);

  // Equipos completos -> registros sin fotos + una clave de fotos por equipo.
  // Primero se escriben las fotos nuevas y después el inventario: si algo falla, lo guardado
  // sigue apuntando a fotos que existen. Lanza el error si falla.
  const persist = useCallback(async (items) => {
    const prevCache = photoCacheRef.current;
    const cache = new Map();
    const photoWrites = [];
    const records = items.map((item) => {
      const { image, images, ...record } = item;
      if (!hasPhotos(item)) return record;
      const id = String(item.id);
      const cached = prevCache.get(id);
      if (cached && cached.image === (image ?? null) && cached.images === images) {
        cache.set(id, cached);
        return { ...record, photoRev: cached.rev };
      }
      const entry = { image: image ?? null, images, rev: newPhotoRev() };
      cache.set(id, entry);
      photoWrites.push(localforage.setItem(photoKey(id, entry.rev), { image: entry.image, images: entry.images }));
      return { ...record, photoRev: entry.rev };
    });
    await Promise.all(photoWrites);
    await localforage.setItem(INVENTORY_KEY, records);
    photoCacheRef.current = cache;
  }, []);

  // Borra las claves de fotos que ya no usa ningún equipo guardado.
  // Una clave solo se borra si lleva más de 10 minutos SIN USO (no desde que se creó): la primera
  // vez que se ve sin referencia se anota la hora, y si vuelve a usarse la marca se quita. Así una
  // pestaña desfasada que todavía apunta a una foto antigua no la pierde.
  const collectOrphanPhotos = useCallback(async () => {
    const records = (await localforage.getItem(INVENTORY_KEY)) || [];
    const referenced = new Set(records.filter(r => r.photoRev).map(r => photoKey(String(r.id), r.photoRev)));
    const now = Date.now();
    const keys = await localforage.keys();
    const marks = (await localforage.getItem(ORPHAN_MARKS_KEY)) || {};
    const nextMarks = {};
    const toDelete = [];
    for (const k of keys) {
      if (!k.startsWith(PHOTO_PREFIX) || referenced.has(k)) continue;
      const since = marks[k] || now;
      if (now - since > ORPHAN_MIN_AGE_MS) toDelete.push(k);
      else nextMarks[k] = since;
    }
    await Promise.all(toDelete.map(k => localforage.removeItem(k)));
    await localforage.setItem(ORPHAN_MARKS_KEY, nextMarks);
  }, []);

  const loadFromStorage = useCallback(async () => {
    const [records, storedLogs] = await Promise.all([
      localforage.getItem(INVENTORY_KEY),
      localforage.getItem(LOGS_KEY)
    ]);
    const items = await hydrate(records || []);
    loadFailedRef.current = false;
    inventoryRef.current = items;
    logsRef.current = storedLogs || [];
    setInventoryState(items);
    setGlobalLogs(logsRef.current);
  }, [hydrate]);

  // Recarga encolada detrás de las escrituras pendientes de esta pestaña.
  const queueReload = useCallback(() => enqueue(loadFromStorage), [enqueue, loadFromStorage]);

  useEffect(() => {
    let cancelled = false;

    // Encolado: en modo estricto React monta dos veces y las dos cargas no deben cruzarse.
    enqueue(async () => {
      try {
        let records = await localforage.getItem(INVENTORY_KEY);

        // Datos heredados de localStorage (versiones muy antiguas)
        if (!records) {
          const legacyData = localStorage.getItem(INVENTORY_KEY);
          if (legacyData) records = JSON.parse(legacyData);
        }

        const version = (await localforage.getItem(SCHEMA_KEY)) || 1;
        if (records && version < 2) records = migrateToV2(records);

        const items = await hydrate(records || []);

        if (version < SCHEMA_VERSION) {
          try {
            // v3: separa las fotos del inventario. Idempotente: si falla se reintenta en la próxima carga.
            await persist(items);
            await localforage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
          } catch (err) {
            console.error('Error guardando la migración', err);
          }
        }

        await collectOrphanPhotos().catch(err => console.error('Error limpiando fotos sin uso', err));

        const storedLogs = await localforage.getItem(LOGS_KEY);
        if (cancelled) return;
        loadFailedRef.current = false;
        inventoryRef.current = items;
        logsRef.current = storedLogs || [];
        setInventoryState(items);
        setGlobalLogs(logsRef.current);
      } catch (err) {
        console.error('Error accessing IndexedDB', err);
        loadFailedRef.current = true;
        if (!cancelled) alert('⚠️ No se pudieron leer los datos guardados en este dispositivo. Para no sobrescribirlos, no se guardará ningún cambio. Recarga la página; si sigue fallando, restaura un respaldo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    // Sincronización entre pestañas/ventanas del mismo navegador: cuando otra pestaña
    // guarda, esta recarga los datos en vez de pisarlos con su copia vieja.
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => { queueReload().catch(console.error); };
      channelRef.current = channel;
      return () => { cancelled = true; channel.close(); channelRef.current = null; };
    }
    return () => { cancelled = true; };
  }, [enqueue, hydrate, persist, collectOrphanPhotos, queueReload]);

  // Acepta un array nuevo o una función (prev => next). Devuelve una promesa con true si se guardó.
  // Si falla, se vuelve a lo último guardado para que la pantalla no muestre datos que no existen.
  const saveInventory = useCallback((nextOrUpdater) => enqueue(async () => {
    if (loadFailedRef.current) {
      alert('⚠️ Los datos no se cargaron correctamente: el cambio no se guardó para no sobrescribir el inventario. Recarga la página.');
      return false;
    }
    const next = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(inventoryRef.current)
      : nextOrUpdater;
    inventoryRef.current = next;
    setInventoryState(next);
    try {
      await persist(next);
      notifyOtherTabs();
      return true;
    } catch (err) {
      console.error('Error saving to IndexedDB', err);
      await loadFromStorage().catch(e => console.error('Error recargando datos', e));
      alert('⚠️ No se pudo guardar el inventario en este dispositivo (posible almacenamiento lleno). El cambio no se guardó y se restauraron los últimos datos guardados.');
      return false;
    }
  }), [enqueue, persist, notifyOtherTabs, loadFromStorage]);

  const addGlobalLog = useCallback((user, action) => enqueue(async () => {
    if (loadFailedRef.current) return false;
    const newLog = {
      id: Date.now() + Math.random(),
      date: new Date().toISOString(), // ISO 8601: ordenable; se formatea al mostrar
      user: user,
      action: action
    };
    const updated = [newLog, ...logsRef.current];
    logsRef.current = updated;
    setGlobalLogs(updated);
    try {
      await localforage.setItem(LOGS_KEY, updated);
      notifyOtherTabs();
      return true;
    } catch (err) {
      console.error(err);
      logsRef.current = updated.slice(1);
      setGlobalLogs(logsRef.current);
      return false;
    }
  }), [enqueue, notifyOtherTabs]);

  // Respaldo completo: inventario (con fotos ya incluidas) + bitácora global, como un solo JSON.
  const exportBackup = useCallback(() => enqueue(async () => ({
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    inventory: inventoryRef.current,
    globalLogs: logsRef.current
  })), [enqueue]);

  // Valida un respaldo antes de usarlo: solo acepta los campos conocidos y descarta el resto,
  // y solo acepta imágenes en formato data:image/... (nunca URLs externas ni scripts).
  const sanitizeBackup = useCallback((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('El archivo no tiene el formato esperado.');
    const rawItems = Array.isArray(raw.inventory) ? raw.inventory : null;
    if (!rawItems) throw new Error('El archivo no contiene un inventario válido.');
    const rawLogs = Array.isArray(raw.globalLogs) ? raw.globalLogs : [];

    const isDataImage = (v) => typeof v === 'string' && v.startsWith('data:image/');
    const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
    const num = (v, fallback = 0) => {
      const n = typeof v === 'number' ? v : parseInt(v, 10);
      return Number.isFinite(n) ? n : fallback;
    };

    const items = rawItems
      .filter(it => it && typeof it === 'object' && (typeof it.id === 'string' || typeof it.id === 'number') && str(it.name))
      .map(it => {
        const clean = {
          id: String(it.id),
          name: str(it.name),
          quantity: Math.max(1, Math.floor(num(it.quantity, 1))),
          isFixedAsset: !!it.isFixedAsset,
          assetNumber: str(it.assetNumber),
          terminal: str(it.terminal),
          ownerTerminal: str(it.ownerTerminal) || str(it.terminal),
          owner: str(it.ownerTerminal) || str(it.terminal),
          area: str(it.area),
          baseWarehouse: str(it.baseWarehouse),
          status: str(it.status),
          history: Array.isArray(it.history) ? it.history.filter(h => typeof h === 'string') : []
        };
        if (isDataImage(it.image)) clean.image = it.image;
        if (Array.isArray(it.images)) {
          const images = it.images
            .filter(img => img && isDataImage(img.data))
            .map(img => ({ data: img.data, status: str(img.status), date: str(img.date) }));
          if (images.length > 0) clean.images = images;
        }
        return clean;
      });

    const logs = rawLogs
      .filter(l => l && typeof l === 'object')
      .map(l => ({
        id: (typeof l.id === 'string' || typeof l.id === 'number') ? l.id : (Date.now() + Math.random()),
        date: str(l.date, new Date().toISOString()),
        user: str(l.user, 'desconocido'),
        action: str(l.action)
      }));

    if (items.length === 0) throw new Error('El respaldo no tiene equipos válidos.');
    return { items, logs, discarded: rawItems.length - items.length };
  }, []);

  // Restaura desde un respaldo ya validado. Antes de reemplazar nada, descarga automáticamente
  // una copia de lo que había, por si el archivo cargado no era el correcto.
  const restoreBackup = useCallback((rawBackup) => enqueue(async () => {
    const { items, logs, discarded } = sanitizeBackup(rawBackup);

    try {
      // Si la carga falló, la memoria está vacía: se copia lo que de verdad hay guardado
      // (registros sin fotos, pero con todos los datos de los equipos).
      const stored = loadFailedRef.current
        ? {
            inventory: (await localforage.getItem(INVENTORY_KEY).catch(() => null)) || [],
            globalLogs: (await localforage.getItem(LOGS_KEY).catch(() => null)) || []
          }
        : { inventory: inventoryRef.current, globalLogs: logsRef.current };
      const safetyBlob = new Blob([JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        ...stored
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(safetyBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_previo_a_restaurar_${Date.now()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('No se pudo generar el respaldo de seguridad previo a restaurar', err);
    }

    let inventoryWritten = false;
    try {
      await persist(items);
      inventoryWritten = true;
      await localforage.setItem(LOGS_KEY, logs);
      loadFailedRef.current = false;
      inventoryRef.current = items;
      logsRef.current = logs;
      setInventoryState(items);
      setGlobalLogs(logs);
      notifyOtherTabs();
      await collectOrphanPhotos().catch(err => console.error('Error limpiando fotos sin uso', err));
      return { discarded };
    } catch (err) {
      console.error('Error restaurando el respaldo', err);
      await loadFromStorage().catch(e => console.error('Error recargando datos', e));
      if (inventoryWritten) {
        loadFailedRef.current = false;
        notifyOtherTabs();
        alert('⚠️ El inventario se restauró, pero no se pudo restaurar la bitácora global. Se conserva la bitácora anterior.');
        return { discarded, logsFailed: true };
      }
      alert('⚠️ No se pudo restaurar el respaldo en este dispositivo. No se modificaron los datos.');
      return false;
    }
  }), [enqueue, sanitizeBackup, persist, notifyOtherTabs, collectOrphanPhotos, loadFromStorage]);

  // Pide almacenamiento persistente al navegador para reducir el riesgo de que borre los datos
  // por falta de espacio. Es una sugerencia para el navegador, no una garantía.
  useEffect(() => {
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  return { inventory, saveInventory, isLoading, globalLogs, addGlobalLog, exportBackup, restoreBackup };
}
