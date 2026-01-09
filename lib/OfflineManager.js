import { supabase } from './supabase'; // നിങ്ങളുടെ Supabase ഫയലിന്റെ പാത്ത് ശരിയാണെന്ന് ഉറപ്പാക്കുക

// 1. ക്യൂ (Queue) എടുക്കാനും വെക്കാനും ഉള്ള ഫംഗ്‌ഷൻ
const getQueue = () => JSON.parse(localStorage.getItem('offlineQueue')) || [];
const setQueue = (data) => localStorage.setItem('offlineQueue', JSON.stringify(data));

// 2. മെയിൻ ആക്ഷൻ ഫംഗ്‌ഷൻ (ഇതാണ് നിങ്ങൾ ബട്ടണുകളിൽ വിളിക്കേണ്ടത്)
export const handleLibraryAction = async (table, action, data, onSuccess) => {
  
  // A. നെറ്റ് ഉണ്ടെങ്കിൽ (Online) -> നേരിട്ട് Supabase-ലേക്ക്
  if (navigator.onLine) {
    try {
      let error;
      
      if (action === 'INSERT') {
        const { error: err } = await supabase.from(table).insert([data]);
        error = err;
      } else if (action === 'UPDATE') {
        // Update ചെയ്യുമ്പോൾ 'id' നിർബന്ധമാണ്
        const { error: err } = await supabase.from(table).update(data).eq('id', data.id);
        error = err;
      } else if (action === 'DELETE') {
        // Delete ചെയ്യുമ്പോൾ 'id' നിർബന്ധമാണ്
        const { error: err } = await supabase.from(table).delete().eq('id', data.id);
        error = err;
      }

      if (error) throw error;
      
      if (onSuccess) onSuccess(); // വിജയിച്ചാൽ (Alert etc.)
      
    } catch (err) {
      alert("Error (Online): " + err.message);
    }
  } 
  
  // B. നെറ്റ് ഇല്ലെങ്കിൽ (Offline) -> Local Storage-ലേക്ക്
  else {
    const queue = getQueue();
    // ക്യൂവിലേക്ക് പുതിയ കാര്യം ചേർക്കുന്നു
    queue.push({ table, action, data, time: new Date() });
    setQueue(queue);
    
    // UI-ൽ "Saved" എന്ന് കാണിക്കാൻ ഒരു സിഗ്നൽ കൊടുക്കുന്നു
    window.dispatchEvent(new Event('show-offline-toast'));
    
    // ഓഫ്‌ലൈൻ ആണെങ്കിലും ഫോം ക്ലിയർ ചെയ്യാൻ success വിളിക്കാം
    if (onSuccess) onSuccess(); 
  }
};

// 3. സിങ്ക് ചെയ്യാനുള്ള ഫംഗ്‌ഷൻ (Sync Function)
export const syncOfflineData = async () => {
  const queue = getQueue();
  if (queue.length === 0) return;

  // ഓരോന്നായി Supabase-ലേക്ക് കയറ്റുന്നു
  for (const item of queue) {
    // റിക്കേഴ്‌സീവ് ആയി വിളിക്കാതെ നേരിട്ട് സുപ്പാബേസ് കോൾ ചെയ്യുന്നു
    if (item.action === 'INSERT') {
       await supabase.from(item.table).insert([item.data]);
    } else if (item.action === 'UPDATE') {
       await supabase.from(item.table).update(item.data).eq('id', item.data.id);
    } else if (item.action === 'DELETE') {
       await supabase.from(item.table).delete().eq('id', item.data.id);
    }
  }

  // എല്ലാം കഴിഞ്ഞാൽ ക്യൂ ക്ലിയർ ചെയ്യുന്നു
  localStorage.removeItem('offlineQueue');
  return true; // Success
};