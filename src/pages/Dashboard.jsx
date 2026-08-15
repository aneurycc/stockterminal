import html2canvas from 'html2canvas';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trash2, Clock, Upload, Copy, Plus, Moon, Sun, Package, Camera, RefreshCw, Activity, ChevronDown , Share2, Download } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import * as XLSX from 'xlsx';
import KPICards from '../components/KPICards';

const nowString = () => new Date().toLocaleString();

// Datos iniciales vaciados por instrucción de producción
const initialInventory = [];

// NOTA: Se ha eliminado "Prestado" porque ahora es una relación estructural (owner !== terminal)
const STATUS_OPTIONS = ['En uso', 'En Almacén', 'Inhabilitado', 'Decomisado', 'En reparación', 'En proceso de decomiso'];
const TERMINAL_OPTIONS = ['Terminal A', 'Terminal B', 'Terminal B2'];
const AREAS_A = ['Check-in Terminal A', 'Check Point TA', 'Migración Salidas TA', 'Sala de embarque A1', 'Sala de embarque A2', 'Food Court TA', 'Pasillo Llegadas', 'Sala Migración Llegadas', 'Migración Llegadas TA', 'Reclamo de equipajes TA', 'Aduanas TA', 'Área comercial (tienda) TA', 'Oficina TA', 'Pasillo TA', 'Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5', 'Gate 6', 'Gate 7', 'Gate 8', 'Gate 9', 'Gate 10', 'Gate 11', 'Gate 12', 'Gate 13', 'Gate 14', 'Gate 15', 'Gate 16', 'Paxer TA'];
const AREAS_B = ['Correas de check in 1 y 2', 'Correas de check in 3 y 4', 'Check Point TB', 'Migración Salidas TB', 'Sala de embarque B1', 'Food Court TB', 'Pasillo Llegadas', 'Sala Migración Llegadas', 'Migración Llegadas TB', 'Reclamo de equipajes 11-13', 'Reclamo de equipajes 14-18', 'Aduanas TB', 'Área comercial (tienda) TB', 'Oficina TB', 'Pasillo TB', 'Gate 20', 'Gate 21', 'Gate 22', 'Gate 23', 'Gate 24', 'Gate 25', 'Gate 26', 'Gate 26F', 'Security Gate TB'];
const AREAS_B2 = ['Food Court TB2', 'Migración Llegadas TB2', 'Oficina', 'Gate 27', 'Gate 28', 'Gate 29', 'Gate 30', 'Gate 31'];
const AREAS_GENERAL = [...new Set([...AREAS_A, ...AREAS_B, ...AREAS_B2])];

const getAreasForTerminal = (term) => {
  if (term === 'Terminal A') return AREAS_A;
  if (term === 'Terminal B') return AREAS_B;
  if (term === 'Terminal B2') return AREAS_B2;
  return AREAS_GENERAL;
};

// Colores Semánticos GPC Material
const STATUS_COLORS = { 'En uso': '#21BA45', 'En Almacén': '#3498db', 'Inhabilitado': '#e74c3c', 'Decomisado': '#7f8c8d', 'Por decomisar': '#f1c40f', 'En reparación': '#9b59b6', 'Terminal A': '#1abc9c', 'Terminal B': '#e67e22', 'Terminal B2': '#9b59b6' };

const Dashboard = ({ onLogout }) => {
  const { inventory, saveInventory: setInventory, isLoading, globalLogs, addGlobalLog } = useInventory();
  const currentUser = localStorage.getItem('gpc_user') || 'Sistema';
  const [isGlobalLogOpen, setIsGlobalLogOpen] = useState(false);

  
  const [filterTerminal, setFilterTerminal] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterType, setFilterType] = useState('Todos');
  const [filterIsProperty, setFilterIsProperty] = useState(false);
  const [colFilterEquipo, setColFilterEquipo] = useState('Todos');
  const [colFilterArea, setColFilterArea] = useState('Todas');
  const [colFilterEstado, setColFilterEstado] = useState('Todos');
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
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (viewId) {
      const itemToView = inventory.find(i => i.id === viewId);
      if (itemToView) setShareItemView(itemToView);
    }
  }, [inventory]);

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
  const [newItemOwner, setNewItemOwner] = useState(TERMINAL_OPTIONS[0]);
  const [newItemArea, setNewItemArea] = useState(AREAS_GENERAL[0]);
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
  const [filterOwner, setFilterOwner] = useState('Todos');
  const [shareItemView, setShareItemView] = useState(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [shareCardItem, setShareCardItem] = useState(null);
  const shareCardRef = useRef(null);

  const handleShareAsCard = async (item) => {
    setShareCardItem(item);
    setIsGeneratingCard(true);
    
    // Give react time to render the hidden card
    setTimeout(async () => {
      if (shareCardRef.current) {
        try {
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
          const MAX_WIDTH = 1600; // Incrementado drásticamente para máxima calidad
          const MAX_HEIGHT = 1600;
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
          resolve(canvas.toDataURL('image/jpeg', 0.90)); // 90% de calidad JPEG
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  
  // Inyección de Data Ficticia para pruebas
  useEffect(() => {
    if (!isLoading && inventory.length === 0) {
      const now = nowString();
      
          }
  }, [isLoading, inventory.length]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(inventory.map(item => item.name));
    return ['Todos', ...Array.from(types)];
  }, [inventory]);

  const typeSuggestions = useMemo(() => Array.from(new Set(inventory.map(i => i.name))), [inventory]);

  useEffect(() => {
    const allowedAreas = getAreasForTerminal(newItemTerminal);
    if (!allowedAreas.includes(newItemArea)) {
        setNewItemArea(allowedAreas[0]);
    }
  }, [newItemTerminal, newItemStatus]);
  
  useEffect(() => {
    // When editing, also validate area
    if (editFormData && editFormData.terminal) {
       const allowedAreas = getAreasForTerminal(editFormData.terminal);
       if (!allowedAreas.includes(editFormData.area)) {
          setEditFormData({...editFormData, area: allowedAreas[0]});
       }
    }
  }, [editFormData?.terminal, editFormData?.status]);

  
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm(`¿Estás seguro que deseas cargar el inventario desde el archivo "${file.name}"? Esto agregará los equipos al sistema.`)) {
      e.target.value = null; // reset input
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let newItems = [];
        let skippedCount = 0;
        let validAreas = getAvailableAreas('Terminal A'); // Default fallback
        
        data.forEach((row, index) => {
          const terminal = row['Terminal'] || row['terminal'] || 'Terminal A';
          const areaOptions = getAvailableAreas(terminal);
          const rawArea = row['Area'] || row['area'] || row['Área'] || row['área'];
          const area = areaOptions.includes(rawArea) ? rawArea : areaOptions[0];
          const status = row['Estado'] || row['estado'] || 'En uso';
          const assetNum = (row['Activo Fijo'] || row['Activo'] || row['activo'] || row['activo fijo'] || '').toString().trim();
          const type = row['Tipo'] || row['tipo'] || 'Sistemas';

          // Validación de duplicado de Activo Fijo
          if (assetNum.length > 0) {
            const isDuplicate = inventory.some(i => i.isFixedAsset && i.assetNumber.toLowerCase() === assetNum.toLowerCase());
            if (isDuplicate) {
              skippedCount++;
              return; // Skip this row
            }
          }
          
          newItems.push({
            id: Date.now().toString() + Math.random().toString() + index,
            name: row['Nombre'] || row['nombre'] || 'Equipo Genérico',
            quantity: parseInt(row['Cantidad'] || row['cantidad']) || 1,
            type: type,
            isFixedAsset: assetNum.length > 0,
            assetNumber: assetNum,
            terminal: terminal,
            ownerTerminal: row['Propietario'] || row['propietario'] || terminal,
            area: area,
            status: status,
            history: [`[${nowString()}] Importado desde Excel`]
          });
        });

        if (newItems.length > 0) {
           saveInventory([...inventory, ...newItems]);
           let successMsg = `Importación masiva: Se cargaron ${newItems.length} equipos desde Excel.`;
           if (skippedCount > 0) successMsg += ` (Se omitieron ${skippedCount} equipos por tener Activo Fijo duplicado).`;
           addGlobalLog(currentUser, successMsg);
           
           let alertMsg = `Excel cargado exitosamente.\n✅ Se agregaron ${newItems.length} equipos.`;
           if (skippedCount > 0) alertMsg += `\n⚠️ Se omitieron ${skippedCount} equipos porque su número de Activo Fijo ya existe en el inventario.`;
           alert(alertMsg);
        } else {
           if (skippedCount > 0) {
             alert(`No se agregó ningún equipo. Se omitieron ${skippedCount} equipos porque sus números de Activo Fijo ya existen en el sistema.`);
           } else {
             alert("El archivo no contenía datos válidos.");
           }
        }
      } catch (err) {
        console.error(err);
        alert("Error al procesar el archivo Excel. Revisa el formato.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // reset input
  };


  const handleAddItem = (e) => {
    e.preventDefault();
    const qty = parseInt(newItemQuantity, 10);
    if (!newItemName.trim() || isNaN(qty) || qty < 1) {
      alert("Por favor, ingrese un nombre válido y una cantidad mayor a 0.");
      return;
    }

    if (newItemIsFixedAsset && newItemAssetNumber?.trim()) {
      const duplicate = inventory.find(i => i.isFixedAsset && i.assetNumber === newItemAssetNumber.trim());
      if (duplicate) {
        alert("Error: Ya existe otro equipo registrado con el mismo número de Activo Fijo (" + duplicate.name + ").");
        return;
      }
    }

    const now = nowString();
    let remainingToDeduct = qty;
    let newInventory = [...inventory];
    let autoDeductedLogs = [];

    // AUTO-DEDUCCIÓN DE ALMACÉN
    if (newItemStatus !== 'En Almacén') {
      newInventory = newInventory.map(item => {
        if (remainingToDeduct > 0 && item.name === newItemName.trim() && item.terminal === newItemTerminal && item.status === 'En Almacén') {
          if (item.quantity >= remainingToDeduct) {
            item.quantity -= remainingToDeduct;
            item.history = [...(item.history || []), `[${now}] Deducción automática: -${remainingToDeduct} unidades enviadas a "${newItemArea}" en estado "${newItemStatus}".`];
            autoDeductedLogs.push(`[${now}] ${remainingToDeduct} unidades fueron deducidas automáticamente del stock en almacén.`);
            remainingToDeduct = 0;
            return item;
          } else {
            const deducted = item.quantity;
            remainingToDeduct -= deducted;
            item.quantity = 0;
            item.history = [...(item.history || []), `[${now}] Deducción automática: -${deducted} unidades enviadas a "${newItemArea}". (Stock agotado)`];
            autoDeductedLogs.push(`[${now}] ${deducted} unidades deducidas automáticamente del almacén (Stock agotado).`);
            return item;
          }
        }
        return item;
      }).filter(item => item.quantity > 0);
    }

    const createdFromScratch = remainingToDeduct;
    if (createdFromScratch > 0 && newItemStatus !== 'En Almacén') {
       autoDeductedLogs.push(`[${now}] ${createdFromScratch} unidades registradas como stock nuevo (No provenientes de almacén).`);
    }

    const newItem = {
      id: Date.now(),
      name: newItemName.trim(),
      status: newItemStatus,
      terminal: newItemTerminal,
      ownerTerminal: newItemOwner,
      owner: newItemTerminal,
      area: newItemArea,
      isFixedAsset: newItemIsFixedAsset,
      assetNumber: newItemIsFixedAsset ? newItemAssetNumber : '',
      quantity: qty,
      image: newItemImage,
      history: [`[${now}] Equipo Registrado. Estado Inicial: ${newItemStatus}. Cantidad: ${qty}.`, ...autoDeductedLogs]
    };

    setInventory([...newInventory, newItem]);
    addGlobalLog(currentUser, `Creado equipo nuevo: ${newItem.name} (Cant: ${newItem.quantity}, Terminal: ${newItem.terminal})`);
    setNewItemName(''); 
    setNewItemQuantity(1);
    setNewItemImage(null);
    setNewItemIsFixedAsset(false);
    setNewItemAssetNumber('');
    setIsAddModalOpen(false); 
  };

  const handleEditClick = (item) => {
    // Si estábamos editando otro item que era un borrador sin guardar (clon), lo eliminamos
    if (editingId && editingId !== item.id) {
      const prevEditingItem = inventory.find(i => i.id === editingId);
      if (prevEditingItem && prevEditingItem.isDraft) {
        setInventory(prev => prev.filter(i => i.id !== editingId));
      }
    }
    setEditingId(item.id);
    setEditFormData({ ...item });
    setEditNewImage(null);
  };
  
  const handleCancelEdit = () => {
    const currentItem = inventory.find(i => i.id === editingId);
    if (currentItem && currentItem.isDraft) {
      setInventory(inventory.filter(i => i.id !== editingId));
    }
    setEditingId(null);
    setEditNewImage(null);
  };
  
  const handleSaveEdit = (id) => {
    const parsedQty = parseInt(editFormData.quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 1 || !editFormData.name?.trim()) {
      alert("Error: Nombre inválido o cantidad menor a 1.");
      return;
    }

    if (editFormData.isFixedAsset && editFormData.assetNumber?.trim()) {
      const duplicate = inventory.find(i => i.id !== id && i.isFixedAsset && i.assetNumber === editFormData.assetNumber.trim());
      if (duplicate) {
        alert("Error: Ya existe otro equipo registrado con el mismo número de Activo Fijo (" + duplicate.name + ").");
        return;
      }
    }

    const finalArea = editFormData.area;

    const original = inventory.find(i => i.id === id);
    
    // VALIDATION: Prevent uploading duplicate photo for the same status
    if (editNewImage) {
      let existingImages = original.images || [];
      if (original.image && !existingImages.find(img => img.data === original.image)) {
        existingImages = [{ data: original.image, status: original.status }];
      }
      
      const duplicateStatusImage = existingImages.find(img => img.status === editFormData.status);
      if (duplicateStatusImage) {
         alert("Ya existe una foto para este estado. Cambie el estado o elimine la foto anterior desde la galería.");
         return;
      }
    }

    const qtyDelta = original.quantity - parsedQty;
    const now = nowString();

    let historyLog = `[${now}] Editado. `;
    if (original.status !== editFormData.status) historyLog += `Estado cambió de "${original.status}" a "${editFormData.status}". `;
    
    // CORRECCIÓN TYPO PROPIETARIO: Si cambia de terminal y solo tiene 1 registro histórico (el inicial), fue un error de registro.
    let newOwner = original.owner;
    if (original.terminal !== editFormData.terminal) {
       if (original.history && original.history.length === 1 && original.owner === original.terminal) {
         newOwner = editFormData.terminal;
         historyLog += `Corrección de registro: Transferido permanentemente a ${editFormData.terminal}. `;
       } else {
         historyLog += `Trasladado físicamente a ${editFormData.terminal} (Mantiene propiedad original de ${original.owner}). `;
       }
    }

    if (qtyDelta > 0 && !original.isDraft) {
      // ERP Splitting Logic
      
      let parentImages = original.images || [];
      if (original.image && !parentImages.find(img => img.data === original.image)) {
        parentImages = [{ data: original.image, status: original.status, date: 'Registro Original' }];
      }
      
      const parentRemain = {
        ...original,
        quantity: qtyDelta,
        images: parentImages.length > 0 ? parentImages : undefined,
        history: [...(original.history || []), `[${now}] Fraccionamiento: ${parsedQty} unidad(es) extraídas y asignadas como "${editFormData.status}". Restan ${qtyDelta}.`]
      };

      
      let childImages = parentImages.map(img => ({...img})); // clone
      if (editNewImage) {
        childImages.push({ data: editNewImage, status: editFormData.status, date: now });
      }

      const childSpawn = {
        ...editFormData,
        owner: newOwner,
        area: finalArea,
        id: Date.now(),
        name: editFormData.name.trim(),
        isFixedAsset: editFormData.isFixedAsset,
        assetNumber: editFormData.isFixedAsset ? editFormData.assetNumber : '',
        quantity: parsedQty,
        image: editNewImage || original.image,
        images: childImages.length > 0 ? childImages : undefined,
        history: [...(original.history || []), `[${now}] Creado por fraccionamiento de lote original (Cant: ${parsedQty}).`]
      };
      
      delete childSpawn.isDraft; 
      setInventory(inventory.map(i => i.id === id ? parentRemain : i).concat(childSpawn));
      addGlobalLog(currentUser, `Fraccionamiento de equipo: ${original.name}. Se extrajeron ${parsedQty} unidades hacia ${editFormData.status}.`);
    } else {
      if (qtyDelta < 0 && !original.isDraft) historyLog += `Cantidad incrementada de ${original.quantity} a ${parsedQty}.`;
      
      
      let imagesArray = original.images || [];
      if (original.image && !imagesArray.find(img => img.data === original.image)) {
        imagesArray = [{ data: original.image, status: original.status, date: 'Registro Original' }];
      }
      if (editNewImage) {
        imagesArray = [...imagesArray, { data: editNewImage, status: editFormData.status, date: now }];
        historyLog += '[Nueva Foto Adjunta] ';
      }

      const updated = {
        ...editFormData,
        owner: newOwner,
        area: finalArea,
        name: editFormData.name.trim(),
        isFixedAsset: editFormData.isFixedAsset,
        assetNumber: editFormData.isFixedAsset ? editFormData.assetNumber : '',
        quantity: parsedQty,
        image: editNewImage || original.image,
        images: imagesArray.length > 0 ? imagesArray : undefined,
        history: [...(original.history || []), historyLog]
      };
      
      delete updated.isDraft; 
      setInventory(inventory.map(i => i.id === id ? updated : i));
      addGlobalLog(currentUser, `Editado equipo: ${updated.name}. ${historyLog}`);
    }
    setEditingId(null);
  };

  const confirmDelete = () => {
    if (deletePassword.trim() === 'CONFIRMO') {
      const updatedInventory = inventory.filter(i => i.id !== itemToDelete.id);
      setInventory(updatedInventory);
    addGlobalLog(currentUser, `Eliminada fotografía del equipo: ${selectedImage.name}`);
      setItemToDelete(null);
      setDeletePassword('');
      setEditingId(null);
    } else {
      alert('Debes escribir CONFIRMO (en mayúsculas) para eliminar.');
    }
  };

  const exportToCSV = () => {
    if (filteredInventory.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    const headers = ["Equipo", "Cantidad", "Ubicación", "Área", "Estado", "Propietario"];
    const rows = filteredInventory.map(item => [
      `"${item.name.replace(/"/g, '""')}"`,
      item.quantity,
      `"${item.terminal}"`,
      `"${item.area}"`,
      `"${item.status}"`,
      `"${(item.ownerTerminal || item.terminal).replace(/"/g, '""')}"`
    ]);
    
    // Usamos punto y coma (;) porque Excel en español no reconoce la coma por defecto
    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    
    // Añadimos el BOM (\uFEFF) para que Excel reconozca los acentos (UTF-8)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventario_GPC_${nowString().replace(/[\/ :,]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    setInventory([...inventory, cloned]);
    handleEditClick(cloned); 
  };

  const handleEditFormChange = (e, field) => {
    const val = e.target.value;
    setEditFormData(prev => {
      let updated = { ...prev, [field]: val };
      if (field === 'terminal' && val === 'Terminal B2' && updated.status !== 'En Almacén') updated.area = 'ML';
      
      if (field === 'status' && prev.status === 'En Almacén' && val !== 'En Almacén') updated.area = getAvailableAreas(updated.terminal)[0];
      return updated;
    });
  };
  const getAvailableAreas = (terminal) => {
    if (terminal === 'Terminal A') return AREAS_A;
    if (terminal === 'Terminal B') return AREAS_B;
    if (terminal === 'Terminal B2') return AREAS_B2;
    return AREAS_GENERAL;
  };

  // Filtrado de inventario para la vista principal
  const chartInventory = inventory.filter(item => {
    let matchTerminal = filterTerminal === 'Todas' ? true : item.terminal === filterTerminal;
    if (filterIsProperty && filterTerminal !== 'Todas') {
       matchTerminal = item.ownerTerminal === filterTerminal && item.terminal !== filterTerminal;
    }
    const matchStatus = filterStatus === 'Todos' ? true : item.status === filterStatus;
    const matchType = filterType === 'Todos' ? true : item.name === filterType;
    return matchTerminal && matchStatus && matchType;
  });

  const filteredInventory = inventory.filter(item => {
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
  });

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

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getChartData = () => {
    let dataMap = {};
    if (filterTerminal === 'Todas') {
      chartInventory.forEach(item => { dataMap[item.terminal] = (dataMap[item.terminal] || 0) + item.quantity; });
    } else {
      chartInventory.forEach(item => { 
        dataMap[item.status] = (dataMap[item.status] || 0) + item.quantity; 
      });
    }
    return Object.keys(dataMap).map(key => ({ name: key, value: dataMap[key] }));
  };

  const chartData = getChartData();

  // KPIs
  // Excluimos "Decomisado" del cálculo total real para no inflar métricas con basura
  const totalItems = filteredInventory.filter(i => i.status !== 'Decomisado').reduce((acc, curr) => acc + curr.quantity, 0);
  const tableTotalItems = filteredInventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const operativosItems = filteredInventory.filter(i => i.status.startsWith('En uso')).reduce((acc, curr) => acc + curr.quantity, 0);
  const danadosItems = filteredInventory.filter(i => i.status.startsWith('Inhabilitado')).reduce((acc, curr) => acc + curr.quantity, 0);
  
  // KPI de Préstamos: ¿Cuántos equipos PROPIEDAD de la terminal actual (filtro) están ubicados físicamente en otra terminal?
  // Esto analiza todo el inventario base, no el inventario filtrado, para detectar equipos que salieron de su frontera.
  const prestadosItems = inventory.filter(i => {
    const isOwnedByFilter = filterTerminal === 'Todas' ? true : i.owner === filterTerminal;
    const isLoanedOut = i.owner && i.owner !== i.terminal; // Si la terminal actual es diferente al dueño, está prestado.
    return isOwnedByFilter && isLoanedOut;
  }).reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div style={{ padding: '80px 20px 60px 20px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }} className="dashboard-container">
      
      <nav className="top-nav no-print" style={{ width: '100%', boxSizing: 'border-box', left: 0 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', width: '100%', boxSizing: 'border-box' }}>
          <div className="top-nav-group-logo" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/logo-app.png" alt="Logo" style={{ height: '48px', objectFit: 'contain' }} />
            <h2 style={{ margin: 0, color: 'var(--q-accent)', fontWeight: 900 }}>Stock <span style={{ color: 'var(--text-main)', fontWeight: 300 }}>Terminal</span></h2>
          </div>
          <div className="top-nav-group-actions" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="dark-mode-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--q-dark)', display: 'flex', alignItems: 'center' }} title="Alternar Modo Oscuro">
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

      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

        {/* Google Maps Embed */}
        <div className="material-card no-print" style={{ height: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--q-secondary)', border: '2px dashed var(--table-border)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <h2 style={{ color: 'var(--q-dark)', margin: '0 0 8px 0', fontSize: '24px' }}>Coming Soon</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '16px' }}>Módulo de Almacenes en desarrollo</p>
        </div>
      </div>

      {/* Panel Principal: Tabla */}
        <div className="material-card" style={{ padding: '20px' }}>
          <div className="table-header-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: 'var(--q-dark)', margin: 0 }}>
              Detalle de Inventario ({tableTotalItems} unidades)
            </h3>
            <div style={{ display: 'flex', gap: '10px' }} className="no-print">
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
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500' }}>Equipo</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500' }}>Cant.</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500' }}>Ubicación</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500' }}>Área</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '500' }}>Estado</th>
                  <th className="no-print" style={{ padding: '12px', textAlign: 'center', fontWeight: '500', minWidth: '150px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    {editingId === item.id ? (
                      <>
                        <td style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            <label style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--q-secondary)', borderRadius: '4px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Adjuntar nueva foto para este estado">
                              <Camera size={16} color="var(--text-muted)" />
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                 const f = e.target.files[0];
                                 if (f) {
                                   try {
                                     setEditNewImage(await compressImage(f));
                                   } catch(err){ alert("Error"); }
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
                        <td style={{ padding: '8px' }}><input type="number" min="1" max={item.quantity} value={editFormData.quantity} onChange={(e) => handleEditFormChange(e, 'quantity')} style={{ width: '50px', padding: '4px' }} title={`Fraccionar lote. Original: ${item.quantity}`} /></td>
                        <td style={{ padding: '8px' }}>
                          {/* Cambiar de terminal ahora significa trasladarlo/prestarlo */}
                          <select value={editFormData.terminal} onChange={(e) => { handleEditFormChange(e, 'terminal'); if (e.target.value === 'Terminal B2') setEditFormData(prev => ({ ...prev, terminal: e.target.value, area: 'ML' })); }}>
                            {TERMINAL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select value={editFormData.area} onChange={(e) => handleEditFormChange(e, 'area')}  style={{ opacity: editFormData.status === 'En Almacén' ? 0.5 : 1 }}>
                            {getAvailableAreas(editFormData.terminal).map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <select value={editFormData.status} onChange={(e) => handleEditFormChange(e, 'status')}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={() => handleSaveEdit(item.id)} className="btn-ok">OK</button>
                          <button onClick={handleCancelEdit} className="btn-cancel">X</button>
                          <button onClick={() => setItemToDelete(item)} style={{ padding: '6px', background: '#C10015', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
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

                        <td style={{ padding: '12px' }}>{item.area}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500',
                            backgroundColor: item.status.startsWith('En uso') ? '#E8F5E9' : 
                                             item.status.startsWith('Dañado') ? '#FFEBEE' :
                                             item.status.startsWith('Decomisado') ? '#F5F5F5' : '#FFF8E1',
                            color: item.status.startsWith('En uso') ? '#2E7D32' : 
                                   item.status.startsWith('Dañado') ? '#C62828' :
                                   item.status.startsWith('Decomisado') ? '#616161' : '#F57F17',
                            border: '1px solid transparent'
                          }}>
                            {item.status}
                          </span>
                        </td>
                        <td className="no-print" style={{ padding: '12px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                          <button onClick={() => handleEditClick(item)} className="btn-edit">
                            EDITAR
                          </button>
                          <button onClick={() => handleCloneItem(item)} title="Duplicar Equipo" style={{ padding: '6px', background: '#e3f2fd', color: '#1565c0', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Copy size={16} />
                          </button>
                          <button onClick={() => setHistoryModalItem(item)} title="Ver Historial" style={{ padding: '6px', background: '#fff3e0', color: '#ef6c00', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Clock size={16} />
                          </button>
                          <button onClick={() => handleShareAsCard(item)} title="Compartir Ticket" style={{ padding: '6px', background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Share2 size={16} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
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
          <div className="material-card" style={{ padding: '30px', width: '100%', maxWidth: '500px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>Registrar Nuevo Equipo</h3>
               <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✖</button>
            </div>
            
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Ubicación Física</label>
                  <select value={newItemTerminal} onChange={(e) => setNewItemTerminal(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                    {TERMINAL_OPTIONS.map(terminal => <option key={terminal} value={terminal}>{terminal}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>Área</label>
                  <select value={newItemArea} onChange={(e) => setNewItemArea(e.target.value)}  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', opacity: newItemStatus === 'En Almacén' ? 0.5 : 1 }}>
                    {getAvailableAreas(newItemTerminal).map(area => <option key={area} value={area}>{area}</option>)}
                  </select>
                </div>
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
                  <div className="material-input-group"><input type="number" min="1" value={newItemQuantity} onChange={(e) => setNewItemQuantity(e.target.value)} /></div>
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
                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#C10015', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >✖</button>
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '10px', padding: '12px' }}>GUARDAR REGISTRO</button>
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
          <div className="material-card" style={{ padding: '30px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>Bitácora de Auditoría</h3>
               <button onClick={() => setHistoryModalItem(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#999' }}>✖</button>
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
          <div className="material-card" style={{ padding: '30px', width: '100%', maxWidth: '450px', textAlign: 'left', position: 'relative', borderTop: '4px solid #C10015' }}>
            
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
                placeholder="CONFIRMO"
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
          <div className="modal-content" style={{ padding: '20px', background: 'var(--card-bg)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '600px', maxWidth: '95vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', borderBottom: '1px solid var(--q-secondary)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={24} color="var(--q-accent)" />
                <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>Auditoría Global de Actividades</h3>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => {
                  if(!globalLogs || globalLogs.length===0) return alert('No hay logs para exportar');
                  const headers = ['Fecha', 'Usuario', 'Acción'];
                  const csvRows = [headers.join(',')];
                  globalLogs.forEach(l => csvRows.push(`"${l.date}","${l.user}","${l.action.replace(/"/g, '""')}"`));
                  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'auditoria_global.csv'; a.click();
                }} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Download size={16} /> Exportar
                </button>
                <button onClick={() => setIsGlobalLogOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)' }}>✖</button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '10px' }}>
              {globalLogs && globalLogs.length > 0 ? globalLogs.map(log => (
                <div key={log.id} style={{ padding: '12px', borderLeft: '3px solid var(--q-accent)', background: 'var(--q-primary)', borderRadius: '0 4px 4px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold' }}>{log.date}</span>
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
      
      {shareItemView && (
        <div className="modal-overlay" style={{ background: 'rgba(255,255,255,0.95)' }}>
          <div className="material-card" style={{ padding: '30px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
            <button onClick={() => setShareItemView(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '24px', color: 'var(--text-muted)' }}>✖</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '2px solid var(--q-secondary)', paddingBottom: '20px' }}>
              <img src="/logo-app.png" alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
              <div>
                <h2 style={{ margin: 0, color: 'var(--q-dark)' }}>Ficha de Equipo</h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>ID: {shareItemView.id}</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '20px' }}>
              {shareItemView.image ? (
                <img src={shareItemView.image} alt="Equipo" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #eee' }} />
              ) : (
                <div style={{ width: '150px', height: '150px', background: '#f5f5f5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>Sin foto</div>
              )}
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '24px', color: 'var(--q-accent)' }}>{shareItemView.name}</h3>
                {shareItemView.isFixedAsset && (
                  <span style={{ background: 'var(--q-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block', alignSelf: 'flex-start' }}>ACTIVO # {shareItemView.assetNumber}</span>
                )}
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ubicación</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{shareItemView.terminal}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{shareItemView.area}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Estado</label>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--q-info)' }}>{shareItemView.status}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Propiedad de</label>
                    <div style={{ fontSize: '15px', fontWeight: '500' }}>{shareItemView.ownerTerminal || shareItemView.terminal}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '20px' }}>Vista generada por Stock Terminal - Acceso de Sólo Lectura</p>
          </div>
        </div>
      )}

      {/* Modal Visor de Imagen (Amazon Style) */}
      {selectedImage && (
        <div className="modal-overlay" onClick={() => setSelectedImage(null)}>
          <div className="modal-content" style={{ padding: '20px', background: 'var(--card-bg)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '400px', maxWidth: '95vw', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--q-dark)' }}>{selectedImage.name}</h3>
              <button onClick={() => setSelectedImage(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)' }}>✖</button>
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
                   {!(selectedImage.images ? selectedImage.images[activePhotoIdx].date === 'Registro Original' : true) && (
                     <button 
                       onClick={() => handleDeletePhoto(selectedImage.images ? selectedImage.images[activePhotoIdx].data : selectedImage.image)}
                       style={{ background: 'var(--q-negative)', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                       title="Eliminar Foto"
                     >
                       <Trash2 size={16} />
                     </button>
                   )}
                   <label 
                     style={{ background: 'var(--q-info)', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                     title="Cambiar Foto"
                   >
                     <RefreshCw size={16} />
                     <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleReplacePhoto(e, selectedImage.images ? selectedImage.images[activePhotoIdx].data : selectedImage.image)} />
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
