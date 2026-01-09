import { supabase } from './supabase';

// Helper functions for Queue
const getQueue = () => JSON.parse(localStorage.getItem('offlineQueue')) || [];
const setQueue = (data) => localStorage.setItem('offlineQueue', JSON.stringify(data));

// Main Action Function
export const handleLibraryAction = async (table, action, data, onSuccess) => {
  if (navigator.onLine) {
    try {
      let error;
      if (action === 'INSERT') {
        const { error: err } = await supabase.from(table).insert([data]);
        error = err;
      } else if (action === 'UPDATE') {
        const { error: err } = await supabase.from(table).update(data).eq('id', data.id);
        error = err;
      } else if (action === 'DELETE') {
        const { error: err } = await supabase.from(table).delete().eq('id', data.id);
        error = err;
      }

      if (error) throw error;
      if (onSuccess) onSuccess();
      
    } catch (err) {
      alert("Action Failed: " + err.message);
    }
  } else {
    // Offline Logic
    const queue = getQueue();
    queue.push({ table, action, data, time: new Date() });
    setQueue(queue);
    
    // Trigger Toast
    window.dispatchEvent(new Event('show-offline-toast'));
    if (onSuccess) onSuccess(); 
  }
};

// Sync Function with Progress Update
export const syncOfflineData = async (onProgress) => {
  const queue = getQueue();
  const total = queue.length;
  if (total === 0) return true;

  const failedItems = [];
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const item = queue[i];

    try {
        if (item.action === 'INSERT') await supabase.from(item.table).insert([item.data]);
        else if (item.action === 'UPDATE') await supabase.from(item.table).update(item.data).eq('id', item.data.id);
        else if (item.action === 'DELETE') await supabase.from(item.table).delete().eq('id', item.data.id);
    } catch (err) {
        console.error("Sync Error:", err);
        failedItems.push(item);
    }

    // Progress Calculation
    const processed = i + 1;
    const timeElapsed = Date.now() - startTime;
    const avgTime = timeElapsed / processed;
    const remaining = total - processed;
    const eta = Math.ceil((avgTime * remaining) / 1000);

    // Send update to UI
    if (onProgress) onProgress(processed, total, eta);
  }

  // Handle results
  if (failedItems.length > 0) {
      setQueue(failedItems);
      alert(`Synced with errors. ${failedItems.length} items remain offline.`);
      return false;
  } else {
      localStorage.removeItem('offlineQueue');
      return true;
  }
};