import React, { useState } from 'react';
import Card from './common/Card';
import { Book } from '../types';
import UploadResultModal from './common/UploadResultModal';
import BulkUploadPreviewModal from './common/BulkUploadPreviewModal';
import Modal from './common/Modal';

interface AddBookProps {
    onAddBook: (book: Omit<Book, 'id'>) => Promise<{ success: boolean, message: string, newBook?: Book }>;
    onBulkAddBooks: (books: Omit<Book, 'id'>[]) => Promise<{ success: number, failed: number, errors: string[] }>;
    categories: string[];
    showNotification: (message: string, type: 'success' | 'error') => void;
    existingBooks: Book[];
}

interface PreviewBookItem {
    data: Omit<Book, 'id'>;
    status: 'valid' | 'error';
    message?: string;
    rowNumber: number;
}

const AddBook: React.FC<AddBookProps> = ({ onAddBook, onBulkAddBooks, categories, showNotification, existingBooks }) => {
    // --- State Management ---
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [isbn, setIsbn] = useState('');
    const [totalCopies, setTotalCopies] = useState<number | string>(1);
    const [language, setLanguage] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [newCategory, setNewCategory] = useState('');
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    
    // UI States
    const [activeTab, setActiveTab] = useState<'manual' | 'bulk'>('manual');
    const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Loading State

    // Modal States
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    
    // Preview States
    const [previewItems, setPreviewItems] = useState<PreviewBookItem[]>([]);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // --- Handlers ---

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === '__NEW__') {
            setIsAddingNewCategory(true);
            setSelectedCategory('__NEW__');
        } else {
            setIsAddingNewCategory(false);
            setNewCategory('');
            setSelectedCategory(value);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const category = isAddingNewCategory ? newCategory.trim() : selectedCategory;
        
        if (!category) {
            showNotification('Please select or add a category.', 'error');
            return;
        }
        if (!language.trim()) {
            showNotification('Please enter the book language.', 'error');
            return;
        }
        if (!totalCopies || Number(totalCopies) < 1) {
            showNotification('Total copies must be at least 1.', 'error');
            return;
        }

        // Open confirmation modal
        setIsConfirmModalOpen(true);
    };

    const handleConfirmAdd = async () => {
        if (isSubmitting) return; // Prevent double click
        setIsSubmitting(true);

        const category = isAddingNewCategory ? newCategory.trim() : selectedCategory;
        const copies = totalCopies === '' ? 1 : Number(totalCopies);

        // ✅ AWAIT: Wait for DB/Offline Manager
        const result = await onAddBook({ 
            title, 
            author, 
            isbn, 
            totalCopies: copies, 
            category, 
            language: language.trim() 
        });

        setIsSubmitting(false);
        setIsConfirmModalOpen(false);

        if (result.success) {
            showNotification(result.message, 'success');
            // Reset Form
            setTitle('');
            setAuthor('');
            setIsbn('');
            setTotalCopies(1);
            setLanguage('');
            setSelectedCategory('');
            setNewCategory('');
            setIsAddingNewCategory(false);
        } else {
            showNotification(result.message, 'error');
        }
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
        if (headerLine.includes('title') && headerLine.includes('isbn')) {
            startIndex = 1;
        }

        const parsedItems: PreviewBookItem[] = [];
        const processedISBNs = new Set<string>();

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(regex).map(p => p.trim().replace(/^"|"$/g, ''));
            const rowNumber = i + 1;
            
            if (parts.length >= 4) {
                const csvTitle = parts[0];
                const csvAuthor = parts[1];
                const csvIsbn = parts[2];
                const csvCategory = parts[3];
                const csvCopies = parts.length > 4 ? parts[4] : '1';
                const copies = parseInt(csvCopies, 10) || 1;
                const csvLanguage = parts.length > 5 ? parts[5] : 'English'; 

                // Validation
                if (!csvTitle || !csvAuthor || !csvIsbn || !csvCategory) {
                      parsedItems.push({
                        data: { title: csvTitle || 'Unknown', author: csvAuthor || 'Unknown', isbn: csvIsbn || '?', category: csvCategory || '?', totalCopies: copies, language: csvLanguage },
                        status: 'error',
                        message: 'Missing required fields',
                        rowNumber
                      });
                      continue;
                }

                if (processedISBNs.has(csvIsbn.toLowerCase())) {
                    parsedItems.push({
                         data: { title: csvTitle, author: csvAuthor, isbn: csvIsbn, category: csvCategory, totalCopies: copies, language: csvLanguage },
                         status: 'error',
                         message: 'Duplicate ISBN in file',
                         rowNumber
                    });
                    continue;
                }

                const isbnExists = existingBooks.some(b => b.isbn.toLowerCase() === csvIsbn.toLowerCase());
                if (isbnExists) {
                    parsedItems.push({
                         data: { title: csvTitle, author: csvAuthor, isbn: csvIsbn, category: csvCategory, totalCopies: copies, language: csvLanguage },
                         status: 'error',
                         message: `Book with ISBN ${csvIsbn} already exists`,
                         rowNumber
                    });
                    continue;
                }

                parsedItems.push({
                     data: { title: csvTitle, author: csvAuthor, isbn: csvIsbn, category: csvCategory, totalCopies: copies, language: csvLanguage },
                     status: 'valid',
                     rowNumber
                });
                processedISBNs.add(csvIsbn.toLowerCase());

            } else {
                 parsedItems.push({
                     data: { title: 'Invalid', author: 'Invalid', isbn: '?', category: '?', totalCopies: 0, language: '?' },
                     status: 'error',
                     message: `Invalid format. Found ${parts.length} columns, expected at least 4.`,
                     rowNumber
                 });
            }
        }

        setPreviewItems(parsedItems);
        setIsPreviewOpen(true);
    };

    const handleConfirmUpload = async (validItems: Omit<Book, 'id'>[]) => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        // ✅ AWAIT: Wait for Bulk Add
        const result = await onBulkAddBooks(validItems);
        
        setIsSubmitting(false);
        setIsPreviewOpen(false);
        
        if (result.failed > 0) {
            setUploadResult({ success: result.success, failed: result.failed, errors: result.errors });
        } else {
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

    // --- Render ---

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Add Book</h1>
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
                    {/* MANUAL FORM */}
                    {activeTab === 'manual' && (
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Author</label>
                                <input type="text" value={author} onChange={e => setAuthor(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ISBN</label>
                                <input type="text" value={isbn} onChange={e => setIsbn(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Language</label>
                                <input type="text" value={language} onChange={e => setLanguage(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                                <select value={selectedCategory} onChange={handleCategoryChange} required className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                                    <option value="" disabled>Select a category</option>
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    <option value="__NEW__">--- Add New Category ---</option>
                                </select>
                            </div>
                            {isAddingNewCategory && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">New Category Name</label>
                                    <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} required={isAddingNewCategory} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                                </div>
                            )}
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Total Copies</label>
                                <input 
                                    type="number" 
                                    value={totalCopies} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') setTotalCopies('');
                                        else setTotalCopies(parseInt(val, 10));
                                    }} 
                                    onBlur={() => {
                                        if (totalCopies === '' || Number(totalCopies) < 1) setTotalCopies(1);
                                    }}
                                    required 
                                    min="1" 
                                    className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" 
                                />
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition">Review & Add Book</button>
                        </form>
                    )}

                    {/* BULK UPLOAD */}
                    {activeTab === 'bulk' && (
                        <div>
                             <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Upload CSV File</label>
                             <p className="text-sm text-slate-500 mb-2">Format: Title, Author, ISBN, Category, [Total Copies], [Language]</p>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                onClose={() => !isSubmitting && setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmAdd}
                title="Confirm New Book Details"
                confirmText={isSubmitting ? "Adding..." : "Add Book"}
                confirmButtonClass={`bg-green-600 hover:bg-green-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <div className="space-y-3">
                    <p className="text-slate-600 dark:text-slate-300">Please review the details before adding:</p>
                    <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-md space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Title:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white font-medium">{title}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Author:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{author}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">ISBN:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{isbn}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Language:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{language}</span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Category:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">
                                {isAddingNewCategory ? newCategory : selectedCategory}
                            </span>
                            
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Copies:</span>
                            <span className="col-span-2 text-slate-900 dark:text-white">{totalCopies}</span>
                        </div>
                    </div>
                </div>
            </Modal>

            <BulkUploadPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => !isSubmitting && setIsPreviewOpen(false)}
                onConfirm={handleConfirmUpload}
                items={previewItems}
                title="Book Bulk Upload"
                renderItem={(item) => (
                    <div>
                        <div className="font-medium text-slate-900 dark:text-white">{item.title}</div>
                        <div className="text-xs text-slate-500">
                            {item.author} • ISBN: {item.isbn} • Lang: {item.language} • {item.totalCopies} Cop{item.totalCopies > 1 ? 'ies' : 'y'}
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

export default AddBook;