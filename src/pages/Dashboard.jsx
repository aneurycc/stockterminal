import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trash2, Clock, Upload, Copy, Plus, Moon, Sun, Package, Camera, RefreshCw, Activity, Share2, Download } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import KPICards from '../components/KPICards';

const nowString = () => new Date().toLocaleString();
// Fecha para nombres de archivo: 2026-11-05_14-30-00 (sin caracteres raros del formato local)
const fileStamp = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`; };
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;


// NOTA: Se ha eliminado "Prestado" porque ahora es una relación estructural (owner !== terminal)
const STATUS_OPTIONS = ['En uso', 'En Almacén', 'Inhabilitado', 'Decomisado', 'En reparación', 'En proceso de decomiso'];
const TERMINAL_OPTIONS = ['Terminal A', 'Terminal B', 'Terminal B2'];

const WAREHOUSES_DATA = {
  'Terminal A': [
    { name: 'Almacén Sótano', location: 'Sótano – Terminal A' },
    { name: 'Almacén Aduanas TA', location: 'Aduanas – Terminal A' },
    { name: 'Almacén Descanso Aerolíneas', location: 'Área de descanso de aerolíneas – Terminal A' },
    { name: 'Almacén Expansión Llegadas TA', location: 'Expansión de Llegadas – Terminal A' },
    { name: 'Almacén Airside', location: 'Airside – Terminal A' },
    { name: 'Cuarto de Separadores Correa No. 1', location: 'Facturación, Correa 1 – Terminal A' },
    { name: 'Cuarto de Separadores Correa No. 3', location: 'Facturación, Correa 3 – Terminal A' },
    { name: 'Almacén A-2', location: 'Área A-2 – Terminal A' },
    { name: 'Almacén Rent Car', location: 'Área Rent Car – Terminal A' },
  ],
  'Terminal B': [
    { name: 'Almacén Aduanas TB', location: 'Aduanas, Correa 12 – Terminal B' },
    { name: 'Almacén Vacation Club', location: 'Área Vacation Club – Terminal B' },
    { name: 'Utility Room Correas 1 y 2', location: 'Facturación, Correas 1 y 2 – Terminal B' },
    { name: 'Utility Room Correas 3 y 4', location: 'Facturación, Correas 3 y 4 – Terminal B' },
  ],
  'Terminal B2': [
    { name: 'Almacén Comedor GOL', location: 'Comedor GOL – Terminal B2' },
    { name: 'Utility Terminal B2', location: 'Área de escalera – Terminal B2' },
    { name: 'Utility Gate 27', location: 'Gate 27 – Terminal B2' },
    { name: 'Utility Gate 33', location: 'Gate 33 – Terminal B2' },
    { name: 'Utility Food Court', location: 'Food Court – Terminal B2' },
    { name: 'Utility Tránsito', location: 'Área de Tránsito – Terminal B2' },
    { name: 'Cuarto de Separadores Gate 28', location: 'Gate 28 – Terminal B2' },
    { name: 'Cuarto de Separadores Gate 29', location: 'Gate 29 – Terminal B2' },
    { name: 'Almacén Airside B2', location: 'Airside – Terminal B2' },
  ]
};

const ALL_WAREHOUSE_NAMES = [
  ...WAREHOUSES_DATA['Terminal A'].map(w => w.name),
  ...WAREHOUSES_DATA['Terminal B'].map(w => w.name),
  ...WAREHOUSES_DATA['Terminal B2'].map(w => w.name),
];

const AREAS_A = ['Check-in Terminal A', 'Check Point TA', 'Migración Salidas TA', 'Sala de embarque A1', 'Sala de embarque A2', 'Food Court TA', 'Pasillo Llegadas', 'Sala Migración Llegadas', 'Migración Llegadas TA', 'Reclamo de equipajes TA', 'Aduanas TA', 'Área comercial (tienda) TA', 'Oficina TA', 'Pasillo TA', 'Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5', 'Gate 6', 'Gate 7', 'Gate 8', 'Gate 9', 'Gate 10', 'Gate 11', 'Gate 12', 'Gate 13', 'Gate 14', 'Gate 15', 'Gate 16', 'Paxer TA'];
const AREAS_B = ['Correas de check in 1 y 2', 'Correas de check in 3 y 4', 'Check Point TB', 'Migración Salidas TB', 'Sala de embarque B1', 'Food Court TB', 'Pasillo Llegadas', 'Sala Migración Llegadas', 'Migración Llegadas TB', 'Reclamo de equipajes 11-13', 'Reclamo de equipajes 14-18', 'Aduanas TB', 'Área comercial (tienda) TB', 'Oficina TB', 'Pasillo TB', 'Gate 20', 'Gate 21', 'Gate 22', 'Gate 23', 'Gate 24', 'Gate 25', 'Gate 26', 'Gate 26F', 'Security Gate TB'];
const AREAS_B2 = ['Food Court TB2', 'Migración Llegadas TB2', 'Oficina', 'Gate 27', 'Gate 28', 'Gate 29', 'Gate 30', 'Gate 31'];
const AREAS_GENERAL = [...new Set([...AREAS_A, ...AREAS_B, ...AREAS_B2])];

const getOperationalAreas = (term) => {
  if (term === 'Terminal A') return AREAS_A;
  if (term === 'Terminal B') return AREAS_B;
  if (term === 'Terminal B2') return AREAS_B2;
  return AREAS_GENERAL;
};

const getAreasForTerminal = (term, status) => {
  if (status === 'En Almacén') {
    if (term === 'Terminal A') return WAREHOUSES_DATA['Terminal A'].map(w => w.name);
    if (term === 'Terminal B') return WAREHOUSES_DATA['Terminal B'].map(w => w.name);
    if (term === 'Terminal B2') return WAREHOUSES_DATA['Terminal B2'].map(w => w.name);
    return ALL_WAREHOUSE_NAMES;
  }
  return getOperationalAreas(term);
};

// --- Helpers de normalización (importación y validaciones) ---
// Minúsculas, sin tildes y con espacios simples, para comparar texto escrito a mano.
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[.\-_]/g, ' ').replace(/\s+/g, ' ').trim();

// Devuelve la opción oficial que coincide con 'raw' (ignorando tildes y mayúsculas), o null.
const matchOption = (raw, options) => {
  const n = norm(raw);
  if (!n) return null;
  return options.find(o => norm(o) === n) || null;
};

const TERMINAL_ALIASES = {
  'ta': 'Terminal A', 'a': 'Terminal A', 'term a': 'Terminal A', 't a': 'Terminal A',
  'tb': 'Terminal B', 'b': 'Terminal B', 'term b': 'Terminal B', 't b': 'Terminal B',
  'tb2': 'Terminal B2', 'b2': 'Terminal B2', 'term b2': 'Terminal B2', 't b2': 'Terminal B2', 'terminal b 2': 'Terminal B2', 'tb 2': 'Terminal B2',
};
const matchTerminal = (raw) => matchOption(raw, TERMINAL_OPTIONS) || TERMINAL_ALIASES[norm(raw)] || null;

// Número de Activo Fijo canónico: sin espacios a los lados y en mayúsculas.
const normalizeAsset = (s) => String(s ?? '').trim().toUpperCase();

// Propietario efectivo de un registro.
const ownerOf = (item) => item.ownerTerminal || item.terminal;

// Dos registros solo se consolidan si son el mismo tipo de equipo, en el mismo sitio,
// con el mismo estado y del MISMO propietario (no se mezclan préstamos con stock propio).
// Nunca se consolida con un borrador de clonado sin guardar (puede venir de otra pestaña).
const canConsolidate = (a, b) =>
  !a.isDraft && !b.isDraft &&
  !a.isFixedAsset && !b.isFixedAsset &&
  (a.name || '').trim().toLowerCase() === (b.name || '').trim().toLowerCase() &&
  a.terminal === b.terminal &&
  a.area === b.area &&
  a.status === b.status &&
  ownerOf(a) === ownerOf(b);

// Añade una foto suelta (campo 'image' antiguo) a la galería si no está ya incluida.
const withLegacyImage = (item, dateLabel = 'Registro Original') => {
  const images = item.images || [];
  if (item.image && !images.find(img => img.data === item.image)) {
    return [...images, { data: item.image, status: item.status, date: dateLabel }];
  }
  return images;
};

// Colores Semánticos GPC Material: un único mapa por estado, compartido por el gráfico (chart)
// y por la etiqueta de la tabla (bg/fg). Los estados sin color propio usan el ámbar por defecto.
const STATUS_STYLES = {
  'En uso':                  { chart: '#21BA45', bg: '#E8F5E9', fg: '#2E7D32' },
  'En Almacén':              { chart: '#3498db', bg: '#FFF8E1', fg: '#F57F17' },
  'Inhabilitado':            { chart: '#e74c3c', bg: '#FFEBEE', fg: '#C62828' },
  'Decomisado':              { chart: '#7f8c8d', bg: '#F5F5F5', fg: '#616161' },
  'En proceso de decomiso':  { chart: '#f1c40f', bg: '#FFF8E1', fg: '#F57F17' },
  'En reparación':           { chart: '#9b59b6', bg: '#FFF8E1', fg: '#F57F17' },
};
const DEFAULT_BADGE = { bg: '#FFF8E1', fg: '#F57F17' };
const STATUS_COLORS = {
  ...Object.fromEntries(Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.chart])),
  'Terminal A': '#1abc9c', 'Terminal B': '#e67e22', 'Terminal B2': '#9b59b6'
};
const badgeStyle = (status) => STATUS_STYLES[status] || DEFAULT_BADGE;

// Exporta un CSV para Excel en español: separador ';', BOM para las tildes y celdas protegidas
// contra inyección de fórmulas (OWASP A03: =, +, -, @, tabulador, retorno de carro).
const sanitizeCSV = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
};
const downloadCSV = (headers, rows, filename) => {
  const csvContent = [headers, ...rows].map(r => r.map(c => `"${sanitizeCSV(c)}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Fecha de la bitácora: se guarda en ISO 8601 y se muestra con el formato local.
// Los registros antiguos (texto local) se muestran tal cual.
const formatLogDate = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value || '';
  const d = new Date(value);
  return isNaN(d) ? value : d.toLocaleString();
};

const WAREHOUSE_COUNT = Object.values(WAREHOUSES_DATA).flat().length;

const Dashboard = ({ onLogout }) => {
  const { inventory, saveInventory: setInventory, isLoading, globalLogs, addGlobalLog, exportBackup, restoreBackup } = useInventory();
  // A1: la bitácora registra el nombre del operador (persona), no solo el usuario/rol del login.
  const currentUser = localStorage.getItem('gpc_operator') || localStorage.getItem('gpc_user') || 'gerente';
  const [isGlobalLogOpen, setIsGlobalLogOpen] = useState(false);
  const [activeWarehouseTab, setActiveWarehouseTab] = useState('Terminal A');

  
  const [filterTerminal, setFilterTerminal] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterType, setFilterType] = useState('Todos');
  const [filterIsProperty, setFilterIsProperty] = useState(false);

  const [showTextFilters, setShowTextFilters] = useState(false);
  const [textFilterEquipo, setTextFilterEquipo] = useState('');
  const [textFilterArea, setTextFilterArea] = useState('');
  const [textFilterEstado, setTextFilterEstado] = useState('');
  const [textFilterActivo, setTextFilterActivo] = useState('');
  
  // Estado Modo Oscuro
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('gpc_theme') === 'dark';
  });


  useEffect(() => {
    if (isDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('gpc_theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('gpc_theme', 'light');
    }
  }, [isDarkMode]);
  
  // Estado del Modal de Registro Rapido
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [newItemName, setNewItemName] = useState('');
  const [newItemStatus, setNewItemStatus] = useState(STATUS_OPTIONS[0]);
  const [newItemTerminal, setNewItemTerminal] = useState(TERMINAL_OPTIONS[0]);
  const [newItemArea, setNewItemArea] = useState(AREAS_GENERAL[0]);
  const [newItemWarehouse, setNewItemWarehouse] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);

  const [editNewImage, setEditNewImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');

  const [historyModalItem, setHistoryModalItem] = useState(null); 
  const [newItemImage, setNewItemImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [newItemIsFixedAsset, setNewItemIsFixedAsset] = useState(false);
  const [newItemAssetNumber, setNewItemAssetNumber] = useState('');
  const [filterOwner] = useState('Todos');
  const [, setIsGeneratingCard] = useState(false);
  const [shareCardItem, setShareCardItem] = useState(null);
  const shareCardRef = useRef(null);
  // Clon en edición que aún no se ha guardado: { item, sourceId }. Solo vive en pantalla.
  const [draftItem, setDraftItem] = useState(null);

  // Escape cierra la ventana abierta que está encima (accesibilidad con teclado).
  useEffect(() => {
    if (!(itemToDelete || selectedImage || historyModalItem || isGlobalLogOpen || isAddModalOpen)) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (itemToDelete) { setItemToDelete(null); setDeletePassword(''); }
      else if (selectedImage) setSelectedImage(null);
      else if (historyModalItem) setHistoryModalItem(null);
      else if (isGlobalLogOpen) setIsGlobalLogOpen(false);
      else if (isAddModalOpen) setIsAddModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [itemToDelete, selectedImage, historyModalItem, isGlobalLogOpen, isAddModalOpen]);

  const handleShareAsCard = async (item) => {
    setShareCardItem(item);
    setIsGeneratingCard(true);
    
    // Give react time to render the hidden card
    setTimeout(async () => {
      if (shareCardRef.current) {
        try {
          // Se descarga solo cuando se comparte una tarjeta
          const { default: html2canvas } = await import('html2canvas');
          const canvas = await html2canvas(shareCardRef.current, {
            scale: 2, 
            useCORS: true, 
            backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' 
          });
          const dataUrl = canvas.toDataURL('image/png');
          
          // Convert dataURL to Blob
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `Equipo_${item.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });

          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
             await navigator.share({
               title: `Buscar Equipo: ${item.name}`,
               text: `Por favor ubicar este equipo en ${item.terminal} - ${item.area}`,
               files: [file]
             });
          } else {
             // Fallback: download the image
             const link = document.createElement('a');
             link.download = file.name;
             link.href = dataUrl;
             link.click();
             alert('Imagen descargada. Puedes enviarla por WhatsApp Web.');
          }
        } catch (error) {
          console.error('Error generating card', error);
          alert('Hubo un error al generar la tarjeta visual.');
        } finally {
          setIsGeneratingCard(false);
          setShareCardItem(null);
        }
      }
    }, 100);
  };


  const handleOpenGallery = (item) => {
    setSelectedImage(item);
    setActivePhotoIdx(0);
  };

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // 1024 px y 75 % de calidad: nítida en pantalla y unas 3-4 veces más liviana que a 1600 px / 90 %,
          // para no llenar el almacenamiento del dispositivo.
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  
  // Inyección de Data Ficticia para pruebas
  useEffect(() => {
    if (!isLoading && inventory.length === 0) {
            
          }
  }, [isLoading, inventory.length]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(inventory.map(item => item.name));
    return ['Todos', ...Array.from(types)];
  }, [inventory]);

  const typeSuggestions = useMemo(() => Array.from(new Set(inventory.map(i => i.name))), [inventory]);

  // Mantiene coherentes almacén y área del formulario de registro con la terminal y el estado.
  // Solo corrige valores que no son válidos, así que no entra en bucle.
  useEffect(() => {
    const whs = WAREHOUSES_DATA[newItemTerminal] || [];
    const validWh = whs.some(w => w.name === newItemWarehouse)
      ? newItemWarehouse
      : (whs.length > 0 ? whs[0].name : newItemWarehouse);
    if (validWh !== newItemWarehouse) setNewItemWarehouse(validWh);

    if (newItemStatus === 'En Almacén') {
      if (validWh && newItemArea !== validWh) setNewItemArea(validWh);
    } else {
      const allowedAreas = getOperationalAreas(newItemTerminal);
      if (!allowedAreas.includes(newItemArea)) setNewItemArea(allowedAreas[0]);
    }
  }, [newItemTerminal, newItemStatus, newItemWarehouse, newItemArea]);

  
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Límite de tamaño: un archivo enorme (o malicioso) puede congelar la app al leerlo.
    // La plantilla oficial con miles de filas pesa muy por debajo de este límite.
    if (file.size > MAX_IMPORT_BYTES) {
      alert(`El archivo "${file.name}" es demasiado grande (${(file.size / 1048576).toFixed(1)} MB). El máximo permitido es ${MAX_IMPORT_BYTES / 1048576} MB.`);
      e.target.value = null;
      return;
    }

    if (!window.confirm(`¿Estás seguro que deseas cargar el inventario desde el archivo "${file.name}"? Esto agregará los equipos al sistema.`)) {
      e.target.value = null; // reset input
      return;
    }

    // Los CSV se decodifican a texto: UTF-8 si es válido; si no, Windows-1252 (el "CSV" por defecto de Excel en español).
    // Así no se rompen las tildes, traiga o no BOM el archivo.
    const isCSV = /\.csv$/i.test(file.name);
    const decodeCSV = (buffer) => {
      const b = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
      if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buffer);
      if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buffer);
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        return new TextDecoder('windows-1252').decode(buffer);
      }
    };
    // Un .xlsx (ZIP, "PK") o .xls antiguo (D0 CF) renombrado a .csv se lee como libro, no como texto
    const looksLikeWorkbook = (buffer) => {
      const b = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
      return (b[0] === 0x50 && b[1] === 0x4B) || (b[0] === 0xD0 && b[1] === 0xCF);
    };
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        // La librería de Excel se descarga solo cuando se usa (no en cada carga de la app)
        const XLSX = await import('xlsx');
        const wb = (isCSV && !looksLikeWorkbook(data))
          // raw:true en CSV: cada celda se conserva como texto (no se pierden ceros a la izquierda como "0012")
          ? XLSX.read(decodeCSV(data).replace(/^\uFEFF/, ''), { type: 'string', raw: true })
          : XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Valores reales de las celdas (no el texto formateado: evita "1.23457E+11" o "1,500")
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert("El archivo no contiene datos válidos.");
          return;
        }

        let newItems = [];
        let skippedCount = 0;

        // Helper to extract field value by searching keys flexibly
        const getVal = (rowObj, candidates) => {
          const keys = Object.keys(rowObj);
          for (const cand of candidates) {
            const match = keys.find(k => k.trim().toLowerCase().replace(/[^\w\sáéíóúñ]/gi, '') === cand.toLowerCase().replace(/[^\w\sáéíóúñ]/gi, ''));
            if (match && rowObj[match] !== undefined && rowObj[match] !== null && rowObj[match].toString().trim() !== '') {
              return rowObj[match].toString().trim();
            }
          }
          for (const cand of candidates) {
            const match = keys.find(k => k.trim().toLowerCase().includes(cand.toLowerCase()));
            if (match && rowObj[match] !== undefined && rowObj[match] !== null && rowObj[match].toString().trim() !== '') {
              return rowObj[match].toString().trim();
            }
          }
          return '';
        };

        const warnings = [];
        const seenAssets = new Set();
        const existingAssets = new Set(inventory.filter(i => i.isFixedAsset && i.assetNumber).map(i => normalizeAsset(i.assetNumber)));

        rawJson.forEach((row, index) => {
          const rowNum = index + 2; // fila 1 = encabezados
          // If CSV single-column key detected (e.g., "Nombre;Terminal;Area...")
          let parsedRow = { ...row };
          const rowKeys = Object.keys(row);
          if (rowKeys.length === 1 && rowKeys[0].includes(';')) {
            const headers = rowKeys[0].split(';');
            const vals = (row[rowKeys[0]] || '').toString().split(';');
            parsedRow = {};
            headers.forEach((h, idx) => {
              parsedRow[h.trim()] = vals[idx] ? vals[idx].trim() : '';
            });
          }

          const rawName = getVal(parsedRow, ['Nombre', 'Equipo', 'Articulo', 'Artículo', 'Item', 'Name', 'Descripción', 'Producto']);
          const name = rawName || `Equipo Genérico ${index + 1}`;
          if (!rawName) warnings.push(`Fila ${rowNum}: sin nombre → "${name}".`);

          const rawTerminal = getVal(parsedRow, ['Terminal', 'Ubicacion', 'Ubicación', 'Posicion', 'Posición', 'Location']);
          let terminal = matchTerminal(rawTerminal);
          if (!terminal) {
            terminal = 'Terminal A';
            warnings.push(`Fila ${rowNum}: terminal "${rawTerminal}" no reconocida → Terminal A.`);
          }

          const termWarehouseNames = (WAREHOUSES_DATA[terminal] || []).map(w => w.name);
          const rawArea = getVal(parsedRow, ['Area', 'Área', 'Zona', 'Lugar']);
          const rawStatus = getVal(parsedRow, ['Estado', 'Status', 'Condicion', 'Condición']);

          // El estado se resuelve ANTES que el área: los equipos "En Almacén" se validan contra almacenes.
          let status = matchOption(rawStatus, STATUS_OPTIONS);
          const areaIsWarehouse = !!matchOption(rawArea, termWarehouseNames);
          if (!status) {
            status = areaIsWarehouse ? 'En Almacén' : 'En uso';
            if (rawStatus) warnings.push(`Fila ${rowNum}: estado "${rawStatus}" no reconocido → ${status}.`);
            else if (areaIsWarehouse) warnings.push(`Fila ${rowNum}: sin estado; el área es un almacén → En Almacén.`);
          }

          const areaOptions = getAvailableAreas(terminal, status);
          let area = matchOption(rawArea, areaOptions);
          if (!area && !rawArea && status === 'En Almacén') {
            // Sin área pero con Almacén Base válido: el equipo está en su almacén base
            const rawBase = getVal(parsedRow, ['Almacen Base', 'Almacén Base', 'Base Warehouse', 'BaseWarehouse', 'Almacen Custodia', 'Almacén Custodia', 'Almacen', 'Almacén']);
            area = matchOption(rawBase, areaOptions);
          }
          if (!area) {
            area = areaOptions[0];
            warnings.push(`Fila ${rowNum}: área "${rawArea}" no válida para ${terminal} (${status}) → ${area}.`);
          }

          const rawQty = getVal(parsedRow, ['Cantidad', 'Cant', 'Qty', 'Quantity', 'Unidades', 'Stock']);
          // Entero positivo; se aceptan separadores de miles ("1,500" / "1.500")
          const qtyText = /^\d{1,3}([.,]\d{3})+$/.test(rawQty) ? rawQty.replace(/[.,]/g, '') : rawQty;
          const qtyParsed = /^\d+$/.test(qtyText) ? parseInt(qtyText, 10) : NaN;
          let quantity = (!isNaN(qtyParsed) && qtyParsed > 0) ? qtyParsed : 1;
          if (rawQty && quantity !== qtyParsed) warnings.push(`Fila ${rowNum}: cantidad "${rawQty}" no es un entero positivo → 1.`);

          const assetNum = normalizeAsset(getVal(parsedRow, ['Activo Fijo', 'Activo', 'Asset', 'Num Activo', '# Activo', 'Nro Activo', 'Codigo Activo']));
          // Un número de Activo Fijo identifica UNA unidad concreta
          if (assetNum.length > 0 && quantity > 1) {
            warnings.push(`Fila ${rowNum}: el Activo Fijo ${assetNum} es una sola unidad; cantidad ${quantity} → 1. Registra las demás unidades con su propio número.`);
            quantity = 1;
          }

          const rawOwner = getVal(parsedRow, ['Propietario', 'Owner', 'Dueño', 'Dueno']);
          let ownerTerminal = matchTerminal(rawOwner);
          if (!ownerTerminal) {
            ownerTerminal = terminal;
            if (rawOwner) warnings.push(`Fila ${rowNum}: propietario "${rawOwner}" no reconocido → ${terminal}.`);
          }

          // Almacén Base: un almacén oficial de la terminal PROPIETARIA (un préstamo conserva el
          // almacén de origen, igual que en el editor).
          const ownerWarehouseNames = (WAREHOUSES_DATA[ownerTerminal] || []).map(w => w.name);
          const defaultWh = ownerWarehouseNames[0] || '';
          const rawBaseWh = getVal(parsedRow, ['Almacen Base', 'Almacén Base', 'Base Warehouse', 'BaseWarehouse', 'Almacen Custodia', 'Almacén Custodia', 'Almacen', 'Almacén']);
          let baseWarehouse = matchOption(rawBaseWh, ownerWarehouseNames);
          if (!baseWarehouse) {
            baseWarehouse = (status === 'En Almacén' && ownerWarehouseNames.includes(area)) ? area : defaultWh;
            if (rawBaseWh) warnings.push(`Fila ${rowNum}: almacén base "${rawBaseWh}" no existe en ${ownerTerminal} → ${baseWarehouse}.`);
          }

          // Activo Fijo duplicado: contra el inventario y contra las filas anteriores del mismo archivo
          if (assetNum.length > 0) {
            if (existingAssets.has(assetNum) || seenAssets.has(assetNum)) {
              skippedCount++;
              warnings.push(`Fila ${rowNum}: Activo Fijo ${assetNum} duplicado → fila omitida.`);
              return;
            }
            seenAssets.add(assetNum);
          }

          newItems.push({
            id: Date.now().toString() + Math.random().toString() + index,
            name: name,
            quantity: quantity,
            isFixedAsset: assetNum.length > 0,
            assetNumber: assetNum,
            terminal: terminal,
            ownerTerminal: ownerTerminal,
            owner: ownerTerminal,
            area: area,
            baseWarehouse: baseWarehouse,
            status: status,
            history: [`[${nowString()}] Importado desde Excel/CSV. Almacén Base: ${baseWarehouse}.`]
          });
        });

        if (newItems.length === 0) {
          alert(skippedCount > 0
            ? `No se agregó ningún equipo. Se omitieron ${skippedCount} filas por tener un número de Activo Fijo duplicado.`
            : "El archivo no contenía datos válidos.");
          return;
        }

        // Si hubo correcciones, mostrarlas y pedir confirmación antes de cargar
        if (warnings.length > 0) {
          const shown = warnings.slice(0, 15).join('\n');
          const more = warnings.length > 15 ? `\n…y ${warnings.length - 15} avisos más.` : '';
          if (!window.confirm(`Se encontraron ${warnings.length} correcciones o filas omitidas:\n\n${shown}${more}\n\n¿Importar ${newItems.length} equipos de todas formas?`)) {
            return;
          }
        }

        if (!(await setInventory(prev => [...prev, ...newItems]))) return;
        let successMsg = `Importación masiva: Se cargaron ${newItems.length} equipos desde Excel/CSV.`;
        if (skippedCount > 0) successMsg += ` (Se omitieron ${skippedCount} filas por Activo Fijo duplicado).`;
        if (warnings.length > 0) successMsg += ` ${warnings.length} avisos de corrección.`;
        addGlobalLog(currentUser, successMsg);

        let alertMsg = `Archivo cargado exitosamente.\n✅ Se agregaron ${newItems.length} equipos.`;
        if (skippedCount > 0) alertMsg += `\n⚠️ Se omitieron ${skippedCount} filas porque su número de Activo Fijo ya existe.`;
        alert(alertMsg);
      } catch (err) {
        console.error(err);
        alert("Error al procesar el archivo Excel/CSV. Revisa que el formato sea correcto.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null; // reset input
  };


  const handleReplacePhoto = async (e, oldPhotoData) => {
    const file = e.target.files[0];
    if (!file) return;
    const now = nowString();
    try {
      const compressedBase64 = await compressImage(file);
            let updatedItem = { ...selectedImage };
      let historyLog = `[${now}] Foto cambiada desde la galería.`;
      
      if (updatedItem.images) {
        updatedItem.images = updatedItem.images.map(img =>
          img.data === oldPhotoData ? { ...img, data: compressedBase64, date: now } : img
        );
        // La miniatura principal también debe apuntar a la foto nueva si era la reemplazada
        if (updatedItem.image === oldPhotoData) updatedItem.image = compressedBase64;
      } else {
        updatedItem.image = compressedBase64;
      }
      
      updatedItem.history = [...(updatedItem.history || []), historyLog];
      
      // Aplicar el cambio sobre la versión ACTUAL del equipo (puede haber cambiado en otra pestaña)
      const saved = await setInventory(prev => prev.map(i => {
        if (i.id !== updatedItem.id) return i;
        const images = i.images
          ? i.images.map(img => img.data === oldPhotoData ? { ...img, data: compressedBase64, date: now } : img)
          : undefined;
        const image = (!i.images || i.image === oldPhotoData) ? compressedBase64 : i.image;
        return { ...i, images, image, history: [...(i.history || []), historyLog] };
      }));
      if (!saved) return;
      setSelectedImage(updatedItem);
      addGlobalLog(currentUser, `Foto reemplazada para el equipo: ${updatedItem.name}.`);
    } catch (err) {
      console.error(err);
      alert("Error al procesar la imagen");
    }
  };

  const handleDeletePhoto = async (photoData) => {
    if (!window.confirm("¿Seguro que deseas eliminar esta foto?")) return;
    const now = nowString();
    let updatedItem = { ...selectedImage };
    let historyLog = `[${now}] Foto eliminada desde la galería.`;

    const keepsPhotos = updatedItem.images && updatedItem.images.length > 1;
    if (keepsPhotos) {
      updatedItem.images = updatedItem.images.filter(img => img.data !== photoData);
      // Si la miniatura principal era la foto borrada, pasa a ser la más reciente que queda
      if (!updatedItem.images.some(img => img.data === updatedItem.image)) {
        updatedItem.image = updatedItem.images[updatedItem.images.length - 1].data;
      }
    } else {
      updatedItem.image = null;
      delete updatedItem.images;
    }

    updatedItem.history = [...(updatedItem.history || []), historyLog];

    // Aplicar el borrado sobre la versión ACTUAL del equipo (puede haber cambiado en otra pestaña)
    const saved = await setInventory(prev => prev.map(i => {
      if (i.id !== updatedItem.id) return i;
      const remaining = (i.images || []).filter(img => img.data !== photoData);
      if (remaining.length === 0) {
        const next = { ...i, image: null, history: [...(i.history || []), historyLog] };
        delete next.images;
        return next;
      }
      const image = remaining.some(img => img.data === i.image) ? i.image : remaining[remaining.length - 1].data;
      return { ...i, images: remaining, image, history: [...(i.history || []), historyLog] };
    }));
    if (!saved) return;
    if (keepsPhotos) {
      setActivePhotoIdx(0);
      setSelectedImage(updatedItem);
    } else {
      setSelectedImage(null);
    }
    addGlobalLog(currentUser, `Foto eliminada para el equipo: ${updatedItem.name}.`);
  };

  const handleAddItem = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const now = nowString();
    const qty = parseInt(newItemQuantity, 10);
    if (!newItemName.trim() || isNaN(qty) || qty < 1) {
      alert("Por favor, ingrese un nombre válido y una cantidad mayor a 0.");
      return;
    }

    const newAssetNumber = normalizeAsset(newItemAssetNumber);
    if (newItemIsFixedAsset) {
      if (!newAssetNumber) {
        alert("Indica el número de Activo Fijo o desmarca la casilla \"¿Activo Fijo?\".");
        return;
      }
      if (qty !== 1) {
        alert("Un Activo Fijo es una sola unidad: la cantidad debe ser 1. Registra cada unidad con su propio número de activo.");
        return;
      }
      const duplicate = inventory.find(i => i.isFixedAsset && normalizeAsset(i.assetNumber) === newAssetNumber);
      if (duplicate) {
        alert("Error: Ya existe otro equipo registrado con el mismo número de Activo Fijo (" + duplicate.name + ").");
        return;
      }
    }

        const termWarehouses = WAREHOUSES_DATA[newItemTerminal] || [];
    const assignedWarehouse = newItemWarehouse || (termWarehouses.length > 0 ? termWarehouses[0].name : '');
    const finalNewArea = newItemStatus === 'En Almacén' ? assignedWarehouse : newItemArea;

    const newItem = {
      id: Date.now(),
      name: newItemName.trim(),
      status: newItemStatus,
      terminal: newItemTerminal,
      ownerTerminal: newItemTerminal,
      owner: newItemTerminal,
      area: finalNewArea,
      baseWarehouse: assignedWarehouse,
      isFixedAsset: newItemIsFixedAsset,
      assetNumber: newItemIsFixedAsset ? newAssetNumber : '',
      quantity: qty,
      image: newItemImage,
      images: newItemImage ? [{ data: newItemImage, status: newItemStatus, date: now }] : undefined,
      history: [`[${now}] Equipo Registrado. Estado Inicial: ${newItemStatus}. Ubicación: ${finalNewArea}. Almacén Base: ${assignedWarehouse}. Cantidad: ${qty}.`]
    };

    // Consolidation check for new item if not fixed asset (sobre la versión actual del inventario)
    const saved = await setInventory(prev => {
      const existingIndex = prev.findIndex(i => canConsolidate(i, newItem));
      if (existingIndex === -1) return [...prev, newItem];
      const consolidatedInventory = [...prev];
      const target = consolidatedInventory[existingIndex];
      const merged = {
        ...target,
        baseWarehouse: target.baseWarehouse || assignedWarehouse,
        quantity: target.quantity + qty,
        history: [...(target.history || []), `[${now}] Consolidación automática: +${qty} unidad(es) agregadas a este registro. Total: ${target.quantity + qty}.${newItemImage ? ' [Nueva Foto Adjunta]' : ''}`]
      };
      // La foto del registro nuevo se añade a la galería del registro existente (antes se perdía)
      if (newItemImage) {
        merged.images = [...withLegacyImage(target), ...newItem.images];
        if (!merged.image) merged.image = newItemImage;
      }
      consolidatedInventory[existingIndex] = merged;
      return consolidatedInventory;
    });
    // Si no se pudo guardar, el formulario queda abierto con los datos para reintentar
    if (!saved) return;
    addGlobalLog(currentUser, `Creado equipo nuevo: ${newItem.name} (Cant: ${newItem.quantity}, Terminal: ${newItem.terminal})`);
    
    // Reset search filters so the newly added item is not hidden by active table filters
    setTextFilterEquipo('');
    setTextFilterArea('');
    setTextFilterEstado('');
    setTextFilterActivo('');
    setShowTextFilters(false);
    if (filterTerminal !== 'Todas' && filterTerminal !== newItemTerminal) {
      setFilterTerminal('Todas');
    }
    if (filterStatus !== 'Todos' && filterStatus !== newItemStatus) {
      setFilterStatus('Todos');
    }

    setNewItemName(''); 
    setNewItemQuantity(1);
    setNewItemImage(null);
    setNewItemIsFixedAsset(false);
    setNewItemAssetNumber('');
    setIsAddModalOpen(false); 

    setTimeout(() => {
      alert(`✅ Equipo "${newItem.name}" (${newItem.quantity} unidades) registrado exitosamente.`);
    }, 50);
    } catch (err) {
      console.error('[ERROR] Fallo al registrar equipo:', err);
      alert('Error al registrar equipo: ' + (err.message || err));
    }
  };

  // Abre la fila en modo edición (sin tocar el inventario)
  const openEditor = (item) => {
    // Almacén Base = almacén de origen del equipo (de su terminal propietaria). Si falta en
    // registros antiguos, se deduce del área solo si es un almacén de la terminal propietaria.
    const ownerWhs = (WAREHOUSES_DATA[ownerOf(item)] || []).map(w => w.name);
    const resolvedBaseWh = item.baseWarehouse || (ownerWhs.includes(item.area) ? item.area : (ownerWhs[0] || ''));

    setEditingId(item.id);
    setEditFormData({ ...item, baseWarehouse: resolvedBaseWh });
    setEditNewImage(null);
  };

  const handleEditClick = (item) => {
    // Si estábamos editando un borrador sin guardar (clon) y se pasa a otra fila, se descarta.
    // El borrador solo existe en pantalla: nunca se escribe en el inventario guardado.
    if (draftItem && String(draftItem.item.id) !== String(item.id)) setDraftItem(null);
    openEditor(item);
  };

  const handleCancelEdit = () => {
    if (draftItem && String(draftItem.item.id) === String(editingId)) setDraftItem(null);
    setEditingId(null);
    setEditNewImage(null);
  };

  const handleSaveEdit = async (id) => {
    const now = nowString();
    const parsedQty = parseInt(editFormData.quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1 || !editFormData.name?.trim()) {
      alert("Error: Nombre inválido o cantidad menor a 1.");
      return;
    }

    const editAssetNumber = normalizeAsset(editFormData.assetNumber);
    if (editFormData.isFixedAsset && !editAssetNumber) {
      alert("Indica el número de Activo Fijo o desmarca la casilla \"Activo\".");
      return;
    }
    if (editFormData.isFixedAsset) {
      const duplicate = inventory.find(i => String(i.id) !== String(id) && i.isFixedAsset && normalizeAsset(i.assetNumber) === editAssetNumber);
      if (duplicate) {
        alert("Error: Ya existe otro equipo registrado con el mismo número de Activo Fijo (" + duplicate.name + ").");
        return;
      }
    }

    const draft = draftItem && String(draftItem.item.id) === String(id) ? draftItem : null;
    const original = draft ? draft.item : inventory.find(i => String(i.id) === String(id));
    if (!original) {
      setEditingId(null);
      return;
    }

    // Un Activo Fijo es una sola unidad. Los registros antiguos con más unidades se pueden
    // seguir editando sin cambiar su cantidad, pero no se puede crear ni ampliar uno así.
    if (editFormData.isFixedAsset && parsedQty > 1 &&
        (draft || !original.isFixedAsset || parsedQty !== original.quantity)) {
      alert("Un Activo Fijo es una sola unidad: la cantidad debe ser 1. Registra cada unidad con su propio número de activo.");
      return;
    }

    const ownerWhs = (WAREHOUSES_DATA[ownerOf(original)] || []).map(w => w.name);
    let resolvedBaseWarehouse = editFormData.baseWarehouse || original.baseWarehouse || (ownerWhs.includes(original.area) ? original.area : (ownerWhs[0] || ''));
    const finalArea = editFormData.status === 'En Almacén'
      ? (ALL_WAREHOUSE_NAMES.includes(editFormData.area) ? editFormData.area : resolvedBaseWarehouse)
      : editFormData.area;
    
    // VALIDATION: Prevent uploading duplicate photo for the same status
    if (editNewImage) {
      const existingImages = withLegacyImage(original);

      const duplicateStatusImage = existingImages.find(img => img.status === editFormData.status);
      if (duplicateStatusImage) {
         alert("Ya existe una foto para este estado. Cambie el estado o elimine la foto anterior desde la galería.");
         return;
      }
    }

    const qtyDelta = original.quantity - parsedQty;
    const hasDestinationChanged = original.status !== editFormData.status || original.area !== finalArea || original.terminal !== editFormData.terminal;

    // Un número de Activo Fijo identifica una unidad concreta: no se puede repartir entre dos registros.
    if (original.isFixedAsset && qtyDelta > 0 && hasDestinationChanged && !original.isDraft) {
      alert("Un Activo Fijo no se puede fraccionar: mueve el registro completo (misma cantidad) o regístralo por unidades con su propio número.");
      return;
    }

    // Al trasladar, se mueven unidades existentes: no se puede mover más de las que hay.
    if (!original.isDraft && hasDestinationChanged && parsedQty > original.quantity) {
      alert(`No puedes trasladar ${parsedQty} unidades: este registro solo tiene ${original.quantity}.\nSi necesitas corregir la cantidad, hazlo primero sin cambiar la ubicación ni el estado.`);
      return;
    }

    // Ajuste de inventario: cambiar la cantidad sin moverla suma o da de baja unidades.
    // Se pide confirmación y un motivo, que queda en el historial.
    let adjustReason = '';
    if (!original.isDraft && !hasDestinationChanged && qtyDelta !== 0) {
      const diff = parsedQty > original.quantity
        ? `subir de ${original.quantity} a ${parsedQty} unidades (+${-qtyDelta})`
        : `bajar de ${original.quantity} a ${parsedQty} unidades (${qtyDelta} se darán de baja)`;
      const answer = window.prompt(`Vas a ${diff} sin cambiar la ubicación ni el estado.\n\nSi querías trasladar parte del lote, cancela y cambia también la ubicación o el estado.\n\nPara confirmar el ajuste, escribe el motivo:`);
      if (answer === null) return;
      adjustReason = answer.trim();
      if (!adjustReason) {
        alert('El ajuste de cantidad necesita un motivo. No se guardó ningún cambio.');
        return;
      }
    }

    let historyLog = `[${now}] Editado. `;
    if (original.status !== editFormData.status) historyLog += `Estado cambió de "${original.status}" a "${editFormData.status}". `;
    if (original.area !== finalArea) historyLog += `Ubicación cambió de "${original.area}" a "${finalArea}". `;
    
    // CORRECCIÓN TYPO PROPIETARIO: Si cambia de terminal y solo tiene 1 registro histórico (el inicial), fue un error de registro.
    // Un fraccionamiento NUNCA es una corrección de registro (parte del stock se queda en el origen): es un préstamo.
    const isSplit = qtyDelta > 0 && !original.isDraft && hasDestinationChanged;
    let newOwner = ownerOf(original);
    if (original.terminal !== editFormData.terminal) {
       if (!isSplit && original.history && original.history.length === 1 && ownerOf(original) === original.terminal) {
         newOwner = editFormData.terminal;
         historyLog += `Corrección de registro: Transferido permanentemente a ${editFormData.terminal}. `;
         // Corrección de registro: el equipo siempre fue de la otra terminal, así que su
         // almacén base también debe ser de esa terminal.
         const newOwnerWhs = (WAREHOUSES_DATA[newOwner] || []).map(w => w.name);
         if (!newOwnerWhs.includes(resolvedBaseWarehouse)) {
           resolvedBaseWarehouse = newOwnerWhs.includes(finalArea) ? finalArea : (newOwnerWhs[0] || '');
           historyLog += `Almacén Base corregido a "${resolvedBaseWarehouse}". `;
         }
       } else {
         historyLog += `Trasladado físicamente a ${editFormData.terminal} (Mantiene propiedad original de ${newOwner}). `;
       }
    }

    // Si el guardado falla, se vuelve a abrir el editor con lo que se había escrito.
    const formSnapshot = editFormData;
    const imageSnapshot = editNewImage;
    const reopenEditor = () => {
      if (draft) setDraftItem(draft);
      setEditingId(id);
      setEditFormData(formSnapshot);
      setEditNewImage(imageSnapshot);
    };

    // Cierre inmediato del modo edición y limpieza de filtros activos para que se vean ambas filas
    setEditingId(null);
    setEditNewImage(null);
    if (draft) setDraftItem(null);
    setTextFilterEquipo('');
    setTextFilterArea('');
    setTextFilterEstado('');
    setFilterStatus('Todos');
    setShowTextFilters(false);

    if (isSplit) {
      // ERP Splitting Logic: El remanente (qtyDelta) se queda en el estado/ubicación original, y la nueva cantidad (parsedQty) pasa al nuevo estado/ubicación
      const parentImages = withLegacyImage(original);
      
      const parentRemain = {
        ...original,
        // El remanente no se mueve: conserva su propio almacén base (no el de la terminal destino)
        baseWarehouse: original.baseWarehouse
          || (ALL_WAREHOUSE_NAMES.includes(original.area) ? original.area : ((WAREHOUSES_DATA[original.terminal] || [])[0]?.name || '')),
        quantity: qtyDelta,
        images: parentImages.length > 0 ? parentImages : undefined,
        history: [...(original.history || []), `[${now}] Fraccionamiento: ${parsedQty} unidad(es) extraídas hacia "${finalArea}" (${editFormData.status}). Restan ${qtyDelta} en "${original.area}" (${original.status}).`]
      };

      let childImages = parentImages.map(img => ({...img})); // clone
      if (editNewImage) {
        childImages.push({ data: editNewImage, status: editFormData.status, date: now });
      }

      const childSpawn = {
        ...editFormData,
        owner: newOwner,
        ownerTerminal: newOwner,
        area: finalArea,
        baseWarehouse: resolvedBaseWarehouse,
        id: Date.now(),
        name: editFormData.name.trim(),
        isFixedAsset: editFormData.isFixedAsset,
        assetNumber: editFormData.isFixedAsset ? editAssetNumber : '',
        quantity: parsedQty,
        image: editNewImage || original.image,
        images: childImages.length > 0 ? childImages : undefined,
        history: [...(original.history || []), `[${now}] Extraído (${parsedQty} uds) desde "${original.area}" (${original.status}) hacia "${finalArea}" (${editFormData.status}).${original.terminal !== editFormData.terminal ? ` Trasladado físicamente a ${editFormData.terminal} (propiedad de ${newOwner}).` : ''}`]
      };
      
      delete childSpawn.isDraft;

      // Consolidation check for childSpawn (sobre la versión actual del inventario)
      const saved = await setInventory(prev => {
        const existingMatch = prev.find(i => String(i.id) !== String(id) && canConsolidate(i, childSpawn));
        if (!existingMatch) {
          return prev.map(i => String(i.id) === String(id) ? parentRemain : i).concat(childSpawn);
        }
        return prev.map(i => {
          if (String(i.id) === String(id)) return parentRemain;
          if (String(i.id) === String(existingMatch.id)) {
            let mergedImages = withLegacyImage(i);
            if (childSpawn.images) {
              childSpawn.images.forEach(img => {
                if (!mergedImages.find(m => m.data === img.data && m.status === img.status)) {
                  mergedImages = [...mergedImages, img];
                }
              });
            }
            return {
              ...i,
              baseWarehouse: i.baseWarehouse || resolvedBaseWarehouse,
              quantity: i.quantity + parsedQty,
              images: mergedImages.length > 0 ? mergedImages : undefined,
              history: [...(i.history || []), `[${now}] Consolidación: +${parsedQty} unidad(es) recibidas desde "${original.area}". Total: ${i.quantity + parsedQty}.`]
            };
          }
          return i;
        });
      });
      if (!saved) { reopenEditor(); return; }

      addGlobalLog(currentUser, `Fraccionamiento de equipo: ${original.name}. ${parsedQty} uds a ${finalArea} (${editFormData.status}), restan ${qtyDelta} uds en ${original.area} (${original.status}).`);

      setTimeout(() => {
        alert(`✅ División de stock exitosa:\n• ${parsedQty} unidades pasaron a "${finalArea}" (${editFormData.status}).\n• ${qtyDelta} unidades permanecen en "${original.area}" (${original.status}).`);
      }, 50);
    } else {
      if (qtyDelta !== 0 && !original.isDraft) {
        historyLog += `Ajuste de cantidad de ${original.quantity} a ${parsedQty}. Motivo: ${adjustReason}. `;
      }
      if (!original.isDraft && (original.baseWarehouse || '') !== resolvedBaseWarehouse && !historyLog.includes('Almacén Base corregido')) {
        historyLog += `Almacén Base cambió de "${original.baseWarehouse || '—'}" a "${resolvedBaseWarehouse}". `;
      }
      
      let imagesArray = withLegacyImage(original);
      if (editNewImage) {
        imagesArray = [...imagesArray, { data: editNewImage, status: editFormData.status, date: now }];
        historyLog += '[Nueva Foto Adjunta] ';
      }

      const updated = {
        ...editFormData,
        owner: newOwner,
        ownerTerminal: newOwner,
        area: finalArea,
        baseWarehouse: resolvedBaseWarehouse,
        name: editFormData.name.trim(),
        isFixedAsset: editFormData.isFixedAsset,
        assetNumber: editFormData.isFixedAsset ? editAssetNumber : '',
        quantity: parsedQty,
        image: editNewImage || original.image,
        images: imagesArray.length > 0 ? imagesArray : undefined,
        history: [...(original.history || []), historyLog]
      };
      
      delete updated.isDraft;

      // Consolidation check for updated item (sobre la versión actual del inventario).
      // Un borrador (clon) todavía no está en el inventario: al guardarlo se añade.
      const saved = await setInventory(prev => {
        const existingMatch = prev.find(i => String(i.id) !== String(id) && canConsolidate(i, updated));
        if (!existingMatch) {
          return draft ? [...prev, updated] : prev.map(i => String(i.id) === String(id) ? updated : i);
        }
        // Merge updated into existingMatch and remove row id
        return prev
          .filter(i => String(i.id) !== String(id))
          .map(i => {
            if (String(i.id) === String(existingMatch.id)) {
              let mergedImages = withLegacyImage(i);
              if (updated.images) {
                updated.images.forEach(img => {
                  if (!mergedImages.find(m => m.data === img.data && m.status === img.status)) {
                    mergedImages = [...mergedImages, img];
                  }
                });
              }
              return {
                ...i,
                baseWarehouse: i.baseWarehouse || resolvedBaseWarehouse,
                quantity: i.quantity + parsedQty,
                images: mergedImages.length > 0 ? mergedImages : undefined,
                history: [...(i.history || []), `[${now}] Consolidación por edición: +${parsedQty} unidad(es) unificadas desde "${original.name}" en ${original.area}. Total: ${i.quantity + parsedQty}.`]
              };
            }
            return i;
          });
      });
      if (!saved) { reopenEditor(); return; }

      addGlobalLog(currentUser, `Editado equipo: ${updated.name}. ${historyLog}`);

      setTimeout(() => {
        alert(`✅ Equipo "${updated.name}" actualizado exitosamente.`);
      }, 50);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    if (deletePassword.trim() === 'CONFIRMO') {
      const deletedName = itemToDelete.name;
      const targetId = itemToDelete.id;

      // Cierre inmediato del modal
      setItemToDelete(null);
      setDeletePassword('');
      setEditingId(null);

      // Un borrador (clon sin guardar) no está en el inventario: basta con descartarlo
      if (draftItem && String(draftItem.item.id) === String(targetId)) {
        setDraftItem(null);
        return;
      }

      // Eliminación robusta comparando IDs como String
      if (!(await setInventory(prev => prev.filter(i => String(i.id) !== String(targetId))))) return;
      addGlobalLog(currentUser, `Eliminado permanentemente el equipo: ${deletedName}.`);
      
      setTimeout(() => {
        alert(`🗑️ El equipo "${deletedName}" fue eliminado permanentemente del inventario.`);
      }, 50);
    } else {
      alert('Debes escribir CONFIRMO (en mayúsculas) para eliminar.');
    }
  };

  const exportToCSV = () => {
    if (filteredInventory.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    const headers = ["Nombre", "Terminal", "Area", "Almacen Base", "Estado", "Cantidad", "Activo Fijo", "Propietario"];
    const rows = filteredInventory.map(item => [
      item.name,
      item.terminal,
      item.area,
      item.baseWarehouse || (ALL_WAREHOUSE_NAMES.includes(item.area) ? item.area : ''),
      item.status,
      item.quantity || 1,
      item.isFixedAsset && item.assetNumber ? item.assetNumber : '',
      item.ownerTerminal || item.terminal || ''
    ]);
    downloadCSV(headers, rows, `Inventario_GPC_${fileStamp()}.csv`);
  };

  // Respaldo completo (inventario + fotos + historial + bitácora global) en un solo JSON descargable.
  const handleBackupDownload = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo_inventario_gpc_${fileStamp()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addGlobalLog(currentUser, 'Descargó un respaldo completo del inventario.');
  };

  // Restaurar reemplaza TODOS los datos actuales por los del archivo. Antes de hacerlo,
  // useInventory descarga automáticamente un respaldo de lo que había, por seguridad.
  const handleRestoreFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('⚠️ Esto reemplazará TODO el inventario y la bitácora actuales con los del archivo seleccionado.\n\nSe descargará automáticamente un respaldo de los datos actuales antes de restaurar, por seguridad.\n\n¿Deseas continuar?')) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await restoreBackup(parsed);
      if (result) {
        // Lo que estaba en edición o clonado pertenece a los datos anteriores
        setDraftItem(null);
        setEditingId(null);
        setEditNewImage(null);
        const extra = result.discarded > 0 ? ` Se descartaron ${result.discarded} registros inválidos (sin id o sin nombre).` : '';
        addGlobalLog(currentUser, `Restauró el inventario desde un archivo de respaldo (${file.name}).${extra}`);
        if (!result.logsFailed) alert(`✅ Inventario restaurado correctamente.${extra}`);
      }
    } catch (err) {
      console.error('Error restaurando respaldo', err);
      alert(`⚠️ No se pudo restaurar el archivo: ${err.message || 'formato inválido.'}`);
    }
  };

  const handleCloneItem = (item) => {
    const now = nowString();
    const cloned = {
      ...item,
      id: Date.now(),
      isDraft: true,
      assetNumber: item.isFixedAsset ? '' : item.assetNumber,
      history: [...(item.history || []), `[${now}] Registro clonado a partir de otro lote de equipos.`]
    };
    if (item.isFixedAsset) {
      cloned.history.push(`[${now}] Número de Activo Fijo limpiado automáticamente para evitar duplicidad.`);
    }
    // El clon solo existe en pantalla (debajo de su fila de origen) hasta que se pulsa OK:
    // no se escribe en el inventario guardado ni lo ven otras pestañas. Reemplaza al borrador anterior.
    const sourceId = draftItem && String(draftItem.item.id) === String(item.id) ? draftItem.sourceId : item.id;
    setDraftItem({ item: cloned, sourceId });
    openEditor(cloned);
  };

  const handleEditFormChange = (e, field) => {
    const val = e.target.value;
    setEditFormData(prev => {
      let updated = { ...prev, [field]: val };

      // Almacén Base es el almacén donde se registró el equipo: trasladarlo (de terminal, de área
      // o de estado) NO lo cambia. Solo se cambia a mano en su selector.
      // Almacén de destino al guardar en un almacén: el base si está en esta terminal; si no, el primero.
      const warehouseIn = (term) => {
        const whs = WAREHOUSES_DATA[term] || [];
        if (updated.baseWarehouse && whs.some(w => w.name === updated.baseWarehouse)) return updated.baseWarehouse;
        return whs.length > 0 ? whs[0].name : '';
      };

      if (field === 'terminal') {
        if (updated.status === 'En Almacén') {
          updated.area = warehouseIn(val);
        } else {
          const opAreas = getOperationalAreas(val);
          updated.area = opAreas[0];
        }
      }

      if (field === 'area') {
        // Si selecciona un Almacén en la columna Área/Ubicación, pasa automáticamente a estado 'En Almacén'
        if (ALL_WAREHOUSE_NAMES.includes(val)) {
          updated.status = 'En Almacén';
        } else if (prev.status === 'En Almacén') {
          // Si estaba en Almacén y selecciona un Área Operativa, pasa automáticamente a 'En uso'
          updated.status = 'En uso';
        }
      }

      if (field === 'status') {
        if (val === 'En Almacén') {
          updated.area = warehouseIn(updated.terminal);
        } else if (prev.status === 'En Almacén' || ALL_WAREHOUSE_NAMES.includes(updated.area)) {
          const opAreas = getOperationalAreas(updated.terminal);
          updated.area = opAreas[0];
        }
      }

      return updated;
    });
  };
  const getAvailableAreas = (terminal, status) => {
    return getAreasForTerminal(terminal, status);
  };

  // Filtrado de inventario para la vista principal.
  // Memorizado: solo se recalcula cuando cambian el inventario o los filtros, no en cada tecla del editor.
  const chartInventory = useMemo(() => inventory.filter(item => {
    let matchTerminal = filterTerminal === 'Todas' ? true : item.terminal === filterTerminal;
    if (filterIsProperty && filterTerminal !== 'Todas') {
       matchTerminal = item.ownerTerminal === filterTerminal && item.terminal !== filterTerminal;
    }
    const matchStatus = filterStatus === 'Todos' ? true : item.status === filterStatus;
    const matchType = filterType === 'Todos' ? true : item.name === filterType;
    return matchTerminal && matchStatus && matchType;
  }), [inventory, filterTerminal, filterIsProperty, filterStatus, filterType]);

  const filteredInventory = useMemo(() => inventory.filter(item => {
    let matchTerminal = filterTerminal === 'Todas' ? true : item.terminal === filterTerminal;
    if (filterIsProperty && filterTerminal !== 'Todas') {
       matchTerminal = item.ownerTerminal === filterTerminal && item.terminal !== filterTerminal;
    }
    const matchStatus = filterStatus === 'Todos' ? true : item.status === filterStatus;
    const matchType = filterType === 'Todos' ? true : item.name === filterType;

    const matchTextEquipo = item.name.toLowerCase().includes(textFilterEquipo.toLowerCase());
    const matchTextArea = (item.area || '').toLowerCase().includes(textFilterArea.toLowerCase());
    const matchTextEstado = (item.status || '').toLowerCase().includes(textFilterEstado.toLowerCase());
    const matchTextActivo = (item.assetNumber || '').toLowerCase().includes(textFilterActivo.toLowerCase());

    let matchOwner = filterOwner === 'Todos' ? true : item.ownerTerminal === filterOwner;
    return matchTerminal && matchStatus && matchType && matchTextEquipo && matchTextArea && matchTextEstado && matchOwner && matchTextActivo;
  }), [inventory, filterTerminal, filterIsProperty, filterStatus, filterType, textFilterEquipo, textFilterArea, textFilterEstado, textFilterActivo, filterOwner]);

  const sortedInventory = React.useMemo(() => {
    let sortableItems = [...filteredInventory];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key] || '';
        let valB = b[sortConfig.key] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredInventory, sortConfig]);

  // Filas de la tabla: el clon en edición (si lo hay) aparece justo debajo de su fila de origen
  const tableRows = useMemo(() => {
    if (!draftItem) return sortedInventory;
    const idx = sortedInventory.findIndex(i => String(i.id) === String(draftItem.sourceId));
    if (idx === -1) return [...sortedInventory, draftItem.item];
    return [...sortedInventory.slice(0, idx + 1), draftItem.item, ...sortedInventory.slice(idx + 1)];
  }, [sortedInventory, draftItem]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const chartData = useMemo(() => {
    let dataMap = {};
    if (filterTerminal === 'Todas') {
      chartInventory.forEach(item => { dataMap[item.terminal] = (dataMap[item.terminal] || 0) + item.quantity; });
    } else {
      chartInventory.forEach(item => {
        dataMap[item.status] = (dataMap[item.status] || 0) + item.quantity;
      });
    }
    return Object.keys(dataMap).map(key => ({ name: key, value: dataMap[key] }));
  }, [chartInventory, filterTerminal]);

  // KPIs
  // Excluimos "Decomisado" del cálculo total real para no inflar métricas con basura
  const { totalItems, tableTotalItems, operativosItems, danadosItems } = useMemo(() => {
    const sum = (list) => list.reduce((acc, curr) => acc + curr.quantity, 0);
    return {
      totalItems: sum(filteredInventory.filter(i => i.status !== 'Decomisado')),
      tableTotalItems: sum(filteredInventory),
      operativosItems: sum(filteredInventory.filter(i => i.status.startsWith('En uso'))),
      danadosItems: sum(filteredInventory.filter(i => i.status.startsWith('Inhabilitado'))),
    };
  }, [filteredInventory]);

  // KPI de Préstamos: ¿Cuántos equipos PROPIEDAD de la terminal actual (filtro) están ubicados físicamente en otra terminal?
  // Esto analiza todo el inventario base, no el inventario filtrado, para detectar equipos que salieron de su frontera.
  const prestadosItems = useMemo(() => inventory.filter(i => {
    const isOwnedByFilter = filterTerminal === 'Todas' ? true : ownerOf(i) === filterTerminal;
    const isLoanedOut = ownerOf(i) !== i.terminal; // Si la terminal actual es diferente al dueño, está prestado.
    return isOwnedByFilter && isLoanedOut;
  }).reduce((acc, curr) => acc + curr.quantity, 0), [inventory, filterTerminal]);

  return (
    <div style={{ padding: '80px 20px 60px 20px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }} className="dashboard-container">
      
      <nav className="top-nav no-print" style={{ width: '100%', boxSizing: 'border-box', left: 0 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', width: '100%', boxSizing: 'border-box' }}>
          <div className="top-nav-group-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo-app.png" alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
            <h2 style={{ margin: 0, color: 'var(--q-accent)', fontWeight: 900 }}>Stock <span style={{ color: 'var(--text-main)', fontWeight: 300 }}>Terminal</span></h2>
          </div>
          <div className="top-nav-group-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="dark-mode-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--q-dark)', display: 'flex', alignItems: 'center' }} title="Alternar Modo Oscuro" aria-label="Alternar modo oscuro">
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>

            
            <button onClick={() => setIsAddModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Plus size={18} /> NUEVO EQUIPO
            </button>
            <button onClick={onLogout} className="btn-danger">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      {/* Controladores */}
      <div className="material-card master-filters no-print" style={{ padding: '15px 20px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '12px', display: 'block', fontWeight: '500', color: 'var(--text-muted)' }}>Terminal</label>
          <select value={filterTerminal} onChange={(e) => setFilterTerminal(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none' }}>
            <option value="Todas">Global (Todas)</option>
            {TERMINAL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '12px', display: 'block', fontWeight: '500', color: 'var(--text-muted)' }}>Estado</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none' }}>
            <option value="Todos">Todos los Estados</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '12px', display: 'block', fontWeight: '500', color: 'var(--text-muted)' }}>Tipo de Equipo</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none' }}>
            {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {filterTerminal !== 'Todas' && (
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', paddingTop: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: 'var(--q-dark)', cursor: 'pointer' }}>
              <input type="checkbox" checked={filterIsProperty} onChange={(e) => setFilterIsProperty(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
              Ver Propiedad Externa
            </label>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <KPICards 
        totalItems={totalItems} 
        operativosItems={operativosItems} 
        danadosItems={danadosItems} 
        prestadosItems={prestadosItems} 
      />

      <div className="dashboard-grid">
        {/* Gráfico Analítico */}
        <div className="material-card no-print" style={{ padding: '20px', height: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ color: 'var(--q-dark)', marginBottom: '0px', fontSize: '16px' }}>
            Distribución ({filterTerminal === 'Todas' ? 'por Terminales' : 'por Estados'})
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="45%" innerRadius={70} outerRadius={120} paddingAngle={2} dataKey="value">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#333'} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} Equipos`, name]} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ marginTop: '50px', color: 'var(--text-muted)' }}>Sin datos.</p>
          )}
        </div>

        {/* Módulo de Almacenes Oficiales */}
        <div className="material-card no-print" style={{ height: '420px', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ color: 'var(--q-dark)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
              <Package size={20} color="var(--q-accent)" />
              Almacenes
            </h3>
            <span style={{ fontSize: '11px', background: 'var(--q-accent)', color: 'white', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
              {WAREHOUSE_COUNT} Almacenes Activos
            </span>
          </div>

          {/* Pestañas de Terminales */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', borderBottom: '1px solid var(--q-secondary)', paddingBottom: '8px', flexWrap: 'wrap' }}>
            {TERMINAL_OPTIONS.map(term => {
              const isSelected = activeWarehouseTab === term;
              const termWarehouses = WAREHOUSES_DATA[term] || [];
              return (
                <button
                  key={term}
                  type="button"
                  onClick={() => setActiveWarehouseTab(term)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    border: isSelected ? 'none' : '1px solid var(--q-secondary)',
                    backgroundColor: isSelected ? 'var(--q-accent)' : 'var(--card-bg)',
                    color: isSelected ? 'white' : 'var(--text-main)',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  {term}
                  <span style={{
                    fontSize: '10px',
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--q-secondary)',
                    color: isSelected ? 'white' : 'var(--text-muted)',
                    padding: '1px 6px',
                    borderRadius: '10px'
                  }}>
                    {termWarehouses.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grid de Almacenes por Terminal */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px', paddingRight: '4px' }}>
            {(WAREHOUSES_DATA[activeWarehouseTab] || []).map((wh) => {
              const itemsInWh = inventory.filter(item => item.terminal === activeWarehouseTab && item.status === 'En Almacén' && item.area === wh.name);
              const totalUnits = itemsInWh.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 1), 0);
              const isFiltered = textFilterArea === wh.name;

              return (
                <div
                  key={wh.name}
                  onClick={() => {
                    if (isFiltered) {
                      setTextFilterArea('');
                      setShowTextFilters(false);
                    } else {
                      setTextFilterArea(wh.name);
                      setFilterTerminal(activeWarehouseTab);
                      setFilterStatus('En Almacén');
                      setShowTextFilters(true);
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: isFiltered ? '2px solid var(--q-accent)' : '1px solid var(--q-secondary)',
                    backgroundColor: isFiltered ? 'rgba(0, 107, 63, 0.08)' : 'var(--q-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  title={`Haz clic para filtrar equipos en ${wh.name}`}
                >
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--q-dark)', marginBottom: '3px', lineHeight: '1.2' }}>
                      {wh.name}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      📍 {wh.location}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--table-border)' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Stock:</span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: 'bold', 
                      color: totalUnits > 0 ? 'var(--q-positive)' : 'var(--text-muted)',
                      backgroundColor: totalUnits > 0 ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel Principal: Tabla */}
        <div className="material-card" style={{ padding: '20px' }}>
          <div className="table-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--q-dark)', margin: 0 }}>
              Detalle de Inventario ({tableTotalItems} unidades)
            </h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }} className="no-print">
              <button onClick={() => setShowTextFilters(!showTextFilters)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: showTextFilters ? 'var(--q-accent)' : '', color: showTextFilters ? 'white' : '' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                Filtrar
              </button>
              <button onClick={() => setIsGlobalLogOpen(true)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Activity size={16} /> Histórico
              </button>
              <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                Imprimir
              </button>
              <label className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', background: 'var(--q-info)', color: 'white', border: 'none' }}>
                <Upload size={16} /> Importar Excel
                <input type="file" accept=".xlsx, .xls, .csv" style={{ display: 'none' }} onChange={handleExcelImport} />
              </label>
              <button onClick={exportToCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Exportar CSV
              </button>
              <button onClick={handleBackupDownload} className="btn-secondary" title="Descargar un respaldo completo (inventario, fotos e historial)" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Download size={16} /> Respaldo
              </button>
              <label className="btn-secondary" title="Restaurar desde un archivo de respaldo (reemplaza todos los datos actuales)" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <Upload size={16} /> Restaurar
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestoreFile} />
              </label>
            </div>
          </div>

          {showTextFilters && (
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', background: 'var(--q-primary)', borderRadius: '8px', border: '1px solid var(--q-secondary)' }}>
              <input type="text" placeholder="Buscar por Equipo..." value={textFilterEquipo} onChange={(e) => setTextFilterEquipo(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }} />
              <input type="text" placeholder="Buscar por Área..." value={textFilterArea} onChange={(e) => setTextFilterArea(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }} />
              <input type="text" placeholder="Buscar por Estado..." value={textFilterEstado} onChange={(e) => setTextFilterEstado(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }} />
              <input type="text" placeholder="Buscar por # Activo..." value={textFilterActivo} onChange={(e) => setTextFilterActivo(e.target.value)} style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px', outline: 'none' }} />
            </div>
          )}
          <div className="table-wrapper" style={{ overflowX: 'auto', maxHeight: '600px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--q-secondary)', color: 'var(--text-muted)' }}>
                  <th onClick={() => requestSort('name')} style={{ padding: '12px', textAlign: 'left', fontWeight: '500', cursor: 'pointer', userSelect: 'none' }} title="Ordenar por Nombre de Equipo">
                    Equipo {sortConfig.key === 'name' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => requestSort('quantity')} style={{ padding: '12px', textAlign: 'left', fontWeight: '500', cursor: 'pointer', userSelect: 'none' }} title="Ordenar por Cantidad">
                    Cant. {sortConfig.key === 'quantity' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => requestSort('terminal')} style={{ padding: '12px', textAlign: 'left', fontWeight: '500', cursor: 'pointer', userSelect: 'none' }} title="Ordenar por Ubicación / Terminal">
                    Ubicación {sortConfig.key === 'terminal' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => requestSort('area')} style={{ padding: '12px', textAlign: 'left', fontWeight: '500', cursor: 'pointer', userSelect: 'none' }} title="Ordenar por Área / Almacén">
                    Área {sortConfig.key === 'area' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => requestSort('status')} style={{ padding: '12px', textAlign: 'left', fontWeight: '500', cursor: 'pointer', userSelect: 'none' }} title="Ordenar por Estado">
                    Estado {sortConfig.key === 'status' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : ''}
                  </th>
                  <th className="no-print" style={{ padding: '12px', textAlign: 'center', fontWeight: '500', minWidth: '150px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    {editingId === item.id ? (
                      <>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <label style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--q-secondary)', borderRadius: '4px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Adjuntar nueva foto para este estado">
                              <Camera size={16} color="var(--text-muted)" />
                              <input type="file" accept="image/*" aria-label="Adjuntar nueva foto" style={{ display: 'none' }} onChange={async (e) => {
                                 const f = e.target.files[0];
                                 if (f) {
                                   try {
                                     setEditNewImage(await compressImage(f));
                                   } catch (err) { console.error(err); alert("Error al procesar la foto."); }
                                 }
                              }} />
                            </label>
                            {editNewImage && <span style={{ color: 'var(--q-positive)', fontSize: '12px' }}>✓ Foto Lista</span>}
                            <input 
                              type="text" 
                              list={(editFormData.name === item.name || editFormData.name === '') ? "equipment-names-edit" : undefined} 
                              value={editFormData.name} 
                              onChange={(e) => handleEditFormChange(e, 'name')} 
                              style={{ width: '100%', padding: '4px' }} 
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <input type="checkbox" checked={editFormData.isFixedAsset || false} onChange={(e) => setEditFormData(prev => ({ ...prev, isFixedAsset: e.target.checked }))} />
                                Activo
                              </label>
                              {editFormData.isFixedAsset && (
                                <input type="text" placeholder="# Activo" value={editFormData.assetNumber || ''} onChange={(e) => handleEditFormChange(e, 'assetNumber')} style={{ width: '80px', padding: '2px 4px', fontSize: '11px' }} />
                              )}
                            </div>
                          </div>
                          <datalist id="equipment-names-edit">{typeSuggestions.map(t => <option key={t} value={t} />)}</datalist>
                        </td>
                        <td style={{ padding: '8px' }}><input type="number" min="1" value={editFormData.quantity} onKeyDown={(e) => { if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault(); }} onChange={(e) => { const cleanVal = e.target.value.replace(/[^0-9]/g, ''); setEditFormData(prev => ({ ...prev, quantity: cleanVal })); }} style={{ width: '50px', padding: '4px' }} title={`Fraccionar lote. Original: ${item.quantity}`} /></td>
                        <td style={{ padding: '8px' }}>
                          {/* Cambiar de terminal ahora significa trasladarlo/prestarlo */}
                          <select value={editFormData.terminal} onChange={(e) => handleEditFormChange(e, 'terminal')}>
                            {TERMINAL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select value={editFormData.area} onChange={(e) => handleEditFormChange(e, 'area')}>
                            <optgroup label={`📦 Almacenes (${editFormData.terminal})`}>
                              {(WAREHOUSES_DATA[editFormData.terminal] || []).map(w => (
                                <option key={w.name} value={w.name}>{w.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label={`🏢 Áreas Operativas (${editFormData.terminal})`}>
                              {getOperationalAreas(editFormData.terminal).map(a => (
                                <option key={a} value={a}>{a}</option>
                              ))}
                            </optgroup>
                          </select>
                          {editFormData.status !== 'En Almacén' && (
                            <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                              <span>Almacén Base: </span>
                              <select
                                value={editFormData.baseWarehouse || ''}
                                onChange={(e) => setEditFormData(prev => ({ ...prev, baseWarehouse: e.target.value }))}
                                style={{ fontSize: '10px', padding: '2px', borderRadius: '3px', border: '1px solid #ccc' }}
                              >
                                {/* Almacén Base = almacén de la terminal propietaria; no cambia al prestar */}
                                {editFormData.baseWarehouse && !(WAREHOUSES_DATA[ownerOf(editFormData)] || []).some(w => w.name === editFormData.baseWarehouse) && (
                                  <option value={editFormData.baseWarehouse}>{editFormData.baseWarehouse}</option>
                                )}
                                {(WAREHOUSES_DATA[ownerOf(editFormData)] || []).map(w => (
                                  <option key={w.name} value={w.name}>{w.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select value={editFormData.status} onChange={(e) => handleEditFormChange(e, 'status')}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={() => handleSaveEdit(item.id)} className="btn-ok">OK</button>
                          <button onClick={handleCancelEdit} className="btn-cancel">X</button>
                          <button onClick={() => setItemToDelete(item)} title="Eliminar Equipo" aria-label="Eliminar equipo" style={{ padding: '6px', background: '#C10015', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {item.image && (
                              <div 
                                className="item-thumbnail-container"
                                onClick={() => handleOpenGallery(item)}
                                title="Ver foto ampliada"
                              >
                                <img src={item.image} alt="Foto" className="item-thumbnail-img" />
                                {item.images && item.images.length > 1 && <span style={{position:'absolute', bottom:0, right:0, background:'rgba(0,0,0,0.7)', color:'white', fontSize:'10px', padding:'2px 4px', fontWeight: 'bold'}} >+{item.images.length-1}</span>}
                                <div className="item-thumbnail-overlay">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </div>
                              </div>
                            )}
                            <span>{item.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.quantity}</td>
                        
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: '500' }}>{item.terminal}</div>
                          {/* ETIQUETA VISUAL DE PROPIEDAD SI ESTÁ PRESTADO */}
                          {item.ownerTerminal && item.ownerTerminal !== item.terminal && (
                            <div style={{ 
                               fontSize: '10px', 
                               color: '#e67e22', 
                               fontWeight: 'bold', 
                               marginTop: '4px', 
                               textTransform: 'uppercase',
                               backgroundColor: '#fdf2e9',
                               padding: '2px 6px',
                               borderRadius: '4px',
                               display: 'inline-block'
                            }}>
                              Prop. de {item.ownerTerminal}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px' }}>
                          <div>{item.area}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                            backgroundColor: badgeStyle(item.status).bg,
                            color: badgeStyle(item.status).fg,
                            border: '1px solid transparent'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td className="no-print" style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button onClick={() => handleEditClick(item)} className="btn-edit">
                            EDITAR
                          </button>
                          <button onClick={() => handleCloneItem(item)} title="Duplicar Equipo" aria-label="Duplicar equipo" style={{ padding: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Copy size={16} />
                          </button>
                          <button onClick={() => setHistoryModalItem(item)} title="Ver Historial" aria-label="Ver historial" style={{ padding: '6px', background: '#fff3e0', color: '#ef6c00', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Clock size={16} />
                          </button>
                          <button onClick={() => handleShareAsCard(item)} title="Compartir Ticket" aria-label="Compartir ticket" style={{ padding: '6px', background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Share2 size={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No hay equipos que coincidan con estos filtros.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      
      {/* Modal Añadir Nuevo Equipo */}
      {isAddModalOpen && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px',
          backdropFilter: 'blur(3px)'
        }}>
          <div className="material-card" role="dialog" aria-modal="true" aria-label="Registrar nuevo equipo" style={{ padding: '30px', width: '100%', maxWidth: '500px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>Registrar Nuevo Equipo</h3>
               <button onClick={() => setIsAddModalOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✖</button>
            </div>
            
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Ubicación Física</label>
                  <select value={newItemTerminal} onChange={(e) => setNewItemTerminal(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                    {TERMINAL_OPTIONS.map(terminal => <option key={terminal} value={terminal}>{terminal}</option>)}
                  </select>
                </div>
                {newItemStatus !== 'En Almacén' && (
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Área Operativa</label>
                    <select value={newItemArea} onChange={(e) => setNewItemArea(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                      {getOperationalAreas(newItemTerminal).map(area => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {newItemStatus === 'En Almacén' ? 'Almacén Destino / Asignado' : 'Almacén Base al que Pertenece'}
                </label>
                <select
                  value={newItemWarehouse}
                  onChange={(e) => {
                    setNewItemWarehouse(e.target.value);
                    if (newItemStatus === 'En Almacén') setNewItemArea(e.target.value);
                  }}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  {(WAREHOUSES_DATA[newItemTerminal] || []).map(w => (
                    <option key={w.name} value={w.name}>{w.name} ({w.location})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Nombre del Equipo</label>
                <div className="material-input-group">
                  <input 
                    type="text" 
                    list={newItemName === '' ? "equipment-names" : undefined} 
                    value={newItemName} 
                    onChange={(e) => setNewItemName(e.target.value)} 
                    placeholder="Ej. Separador de Fila" 
                  />
                  <datalist id="equipment-names">
                    {typeSuggestions.map(t => <option key={t} value={t} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Cant.</label>
                  <div className="material-input-group"><input type="number" min="1" value={newItemQuantity} onKeyDown={(e) => { if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault(); }} onChange={(e) => setNewItemQuantity(e.target.value.replace(/[^0-9]/g, ''))} /></div>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Estado Inicial</label>
                  <select value={newItemStatus} onChange={(e) => setNewItemStatus(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                    {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: 'var(--q-dark)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newItemIsFixedAsset} onChange={(e) => setNewItemIsFixedAsset(e.target.checked)} />
                    ¿Activo Fijo?
                  </label>
                </div>
                {newItemIsFixedAsset && (
                  <div style={{ flex: 2 }}>
                    <div className="material-input-group">
                      <input type="text" placeholder="# de Activo" value={newItemAssetNumber} onChange={(e) => setNewItemAssetNumber(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '5px' }}>Fotografía (Opcional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ 
                    cursor: 'pointer', 
                    padding: '8px 12px', 
                    backgroundColor: 'var(--q-secondary)', 
                    border: '1px solid var(--table-border)', 
                    borderRadius: '4px', 
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: 'var(--q-dark)'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                    Adjuntar Foto
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            const compressedBase64 = await compressImage(file);
                            setNewItemImage(compressedBase64);
                          } catch (err) {
                            console.error(err);
                            alert("Error al procesar la imagen");
                          }
                        }
                      }} 
                    />
                  </label>
                  {newItemImage && (
                    <div style={{ position: 'relative' }}>
                      <img src={newItemImage} alt="Preview" style={{ height: '40px', width: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee' }} />
                      <button 
                        type="button" 
                        onClick={() => setNewItemImage(null)}
                        aria-label="Quitar foto"
                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#C10015', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >✖</button>
                    </div>
                  )}
                </div>
              </div>

              <button type="button" onClick={handleAddItem} className="btn-primary" style={{ marginTop: '10px', padding: '14px', width: '100%', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>GUARDAR REGISTRO</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Historial */}
      {historyModalItem && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 3000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' 
        }}>
          <div className="material-card" role="dialog" aria-modal="true" aria-label="Bitácora de auditoría" style={{ padding: '30px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>Bitácora de Auditoría</h3>
               <button onClick={() => setHistoryModalItem(null)} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✖</button>
            </div>
            
            <h4 style={{ color: 'var(--q-accent)', marginTop: 0 }}>{historyModalItem.name}</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Ubicación actual: {historyModalItem.terminal} - {historyModalItem.area} <br/>
              <span style={{color: '#e67e22'}}>Propietario original: {historyModalItem.ownerTerminal || historyModalItem.terminal}</span>
            </p>
            
            <div style={{ borderLeft: '3px solid var(--q-secondary)', paddingLeft: '20px', marginLeft: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {(historyModalItem.history || []).map((log, index) => (
                <div key={index} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-27px', top: '2px', width: '11px', height: '11px', backgroundColor: 'var(--q-accent)', borderRadius: '50%', border: '2px solid white' }}></div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5', color: 'var(--text-main)' }}>{log}</p>
                </div>
              ))}
              {!(historyModalItem.history && historyModalItem.history.length > 0) && (
                 <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No hay registros históricos previos a la actualización V2.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {itemToDelete && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, 
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px',
          backdropFilter: 'blur(3px)'
        }}>
          <div className="material-card" role="alertdialog" aria-modal="true" aria-label="Eliminar registro de equipo" style={{ padding: '30px', width: '100%', maxWidth: '450px', textAlign: 'left', position: 'relative', borderTop: '4px solid #C10015' }}>
            
            <h3 style={{ color: 'var(--q-dark)', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '18px' }}>
              <Trash2 color="#C10015" size={20} />
              Eliminar Registro de Equipo
            </h3>
            
            <p style={{ margin: '0 0 20px 0', lineHeight: '1.5', color: 'var(--text-muted)', fontSize: '14px' }}>
              Estás a punto de eliminar de forma permanente el registro de <b>{itemToDelete.name}</b> asignado a <b>{itemToDelete.terminal}</b>. Esta acción removerá el equipo del inventario actual y su historial.
            </p>
            
            <div style={{ textAlign: 'left', marginBottom: '25px', backgroundColor: 'var(--q-secondary)', padding: '15px', borderRadius: '4px', border: '1px solid var(--table-border)' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--q-dark)' }}>Confirmación de Seguridad</label>
              <p style={{ fontSize: '12px', margin: '5px 0 10px 0', color: 'var(--text-muted)' }}>Para proceder, escribe la palabra <b>CONFIRMO</b> (en mayúsculas) en el siguiente campo:</p>
              <input 
                type="text" 
                placeholder="Escribe CONFIRMO" 
                value={deletePassword} 
                onChange={(e) => setDeletePassword(e.target.value)} 
                onPaste={(e) => e.preventDefault()}
                style={{ width: '100%', outline: 'none', fontFamily: 'monospace', letterSpacing: '1px' }}
                
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn-danger" 
                style={{ flex: 1, opacity: deletePassword.trim() === 'CONFIRMO' ? 1 : 0.5 }}
                disabled={deletePassword.trim() !== 'CONFIRMO'}
                onClick={confirmDelete}
              >
                Eliminar Permanentemente
              </button>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => { setItemToDelete(null); setDeletePassword(''); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      
      {/* Modal Centro de Actividades */}
      {isGlobalLogOpen && (
        <div className="modal-overlay" onClick={() => setIsGlobalLogOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-label="Centro de actividades" style={{ padding: '20px', background: 'var(--card-bg)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '600px', maxWidth: '95vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderBottom: '1px solid var(--q-secondary)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={24} color="var(--q-accent)" />
                <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>Auditoría Global de Actividades</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => {
                  if(!globalLogs || globalLogs.length===0) return alert('No hay logs para exportar');
                  // Mismo formato y protección contra fórmulas que la exportación del inventario
                  downloadCSV(
                    ['Fecha', 'Usuario', 'Acción'],
                    globalLogs.map(l => [formatLogDate(l.date), l.user, l.action]),
                    'auditoria_global.csv'
                  );
                }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Download size={16} /> Exportar
                </button>
                <button onClick={() => setIsGlobalLogOpen(false)} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)' }}>✖</button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '10px' }}>
              {globalLogs && globalLogs.length > 0 ? globalLogs.map(log => (
                <div key={log.id} style={{ padding: '12px', borderLeft: '3px solid var(--q-accent)', background: 'var(--q-primary)', borderRadius: '0 4px 4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{formatLogDate(log.date)}</span>
                    <span style={{ fontSize: '12px', color: 'var(--q-info)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>👤 {log.user}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)' }}>{log.action}</p>
                </div>
              )) : (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '40px 0' }}>No hay actividades registradas en la caja negra.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lectura (Compartido) */}
      {shareCardItem && (
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div ref={shareCardRef} style={{
            width: '400px',
            background: isDarkMode ? '#1e1e1e' : '#ffffff',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: isDarkMode ? '#e0e0e0' : '#333333',
            border: `2px solid ${isDarkMode ? '#333' : '#eee'}`
          }}>
            <div style={{ borderBottom: `1px solid ${isDarkMode ? '#444' : '#eee'}`, paddingBottom: '10px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#2e7d32' }}>Ticket de Búsqueda</h2>
              <span style={{ fontSize: '12px', background: '#e3f2fd', color: '#1565c0', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}>Stock Terminal</span>
            </div>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              {shareCardItem.image ? (
                <img src={shareCardItem.image} alt="Equipo" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ccc' }} />
              ) : (
                <div style={{ width: '120px', height: '120px', background: '#f5f5f5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', border: '1px dashed #ccc' }}>
                  Sin Foto
                </div>
              )}
              
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>{shareCardItem.name}</h3>
                {shareCardItem.isFixedAsset && (
                   <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block', marginBottom: '8px' }}>
                     ACTIVO # {shareCardItem.assetNumber}
                   </span>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  <div style={{ background: isDarkMode ? '#333' : '#f9f9f9', padding: '8px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Ubicación</div>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{shareCardItem.terminal} - {shareCardItem.area}</div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ background: isDarkMode ? '#333' : '#f9f9f9', padding: '8px', borderRadius: '6px', flex: 1 }}>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Cantidad</div>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' }}>{shareCardItem.quantity} ud(s)</div>
                    </div>
                    <div style={{ background: isDarkMode ? '#333' : '#f9f9f9', padding: '8px', borderRadius: '6px', flex: 1 }}>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase' }}>Estado</div>
                      <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{shareCardItem.status}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Visor de Imagen (Amazon Style) */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-label="Fotos del equipo" style={{ padding: '20px', background: 'var(--card-bg)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '400px', maxWidth: '95vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>{selectedImage.name}</h3>
              <button onClick={() => setSelectedImage(null)} aria-label="Cerrar" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)' }}>✖</button>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', height: '100%', overflow: 'hidden' }}>
              {/* Carrusel Izquierdo (Miniaturas) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '10px', width: '80px', flexShrink: 0 }}>
                {selectedImage.images ? selectedImage.images.map((img, idx) => (
                  <div key={idx} onClick={() => setActivePhotoIdx(idx)} style={{ cursor: 'pointer', border: activePhotoIdx === idx ? '2px solid var(--q-accent)' : '1px solid var(--q-secondary)', borderRadius: '4px', padding: '2px', opacity: activePhotoIdx === idx ? 1 : 0.6, transition: 'all 0.2s' }}>
                    <img src={img.data} alt="thumb" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '2px', display: 'block' }} />
                  </div>
                )) : (
                  <div style={{ cursor: 'pointer', border: '2px solid var(--q-accent)', borderRadius: '4px', padding: '2px' }}>
                    <img src={selectedImage.image} alt="thumb" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '2px', display: 'block' }} />
                  </div>
                )}
              </div>
              
              {/* Imagen Principal */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: '4px', padding: '10px', position: 'relative', minHeight: '300px' }}>
                 <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                   <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: 'var(--q-dark)', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                     Estado: <span style={{ color: 'var(--q-accent)' }}>{selectedImage.images ? selectedImage.images[activePhotoIdx].status : selectedImage.status}</span>
                     {selectedImage.images && selectedImage.images[activePhotoIdx].date && <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '12px', marginLeft: '5px' }}>({selectedImage.images[activePhotoIdx].date})</span>}
                   </p>
                 </div>
                 
                 <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   <button 
                     onClick={() => handleDeletePhoto(selectedImage.images ? selectedImage.images[activePhotoIdx].data : selectedImage.image)}
                     style={{ background: 'var(--q-negative)', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                     title="Eliminar Foto"
                     aria-label="Eliminar foto"
                   >
                     <Trash2 size={16} />
                   </button>
                   <label 
                     style={{ background: 'var(--q-info)', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                     title="Cambiar Foto"
                   >
                     <RefreshCw size={16} />
                     <input type="file" accept="image/*" aria-label="Cambiar foto" style={{ display: 'none' }} onChange={(e) => handleReplacePhoto(e, selectedImage.images ? selectedImage.images[activePhotoIdx].data : selectedImage.image)} />
                   </label>
                 </div>
                 <img src={selectedImage.images ? selectedImage.images[activePhotoIdx].data : selectedImage.image} alt="Ampliada" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
