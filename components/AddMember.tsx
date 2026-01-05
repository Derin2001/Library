import React, { useState } from 'react';
import Card from './common/Card';
import type { Member } from '../types';
import UploadResultModal from './common/UploadResultModal';
import BulkUploadPreviewModal from './common/BulkUploadPreviewModal';
import Modal from './common/Modal';

interface AddMemberProps {
    onAddMember: (member: Omit<Member, 'joinDate'>) => Promise<{ success: boolean, message: string, newMember?: Member }>;
    // ✅ Updated to Promise to handle async DB operations
    onBulkAddMembers: (members: Omit<Member, 'joinDate'>[]) => Promise<{ success: number, failed: number, errors: string[] }>;
    showNotification: (message: string, type: 'success' | 'error') => void;
    existingMembers: Member[];
}

interface PreviewMemberItem {
    data: Omit<Member, 'joinDate'>;
    status: 'valid' | 'error';
    message?: string;
    rowNumber: number;
}

const AddMember: React.FC<AddMemberProps> = ({ onAddMember, onBulkAddMembers, showNotification, existingMembers }) => {
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [activeTab, setActiveTab] = useState<'manual' | 'bulk'>('manual');
    
    // Confirmation Modal State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Upload Result State
    const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

    // Preview State
    const [previewItems, setPreviewItems] = useState<PreviewMemberItem[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^\d*$/.test(val)) {
            setPhoneNumber(val);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phoneNumber.trim()) {
            showNotification('Please fill name and phone number.', 'error');
            return;
        }
        if (id && !/^\d{1,4}$/.test(id)) {
            showNotification('Manual ID must be a 4-digit natural number.', 'error');
            return;
        }
        setIsConfirmModalOpen(true);
    };

    const handleConfirmAdd = async () => {
        const result = await onAddMember({ id, name, email, phoneNumber });
        if (result.success && result.newMember) {
            showNotification(result.message, 'success');
            setId('');
            setName('');
            setEmail('');
            setPhoneNumber('');
        } else {
            showNotification(result.message, 'error');
        }
        setIsConfirmModalOpen(false);
    };

    const processCSV = (text: string) => {
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) {
             showNotification('File is empty.', 'error');
             return;
        }

        const firstLine = lines.find(l => l.trim().length > 0) || '';
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';

        const regex = new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`);

        let startIndex = 0;
        const headerLine = lines[0].toLowerCase();
        if (headerLine.includes('name') && headerLine.includes('phone')) {
            startIndex = 1;
        }

        const parsedItems: PreviewMemberItem[] = [];
        const processedIds = new Set<string>();

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(regex).map(p => p.trim().replace(/^"|"$/g, ''));
            const rowNumber = i + 1;
            
            let csvId = '';
            let csvName = '';
            let csvPhone = '';
            let csvEmail = '';

            if (parts.length >= 4) {
                 csvId = parts[0];
                 csvName = parts[1];
                 csvPhone = parts[2];
                 csvEmail = parts[3];
            } else if (parts.length === 3) {
                 csvName = parts[0];
                 csvPhone = parts[1];
                 csvEmail = parts[2];
            } else {
                 parsedItems.push({
                    data: { id: '?', name: 'Invalid Format', email: '?', phoneNumber: '?' },
                    status: 'error',
                    message: 'Invalid format (expected: ID (opt), Name, Phone, Email (opt))',
                    rowNumber
                });
                continue;
            }

            if (!csvName || !csvPhone) {
                parsedItems.push({
                    data: { id: csvId, name: csvName || 'Unknown', email: csvEmail, phoneNumber: csvPhone || 'Missing' },
                    status: 'error',
                    message: 'Missing required fields (Name or Phone)',
                    rowNumber
                });
                continue;
            }

            if (csvId && !/^\d{4}$/.test(csvId)) {
                parsedItems.push({
                   data: { id: csvId, name: csvName, email: csvEmail, phoneNumber: csvPhone },
                   status: 'error',
                   message: 'Member ID must be exactly 4 digits (0000-9999)',
                   rowNumber
               });
               continue;
            }

            if (!/^\d+$/.test(csvPhone)) {
                 parsedItems.push({
                    data: { id: csvId, name: csvName, email: csvEmail, phoneNumber: csvPhone },
                    status: 'error',
                    message: 'Phone number must contain only digits',
                    rowNumber
                });
                continue;
            }

            if (csvId && processedIds.has(csvId.toLowerCase())) {
                 parsedItems.push({
                    data: { id: csvId, name: csvName, email: csvEmail, phoneNumber: csvPhone },
                    status: 'error',
                    message: 'Duplicate ID in file',
                    rowNumber
                });
                continue;
            }

            const idExists = csvId && existingMembers.some(m => m.id.toLowerCase() === csvId.toLowerCase());
            
            if (idExists) {
                parsedItems.push({
                    data: { id: csvId, name: csvName, email: csvEmail, phoneNumber: csvPhone },
                    status: 'error',
                    message: `Member ID ${csvId} already exists`,
                    rowNumber
                });
                continue;
            }

            parsedItems.push({
                data: { id: csvId, name: csvName, email: csvEmail, phoneNumber: csvPhone },
                status: 'valid',
                rowNumber
            });
            
            if(csvId) processedIds.add(csvId.toLowerCase());
        }

        setPreviewItems(parsedItems);
        setIsPreviewOpen(true);
    };
    
    // ✅ FIXED FUNCTION: Waits for DB and hides modal on success
    const handleConfirmUpload = async (validItems: Omit<Member, 'joinDate'>[]) => {
        // 1. Wait for DB Insertion to complete
        const result = await onBulkAddMembers(validItems);
        
        setIsPreviewOpen(false);

        // 2. Only show Result Modal if there are FAILURES.
        if (result.failed > 0) {
            setUploadResult({ success: result.success, failed: result.failed, errors: result.errors });
        } else {
            // Success Only: Don't show modal. App.tsx toast will handle "Success".
            setUploadResult(null); 
        }
    };

    const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (text) {
                    processCSV(text);
                }
            };
            reader.onerror = () => {
                showNotification('Failed to read file.', 'error');
            };
            reader.readAsText(file);
            e.target.value = ''; 
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Add Member</h1>
            <Card>
                <div className="border-b border-slate-200 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`${activeTab === 'manual' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Manually
                        </button>
                        <button
                            onClick={() => setActiveTab('bulk')}
                            className={`${activeTab === 'bulk' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Bulk
                        </button>
                    </nav>
                </div>
                <div className="pt-6">
                    {activeTab === 'manual' && (
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="id" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Member ID (Optional)</label>
                                <input 
                                    type="text" 
                                    id="id" 
                                    value={id} 
                                    maxLength={4}
                                    onChange={e => { if (/^\d*$/.test(e.target.value)) setId(e.target.value); }} 
                                    placeholder="Auto: 0000-9999" 
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Natural numbers including zero (4 digits). Leave blank to auto-generate next ID.</p>
                            </div>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name <span className="text-red-500">*</span></label>
                                <input type="text" id="name" value={name} onChange={e => { setName(e.target.value); }} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number <span className="text-red-500">*</span></label>
                                <input type="text" inputMode="numeric" id="phone" value={phoneNumber} onChange={handlePhoneChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Numbers only"/>
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email Address <span className="text-slate-400 text-xs">(Optional)</span></label>
                                <input type="email" id="email" value={email} onChange={e => { setEmail(e.target.value); }} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition font-bold shadow-md">Review & Add Member</button>
                        </form>
                    )}
                    {activeTab === 'bulk' && (
                        <div>
                            <label htmlFor="bulk-upload" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Upload CSV File</label>
                            <p className="text-sm text-slate-500 mb-2">Format: ID (optional, 4-digits), Name, Phone (required), Email (optional)</p>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md hover:border-indigo-400 transition-colors cursor-pointer group">
                                <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-12 w-12 text-slate-400 group-hover:text-indigo-400 transition-colors" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    <div className="flex text-sm text-slate-600 dark:text-slate-400">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-white dark:bg-slate-900 rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                                            <span>Upload a file</span>
                                            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleBulkUpload} accept=".csv" />
                                        </label>
                                        <p className="pl-1">or drag and drop</p>
                                    </div>
                                    <p className="text-xs text-slate-500">CSV up to 10MB. Semicolon or comma separated.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Modal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmAdd}
                title="Confirm New Member Details"
                confirmText="Add Member"
                confirmButtonClass="bg-indigo-600 hover:bg-indigo-700"
            >
                <div className="space-y-3">
                    <p className="text-slate-600 dark:text-slate-300">Please review the details before adding:</p>
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-md space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">ID:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white font-mono">{id || '(Sequential Auto)'}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Name:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{name}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Phone:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{phoneNumber}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Email:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{email || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </Modal>
            
            <BulkUploadPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                onConfirm={handleConfirmUpload}
                items={previewItems}
                title="Member Bulk Upload"
                renderItem={(item) => (
                    <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                            {item.id ? `ID: ${item.id}` : 'ID: Sequential Auto'} - {item.name}
                        </div>
                        <div className="text-xs text-slate-500">
                            Phone: {item.phoneNumber} • Email: {item.email || 'N/A'}
                        </div>
                    </div>
                )}
            />

            <UploadResultModal
                isOpen={!!uploadResult}
                onClose={() => setUploadResult(null)}
                successCount={uploadResult?.success || 0}
                failCount={uploadResult?.failed || 0}
                errors={uploadResult?.errors || []}
            />
        </div>
    );
};

export default AddMember;