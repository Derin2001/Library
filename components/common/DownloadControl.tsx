
import React, { useState } from 'react';
import { DownloadIcon } from '../icons';

interface DownloadControlProps {
    disabled?: boolean;
    onDownload: (format: 'csv' | 'pdf') => void;
}

const DownloadControl: React.FC<DownloadControlProps> = ({ disabled, onDownload }) => {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleDownload = (format: 'csv' | 'pdf') => {
        onDownload(format);
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block text-left">
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    disabled={!!disabled}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <DownloadIcon className="h-4 w-4" />
                    Download
                </button>
            </div>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
                    <div
                        className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-20"
                    >
                        <div className="py-1">
                            <button
                                onClick={() => handleDownload('csv')}
                                className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                Download as CSV
                            </button>
                            <button
                                onClick={() => handleDownload('pdf')}
                                className="block w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                Download as PDF
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default DownloadControl;
