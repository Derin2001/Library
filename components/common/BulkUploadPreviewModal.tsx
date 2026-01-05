
import React, { useState } from 'react';
import Modal from './Modal';
import { CheckCircleIcon, ExclamationTriangleIcon } from '../icons';

interface PreviewItem<T> {
    data: T;
    status: 'valid' | 'error';
    message?: string;
    rowNumber: number;
}

interface BulkUploadPreviewModalProps<T> {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (validItems: T[]) => void;
    items: PreviewItem<T>[];
    title: string;
    renderItem: (item: T) => React.ReactNode;
}

const BulkUploadPreviewModal = <T,>({ isOpen, onClose, onConfirm, items, title, renderItem }: BulkUploadPreviewModalProps<T>) => {
    const [view, setView] = useState<'valid' | 'error'>('valid');

    const validItems = items.filter(i => i.status === 'valid');
    const errorItems = items.filter(i => i.status === 'error');

    const handleConfirm = () => {
        onConfirm(validItems.map(i => i.data));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[1060] flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{title} Preview</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Review the data before uploading.</p>

                <div className="flex space-x-4 border-b border-slate-200 dark:border-slate-700 mb-4">
                    <button
                        onClick={() => setView('valid')}
                        className={`pb-2 px-4 font-medium text-sm flex items-center ${view === 'valid' ? 'border-b-2 border-green-500 text-green-600' : 'text-slate-500'}`}
                    >
                        <CheckCircleIcon className="h-4 w-4 mr-2" />
                        Ready to Upload ({validItems.length})
                    </button>
                    <button
                        onClick={() => setView('error')}
                        className={`pb-2 px-4 font-medium text-sm flex items-center ${view === 'error' ? 'border-b-2 border-red-500 text-red-600' : 'text-slate-500'}`}
                    >
                        <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                        Rejected / Errors ({errorItems.length})
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900/50">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase w-20">Row</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase">Data</th>
                                {view === 'error' && <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase w-1/3">Reason</th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                            {(view === 'valid' ? validItems : errorItems).map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">#{item.rowNumber}</td>
                                    <td className="px-4 py-2 text-sm text-slate-800 dark:text-slate-200">
                                        {renderItem(item.data)}
                                    </td>
                                    {view === 'error' && (
                                        <td className="px-4 py-2 text-sm text-red-600 font-medium">
                                            {item.message}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {(view === 'valid' ? validItems : errorItems).length === 0 && (
                                <tr>
                                    <td colSpan={view === 'error' ? 3 : 2} className="px-6 py-8 text-center text-slate-500">
                                        {view === 'valid' ? 'No valid items found.' : 'No errors found!'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={validItems.length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Upload {validItems.length} Items
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkUploadPreviewModal;
