import { useState, useEffect } from 'react';
import { syncOfflineData } from '../lib/OfflineManager'; // പാത്ത് ശ്രദ്ധിക്കുക

const OfflineStatus = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showToast, setShowToast] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // ക്യൂവിൽ എത്ര എണ്ണം ഉണ്ടെന്ന് നോക്കുന്നു
    const updateCount = () => {
      const q = JSON.parse(localStorage.getItem('offlineQueue')) || [];
      setPendingCount(q.length);
    };

    const handleOnline = () => {
      setIsOffline(false);
      updateCount();
      // നെറ്റ് വരുമ്പോൾ ഓട്ടോമാറ്റിക് ആയി ചോദിക്കുന്നു
      const q = JSON.parse(localStorage.getItem('offlineQueue')) || [];
      if (q.length > 0) {
        if(confirm(`You are back online! Sync ${q.length} items now?`)) {
          handleSync();
        }
      }
    };
    
    const handleOffline = () => setIsOffline(true);
    
    const handleToast = () => {
      setShowToast(true);
      updateCount();
      setTimeout(() => setShowToast(false), 3000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('show-offline-toast', handleToast);
    
    updateCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('show-offline-toast', handleToast);
    };
  }, []);

  const handleSync = async () => {
    const success = await syncOfflineData();
    if (success) {
      alert("✅ All data synced successfully!");
      setPendingCount(0);
    }
  };

  return (
    <>
      {/* 1. Offline Banner */}
      {isOffline && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'red', color: 'white', textAlign: 'center', padding: '10px', zIndex: 9999 }}>
          ⚠️ You are Offline. Changes will be saved locally.
        </div>
      )}

      {/* 2. Toast Notification */}
      {showToast && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '10px', zIndex: 10000 }}>
           💾 Saved to Offline Queue
        </div>
      )}

      {/* 3. Sync Button (If online and has pending data) */}
      {!isOffline && pendingCount > 0 && (
        <button onClick={handleSync} style={{ position: 'fixed', bottom: '80px', right: '20px', background: '#ffc107', padding: '15px', borderRadius: '50px', border: 'none', fontWeight: 'bold', zIndex: 9998, boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          🔄 Sync Data ({pendingCount})
        </button>
      )}
    </>
  );
};

export default OfflineStatus;