import React, { useEffect } from 'react';
import { XIcon, CheckCircleIcon, ExclamationTriangleIcon } from '../icons'; 

interface ToastProps {
    message: string;
    type: 'success' | 'error';
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        // ✅ FIXED: 
        // 1. z-[9999] for layering above modals
        // 2. min-w-[350px] for better width
        // 3. items-start to align icon with text top
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 w-auto min-w-[350px] max-w-lg z-[9999] p-4 rounded-xl shadow-2xl flex items-start justify-between transition-all duration-500 translate-y-0 ${
            type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white' 
        }`}>
            <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0">
                    {type === 'success' ? (
                        <CheckCircleIcon className="h-6 w-6 text-white" />
                    ) : (
                        <ExclamationTriangleIcon className="h-6 w-6 text-white" />
                    )}
                </div>
                {/* ✅ Removed w-full, added break-words and padding for readability */}
                <p className="text-sm font-bold text-white break-words leading-tight pt-0.5">
                    {message || "Operation completed"}
                </p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors ml-4 flex-shrink-0">
                <XIcon className="h-5 w-5" />
            </button>
        </div>
    );
};

export default Toast;