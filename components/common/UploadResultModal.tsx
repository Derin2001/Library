
import React from 'react';
import { CheckCircleIcon, ExclamationTriangleIcon } from '../icons';

interface UploadResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    successCount: number;
    failCount: number;
    errors: string[];
}

const UploadResultModal: React.FC<UploadResultModalProps> = ({ isOpen, onClose, successCount, failCount, errors }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[1060] flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md max-h-[80vh] flex flex-col">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Upload Results</h2>
                
                <div className="space-y-4 mb-4">
                    <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-100 dark:border-green-800">
                        <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3" />
                        <div>
                            <p className="font-medium text-green-800 dark:text-green-200">Successful Uploads</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-300">{successCount}</p>
                        </div>
                    </div>

                    {failCount > 0 && (
                        <div className="flex items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-100 dark:border-red-800">
                            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3" />
                            <div>
                                <p className="font-medium text-red-800 dark:text-red-200">Failed Uploads</p>
                                <p className="text-2xl font-bold text-red-600 dark:text-red-300">{failCount}</p>
                            </div>
                        </div>
                    )}
                </div>

                {errors.length > 0 && (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Error Details:</h3>
                        <div className="overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-md p-3">
                            <ul className="space-y-2 text-sm text-red-600 dark:text-red-400">
                                {errors.map((err, idx) => (
                                    <li key={idx} className="border-b border-slate-200 dark:border-slate-700 last:border-0 pb-1 last:pb-0">
                                        • {err}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadResultModal;
