
import React from 'react';

interface InactivityWarningModalProps {
  isOpen: boolean;
  onStay: () => void;
  timeLeft: number;
}

const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({ isOpen, onStay, timeLeft }) => {
  if (!isOpen) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[9998] flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Are you still there?</h2>
        <div className="text-slate-600 dark:text-slate-300 mb-6">
          <p>For your security, you will be automatically logged out due to inactivity in...</p>
          <p className="text-4xl font-bold text-center my-4 text-indigo-600 dark:text-indigo-400">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p>To remain logged in, please click the button below.</p>
        </div>
        <div className="flex justify-end">
          <button
            onClick={onStay}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityWarningModal;
