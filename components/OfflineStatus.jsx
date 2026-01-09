import { useState, useEffect, useRef } from 'react';
import { syncOfflineData } from '../lib/OfflineManager';

const OfflineStatus = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showToast, setShowToast] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Syncing UI State
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, eta: 0 });

  // Dragging State
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 100 });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updateCount = () => {
      const q = JSON.parse(localStorage.getItem('offlineQueue')) || [];
      setPendingCount(q.length);
    };

    const handleOnline = () => { setIsOffline(false); updateCount(); };
    const handleOffline = () => setIsOffline(true);
    const handleToast = () => { setShowToast(true); updateCount(); setTimeout(() => setShowToast(false), 3000); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('show-offline-toast', handleToast);
    
    // Initial Load
    updateCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('show-offline-toast', handleToast);
    };
  }, []);

  // --- SYNC HANDLER ---
  const handleSync = async () => {
    if (isSyncing) return; // Already syncing
    setIsSyncing(true);
    
    // Call Manager with callback to update UI
    const success = await syncOfflineData((current, total, eta) => {
        setProgress({ current, total, eta });
    });

    if (success) {
      setPendingCount(0);
      alert("✅ All data synced successfully!");
    }
    
    // Reset UI
    setIsSyncing(false);
    setProgress({ current: 0, total: 0, eta: 0 });
  };

  // --- DRAG HANDLERS (Fixed Logic) ---
  
  // 1. Mouse/Touch Down
  const handleStart = (clientX, clientY) => {
    isDragging.current = true;
    dragOffset.current = { x: clientX - position.x, y: clientY - position.y };
    
    // Add listeners to window to track movement even if mouse leaves button
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // 2. Move
  const handleMove = (clientX, clientY) => {
    if (!isDragging.current) return;
    
    // Calculate new position
    let newX = clientX - dragOffset.current.x;
    let newY = clientY - dragOffset.current.y;

    // Boundary Checks (Prevent going off screen)
    const maxX = window.innerWidth - 60;
    const maxY = window.innerHeight - 60;
    
    if (newX < 10) newX = 10;
    if (newY < 10) newY = 10;
    if (newX > maxX) newX = maxX;
    if (newY > maxY) newY = maxY;

    setPosition({ x: newX, y: newY });
  };

  const handleMouseMove = (e) => handleMove(e.clientX, e.clientY);
  const handleTouchMove = (e) => {
      e.preventDefault(); // Stop scrolling while dragging
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  // 3. End
  const handleEnd = () => {
    isDragging.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleEnd);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleEnd);
  };

  // Calculate Percentage for Progress Bar
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <>
      {/* 1. OFFLINE BANNER */}
      {isOffline && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#dc2626', color: 'white', textAlign: 'center', padding: '10px', zIndex: 9999, fontWeight: 'bold' }}>
           📡 You are Offline
        </div>
      )}

      {/* 2. SAVED TOAST */}
      {showToast && (
        <div style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translate(-50%, 0)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '12px 20px', borderRadius: '30px', zIndex: 10000 }}>
           💾 Saved to Offline Queue
        </div>
      )}

      {/* 3. SYNC MODAL (Progress Bar) */}
      {isSyncing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }}>
            <div style={{ background: 'white', padding: '20px', borderRadius: '15px', width: '80%', maxWidth: '300px', textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Syncing Data...</h3>
                
                {/* Bar */}
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                    <span>{progress.current} / {progress.total} Items</span>
                    <span>{progress.eta}s remaining</span>
                </div>
            </div>
        </div>
      )}

      {/* 4. MOVABLE BUTTON */}
      {!isOffline && !isSyncing && pendingCount > 0 && (
        <button 
            onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
            style={{ 
                position: 'fixed', 
                left: `${position.x}px`, 
                top: `${position.y}px`, 
                background: '#f59e0b', 
                color: 'white',
                padding: '15px 20px', 
                borderRadius: '50px', 
                border: 'none', 
                fontWeight: 'bold', 
                zIndex: 9998, 
                boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                cursor: 'grab',
                touchAction: 'none' // Important for mobile
            }}
        >
          🔄 Sync ({pendingCount})
        </button>
      )}
    </>
  );
};

export default OfflineStatus;