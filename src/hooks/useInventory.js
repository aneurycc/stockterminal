import { useState, useEffect } from 'react';
import localforage from 'localforage';

localforage.config({
  name: 'StockTerminalGPC',
  storeName: 'inventory_store'
});

export function useInventory() {
  const [inventory, setInventory] = useState([]);
  const [globalLogs, setGlobalLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and migrate data from localStorage to localforage
  useEffect(() => {
    const initStorage = async () => {
      try {
        const storedInventory = await localforage.getItem('gpc_inventory');
        
        const storedLogs = await localforage.getItem('gpc_global_logs');
        if (storedLogs) setGlobalLogs(storedLogs);
        
        if (storedInventory) {
          // Migration: 'Dañado' -> 'Inhabilitado' and add ownerTerminal
          let migrated = false;
          const newInv = storedInventory.map(item => {
            let changed = false;
            let newItem = { ...item };
            if (newItem.status === 'Dañado') { newItem.status = 'Inhabilitado'; changed = true; }
            if (!newItem.ownerTerminal) { newItem.ownerTerminal = newItem.terminal; changed = true; }
            if (newItem.area === 'N/A') {
              // Migration to remove N/A
              newItem.area = newItem.terminal === 'Terminal B2' ? 'Gate 27' : 'Gate 1';
              changed = true;
            }
            if (changed) migrated = true;
            return newItem;
          });
          if (migrated) {
            localforage.setItem('gpc_inventory', newInv);
            setInventory(newInv);
          } else {
            setInventory(storedInventory);
          }
        } else {

          // Check if there is data in localStorage to migrate (Legacy)
          const legacyData = localStorage.getItem('gpc_inventory');
          if (legacyData) {
            console.log("Migrating data from localStorage to IndexedDB...");
            const parsed = JSON.parse(legacyData);
            await localforage.setItem('gpc_inventory', parsed);
            setInventory(parsed);
          }
        }
      } catch (err) {
        console.error("Error accessing IndexedDB", err);
      } finally {
        setIsLoading(false);
      }
    };

    initStorage();
  }, []);

  const saveInventory = async (newInventory) => {
    setInventory(newInventory);
    try {
      await localforage.setItem('gpc_inventory', newInventory);
    } catch (err) {
      console.error("Error saving to IndexedDB", err);
    }
  };

  
  const addGlobalLog = async (user, action) => {
    const newLog = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      user: user,
      action: action
    };
    // Use functional state update to ensure latest state
    setGlobalLogs(prev => {
      const updated = [newLog, ...prev];
      localforage.setItem('gpc_global_logs', updated).catch(console.error);
      return updated;
    });
  };

  return { inventory, saveInventory, isLoading, globalLogs, addGlobalLog };

}
