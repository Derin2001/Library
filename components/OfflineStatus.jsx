import { supabase } from './supabase';

const getQueue = () => JSON.parse(localStorage.getItem('offlineQueue')) || [];
const setQueue = (data) => localStorage.setItem('offlineQueue', JSON.stringify(data));

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
      // Duplicate error check (optional)
      let msg = err.message;
      if(err.code === '23505') msg = "Item already exists (Duplicate).";
      alert("Online Action Failed: " + msg);
    }
  } else {
    const queue = getQueue();
    queue.push({ table, action, data, time: new Date() });
    setQueue(queue);
    window.dispatchEvent(new Event('show-offline-toast'));
    if (onSuccess) onSuccess(); 
  }
};

// Updated Sync Function with Progress & ETA Calculation
export const syncOfflineData = async (onProgress) => {
  let queue = getQueue();
  const total = queue.length;
  if (total === 0) return true;

  const startTime = Date.now();
  const failedItems = [];

  for (let i = 0; i < total; i++) {
    const item = queue[i];

    try {
        // Perform DB Action
        if (item.action === 'INSERT') await supabase.from(item.table).insert([item.data]);
        else if (item.action === 'UPDATE') await supabase.from(item.table).update(item.data).eq('id', item.data.id);
        else if (item.action === 'DELETE') await supabase.from(item.table).delete().eq('id', item.data.id);

    } catch (err) {
        console.error("Sync failed for item:", item, err);
        failedItems.push(item); // Keep failed items to retry later
    }

    // Calculate Progress & ETA
    const processed = i + 1;
    const timeElapsed = Date.now() - startTime;
    const avgTimePerItem = timeElapsed / processed;
    const remainingItems = total - processed;
    const estimatedSecondsLeft = Math.ceil((avgTimePerItem * remainingItems) / 1000);

    // Update UI
    if (onProgress) {
        onProgress(processed, total, estimatedSecondsLeft);
    }
  }

  // Update queue (Remove success, keep failed)
  if (failedItems.length > 0) {
      setQueue(failedItems);
      alert(`⚠️ Synced with some errors. ${failedItems.length} items kept in offline queue.`);
      return false; 
  } else {
      localStorage.removeItem('offlineQueue');
      return true;
  }
};