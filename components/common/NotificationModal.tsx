
import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon } from '../icons';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: 'success' | 'error';
  children: React.ReactNode;
}

const NotificationModal: React.FC<NotificationModalProps> = ({ isOpen, onClose, title, type, children }) => {
  if (!isOpen) return null;

  const Icon = type === 'success' ?
    <CheckCircleIcon className="h-8 w-8 text-green-500" /> :
    <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />;

  const titleColor = type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-start">
            <div className="flex-shrink-0 mt-1">
                {Icon}
            </div>
            <div className="ml-4">
                <h2 className={`text-xl font-bold ${titleColor}`}>{title}</h2>
                <div className="text-slate-600 dark:text-slate-300 mt-2 text-base">{children}</div>
            </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
