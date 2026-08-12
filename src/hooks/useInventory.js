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
          setInventory(storedInventory);
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
