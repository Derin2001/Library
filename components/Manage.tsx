import React, { useState, useMemo } from 'react';
import { Book, Member, Transaction, Reservation, BookStatus, TransactionType, ArchiveRecord, ActivityLogEntry, Settings } from '../types';
import Card from './common/Card';
import { parseISO, isWithinInterval, startOfMonth, endOfMonth, format } from 'date-fns';
import Modal from './common/Modal';
import { TrashIcon, PencilIcon, SearchIcon, ExclamationTriangleIcon, CogIcon, DownloadIcon, BookOpenIcon, UserIcon, ShieldCheckIcon, UsersIcon } from './icons'; 
import { downloadCSV, downloadPDF, downloadSummaryPDF } from '../lib/utils';
import DownloadControl from './common/DownloadControl';
import { useLocalStorage } from '../hooks/useLocalStorage';

const calculatePopularity = (
    startDate: Date, 
    endDate: Date, 
    transactions: Transaction[], 
    reservations: Reservation[], 
    books: Book[], 
    members: Member[]
) => {
    const periodTransactions = transactions.filter(t => isWithinInterval(parseISO(t.date), { start: startDate, end: endDate }));
    const periodReservations = reservations.filter(r => isWithinInterval(parseISO(r.reservationDate), { start: startDate, end: endDate }));

    const bookScores: { [bookId: string]: { score: number, title: string } } = {};
    books.forEach(b => { bookScores[b.id] = { score: 0, title: b.title }; });

    periodTransactions.forEach(t => {
        if (bookScores[t.bookId]) {
            if (t.type === TransactionType.CheckOut) bookScores[t.bookId].score += 2;
            else if (t.type === TransactionType.CheckIn) bookScores[t.bookId].score += 1;
        }
    });
    periodReservations.forEach(r => {
        if (bookScores[r.bookId]) bookScores[r.bookId].score += 1.5;
    });
    
    const popularBooks = Object.entries(bookScores).map(([bookId, data]) => ({ bookId, ...data })).filter((data) => data.score > 0).sort((a, b) => b.score - a.score);
    const memberScores: { [memberId: string]: number } = {};
    members.forEach(m => { memberScores[m.id] = 0; });
    
    periodTransactions.forEach(t => { if (memberScores[t.memberId] !== undefined) memberScores[t.memberId]++; });
    periodReservations.forEach(r => { if (memberScores[r.memberId] !== undefined) memberScores[r.memberId]++; });
    
    const popularMembers = Object.entries(memberScores).filter(([, count]) => count > 0).sort(([, a], [, b]) => b - a).map(([memberId, count]) => ({ memberId, name: members.find(m => m.id === memberId)?.name || 'Unknown', count }));

    return { popularBooks, popularMembers };
};

interface ManageProps {
    librarianPassword?: string;
    verifyAdminForReset?: (password: string) => Promise<boolean>;
    onUpdateAdminPassword?: (newPass: string) => Promise<{success: boolean; message: string}>;
    books: Book[];
    members: Member[];
    transactions: Transaction[];
    reservations: Reservation[];
    archiveHistory: ArchiveRecord[];
    activityLog: ActivityLogEntry[];
    settings: Settings;
    // ✅ Updated all handlers to return Promises
    onUpdateBook: (bookId: string, updatedData: Partial<Omit<Book, 'id'>>) => Promise<{ success: boolean, message: string }>;
    onDeleteBook: (bookId: string) => Promise<any>;
    onUpdateMember: (memberId: string, updatedData: { id: string; name: string, email: string; phoneNumber: string }) => Promise<{ success: boolean, message: string }>;
    onDeleteMember: (memberId: string) => Promise<any>;
    onResetSystem: () => Promise<any>;
    onUpdateSettings: (settings: Settings) => Promise<{ success: boolean, message: string }>;
    showNotification: (message: string, type: 'success' | 'error') => void;
    onLogActivity: (action: string, details: string) => void;
}

type ManageView = 'menu' | 'allBooks' | 'borrowingHistory' | 'memberReport' | 'popularBooks' | 'popularMembers' | 'manageMembers' | 'archiveHistory' | 'activityLog' | 'settings' | 'monthlySummary';

const Manage: React.FC<ManageProps> = ({ 
    librarianPassword, 
    verifyAdminForReset, 
    onUpdateAdminPassword, 
    books, members, transactions, reservations, archiveHistory, activityLog, settings, 
    onUpdateBook, onDeleteBook, onUpdateMember, onDeleteMember, onResetSystem, onUpdateSettings, 
    showNotification, onLogActivity 
}) => {
    
    const [activeView, setActiveView] = useLocalStorage<ManageView>('manageActiveView', 'menu');
    
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [bookSearchTerm, setBookSearchTerm] = useState('');
    
    // --- Loading States ---
    const [isBookSubmitting, setIsBookSubmitting] = useState(false);
    const [isMemberSubmitting, setIsMemberSubmitting] = useState(false);
    const [isSettingsSubmitting, setIsSettingsSubmitting] = useState(false);
    const [isPassSubmitting, setIsPassSubmitting] = useState(false);
    const [isResetSubmitting, setIsResetSubmitting] = useState(false);

    const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
    const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
    
    const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
    const [editBookData, setEditBookData] = useState({ title: '', author: '', isbn: '', totalCopies: 1, language: '', category: '' });
    
    const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
    const [editMemberData, setEditMemberData] = useState({ id: '', name: '', email: '', phoneNumber: '' });

    const [reportMonth, setReportMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [summaryMonth, setSummaryMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    
    // SETTINGS STATES
    const [maxRenewalsInput, setMaxRenewalsInput] = useState(settings.maxRenewals.toString());
    const [loanPeriodInput, setLoanPeriodInput] = useState((settings.loanPeriodDays || 15).toString()); 
    
    // PASSWORD CHANGE STATES
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');

    // System Reset Multi-step state
    const [resetStep, setResetStep] = useState<0 | 1 | 2 | 3>(0);
    const [resetCheck, setResetCheck] = useState(false);
    const [resetPassInput, setResetPassInput] = useState('');

    // Archive History Viewer State
    const [viewingArchiveHistory, setViewingArchiveHistory] = useState<ArchiveRecord | null>(null);
    const [viewingLogEntry, setViewingLogEntry] = useState<ActivityLogEntry | null>(null);

    const memberActivityHistory = useMemo(() => {
        if (!selectedMemberId) return [];
        const memberTransactions = transactions.filter(t => t.memberId === selectedMemberId).map(t => ({
            date: format(parseISO(t.date), 'dd/MM/yyyy HH:mm'),
            type: t.type === TransactionType.CheckOut ? 'LOAN' : 'RETURN',
            resource: t.bookTitle,
        }));
        const memberReservations = reservations.filter(r => r.memberId === selectedMemberId).map(r => {
            const book = books.find(b => b.id === r.bookId);
            return {
                date: format(parseISO(r.reservationDate), 'dd/MM/yyyy HH:mm'),
                type: 'RESERVATION',
                resource: book?.title || 'Unknown Book',
            };
        });
        return [...memberTransactions, ...memberReservations].sort((a,b) => b.date.localeCompare(a.date));
    }, [transactions, reservations, selectedMemberId, books]);

    const filteredMembers = useMemo(() => members.filter(m => m.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || m.id.includes(memberSearchTerm)), [members, memberSearchTerm]);
    const filteredBooks = useMemo(() => books.filter(b => b.title.toLowerCase().includes(bookSearchTerm.toLowerCase()) || b.isbn.includes(bookSearchTerm) || b.id.includes(bookSearchTerm)), [books, bookSearchTerm]);

    // --- Action Handlers with Await ---

    const handleUpdateBook = async () => {
        if (!bookToEdit) return;
        setIsBookSubmitting(true);
        const result = await onUpdateBook(bookToEdit.id, editBookData);
        setIsBookSubmitting(false);
        if (result && result.success) {
            setBookToEdit(null);
        }
    };

    const handleDeleteBook = async () => {
        if (!bookToDelete) return;
        setIsBookSubmitting(true);
        await onDeleteBook(bookToDelete.id);
        setIsBookSubmitting(false);
        setBookToDelete(null);
    };

    const handleUpdateMember = async () => {
        if (!memberToEdit) return;
        setIsMemberSubmitting(true);
        const result = await onUpdateMember(memberToEdit.id, editMemberData);
        setIsMemberSubmitting(false);
        if (result && result.success) {
            setMemberToEdit(null);
        }
    };

    const handleDeleteMember = async () => {
        if (!memberToDelete) return;
        setIsMemberSubmitting(true);
        await onDeleteMember(memberToDelete.id);
        setIsMemberSubmitting(false);
        setMemberToDelete(null);
    };

    const handleUpdateSettings = async () => {
        setIsSettingsSubmitting(true);
        await onUpdateSettings({ ...settings, maxRenewals: parseInt(maxRenewalsInput), loanPeriodDays: parseInt(loanPeriodInput) });
        setIsSettingsSubmitting(false);
    };

    const handleAdminPassUpdate = async () => {
        if(newPass !== confirmPass) {
            showNotification('Passwords do not match', 'error');
            return;
        }
        if(newPass.length < 6) {
            showNotification('Password too short', 'error');
            return;
        }
        if(onUpdateAdminPassword) {
            setIsPassSubmitting(true);
            const res = await onUpdateAdminPassword(newPass);
            setIsPassSubmitting(false);
            if(res.success) {
                setNewPass('');
                setConfirmPass('');
            }
        }
    }

    const handleSystemReset = async () => {
        setIsResetSubmitting(true);
        await onResetSystem();
        setIsResetSubmitting(false);
        setResetStep(0);
        setResetCheck(false);
        setResetPassInput('');
    };

    const handleResetVerification = async () => {
        if (verifyAdminForReset) {
            const isValid = await verifyAdminForReset(resetPassInput);
            if (isValid) {
                setResetStep(3);
            } else {
                showNotification('Incorrect librarian password.', 'error');
            }
        } else {
            if (resetPassInput === librarianPassword) setResetStep(3);
            else showNotification('Incorrect password', 'error');
        }
    };

    // --- Export Functions ---
    const handleDownloadAllBooks = (fmt: 'pdf' | 'csv') => {
        const data = books.map(b => ({ ID: b.id, Title: b.title, Author: b.author, ISBN: b.isbn, Category: b.category, Language: b.language, Copies: b.totalCopies }));
        if (fmt === 'pdf') downloadPDF(data, 'Library_Book_List.pdf', 'Complete Book Catalog');
        else downloadCSV(data, 'Library_Book_List.csv');
    };

    const handleDownloadMembers = (fmt: 'pdf' | 'csv') => {
        const data = members.map(m => ({ ID: m.id, Name: m.name, Email: m.email, Phone: m.phoneNumber, Joined: format(parseISO(m.joinDate), 'dd/MM/yyyy') }));
        if (fmt === 'pdf') downloadPDF(data, 'Library_Member_List.pdf', 'Registered Library Members');
        else downloadCSV(data, 'Library_Member_List.csv');
    };

    const handleDownloadActivityLog = () => {
        const data = activityLog.map(l => ({ Timestamp: format(parseISO(l.timestamp), 'dd/MM HH:mm:ss'), Action: l.action, Details: l.details }));
        downloadPDF(data, 'System_Activity_Log.pdf', 'Library System Audit Trail');
    };

    const handleDownloadMemberReport = () => {
        if (!selectedMemberId) return;
        const member = members.find(m => m.id === selectedMemberId);
        const data = memberActivityHistory.map(h => ({ Date: h.date, Action: h.type, Resource: h.resource }));
        downloadPDF(data, `Report_${selectedMemberId}.pdf`, `Activity Summary for ${member?.name} (${selectedMemberId})`);
    };

    const handleGenerateMonthlySummary = () => {
        const [year, month] = summaryMonth.split('-').map(Number);
        const startDate = startOfMonth(new Date(year, month - 1));
        const endDate = endOfMonth(startDate);
        const label = format(startDate, 'MMMM yyyy');

        const rangeTrans = transactions.filter(t => isWithinInterval(parseISO(t.date), { start: startDate, end: endDate }));
        const checkouts = rangeTrans.filter(t => t.type === TransactionType.CheckOut).length;
        const checkins = rangeTrans.filter(t => t.type === TransactionType.CheckIn).length;
        const newMembers = members.filter(m => isWithinInterval(parseISO(m.joinDate), { start: startDate, end: endDate })).length;
        
        let booksAdded = 0;
        activityLog.forEach(log => {
            if (isWithinInterval(parseISO(log.timestamp), { start: startDate, end: endDate })) {
                if (log.action === 'Add Book') booksAdded += 1;
                else if (log.action === 'Bulk Add Books') {
                    const match = log.details.match(/Added (\d+) books/i);
                    if (match) booksAdded += parseInt(match[1]);
                }
            }
        });

        const { popularBooks, popularMembers } = calculatePopularity(startDate, endDate, transactions, reservations, books, members);

        const stats = [{ Label: 'Books Added', Value: booksAdded }, { Label: 'Members Joined', Value: newMembers }, { Label: 'Loans Issued', Value: checkouts }, { Label: 'Loans Returned', Value: checkins }];
        const topBooks = popularBooks.slice(0, 5).map((b, i) => ({ Rank: i + 1, Title: b.title, Score: b.score }));
        const topPatrons = popularMembers.slice(0, 5).map((m, i) => ({ Rank: i + 1, Name: m.name, Activity: m.count }));

        downloadSummaryPDF(`Monthly Summary - ${label}`, stats, topBooks, topPatrons);
    };

    const renderContent = () => {
        switch (activeView) {
            case 'menu':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
                        <div className="md:col-span-2 lg:col-span-3 pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
                             <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Reports & Analytics</h2>
                        </div>
                        <div onClick={() => setActiveView('monthlySummary')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-indigo-600 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><DownloadIcon className="h-5 w-5"/> Monthly Summary PDF</h3>
                             <p className="text-slate-500 text-sm mt-2">Generate official monthly operations report.</p>
                        </div>
                        <div onClick={() => setActiveView('activityLog')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-cyan-500 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5"/> Activity Audit Log</h3>
                             <p className="text-slate-500 text-sm mt-2">View and download system activity logs.</p>
                        </div>
                        <div onClick={() => setActiveView('memberReport')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-blue-500 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><UserIcon className="h-5 w-5"/> Member Reports</h3>
                             <p className="text-slate-500 text-sm mt-2">Download individual member engagement data.</p>
                        </div>
                        <div className="md:col-span-2 lg:col-span-3 py-2 border-b border-slate-200 dark:border-slate-700 mb-2 mt-4">
                             <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Data Management</h2>
                        </div>
                        <div onClick={() => setActiveView('allBooks')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-violet-500 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><BookOpenIcon className="h-5 w-5"/> Manage All Books</h3>
                             <p className="text-slate-500 text-sm mt-2">Edit, Delete, and Export the full catalog.</p>
                        </div>
                        <div onClick={() => setActiveView('manageMembers')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-pink-500 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><UsersIcon className="h-5 w-5"/> Manage Members</h3>
                             <p className="text-slate-500 text-sm mt-2">Update contact info or download member lists.</p>
                        </div>
                        <div onClick={() => setActiveView('archiveHistory')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-gray-500 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><TrashIcon className="h-5 w-5"/> Deleted Items</h3>
                             <p className="text-slate-500 text-sm mt-2">Access records and history of deleted items.</p>
                        </div>
                         <div onClick={() => setActiveView('settings')} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border-t-4 border-t-slate-500 cursor-pointer hover:shadow-lg transition-all">
                             <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><CogIcon className="h-5 w-5"/> System Settings</h3>
                             <p className="text-slate-500 text-sm mt-2">Loan periods, renewals, and system reset.</p>
                        </div>
                    </div>
                );
            case 'allBooks':
                return (
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <div className="relative flex-1 max-w-md">
                                <input type="text" placeholder="Search ID, title or ISBN..." value={bookSearchTerm} onChange={e => setBookSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-lg" />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            </div>
                            <DownloadControl onDownload={(fmt) => handleDownloadAllBooks(fmt)} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                <thead className="bg-slate-50 dark:bg-slate-800">
                                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <th className="px-4 py-3">Book ID</th>
                                        <th className="px-4 py-3">Book Info</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3">Language</th>
                                        <th className="px-4 py-3 text-center">Copies</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredBooks.map(b => (
                                        <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-4 font-mono text-xs font-bold text-indigo-600">{b.id}</td>
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white">{b.title}</div>
                                                <div className="text-xs text-slate-500">{b.author} • ISBN: {b.isbn}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {b.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">{b.language}</td>
                                            <td className="px-4 py-4 text-center font-bold text-slate-700 dark:text-slate-300">{b.totalCopies}</td>
                                            <td className="px-4 py-4 text-right space-x-2">
                                                <button onClick={() => { setBookToEdit(b); setEditBookData({ ...b }); }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition"><PencilIcon className="h-4 w-4"/></button>
                                                <button onClick={() => setBookToDelete(b)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"><TrashIcon className="h-4 w-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                );
            case 'manageMembers':
                return (
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <div className="relative flex-1 max-w-md">
                                <input type="text" placeholder="Search members..." value={memberSearchTerm} onChange={e => setMemberSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-lg" />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            </div>
                            <DownloadControl onDownload={(fmt) => handleDownloadMembers(fmt)} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                <thead>
                                    <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <th className="px-4 py-3">Member Details</th>
                                        <th className="px-4 py-3">Contact</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredMembers.map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-slate-900 dark:text-white">{m.name}</div>
                                                <div className="text-xs text-slate-500">ID: {m.id}</div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm text-slate-600 dark:text-slate-400">{m.email}</div>
                                                <div className="text-xs text-slate-500">{m.phoneNumber}</div>
                                            </td>
                                            <td className="px-4 py-4 text-right space-x-2">
                                                <button onClick={() => { setMemberToEdit(m); setEditMemberData({ ...m }); }} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition"><PencilIcon className="h-4 w-4"/></button>
                                                <button onClick={() => setMemberToDelete(m)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"><TrashIcon className="h-4 w-4"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                );
            case 'activityLog':
                return (
                    <Card>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Audit Log</h2>
                            <button onClick={handleDownloadActivityLog} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2">
                                <DownloadIcon className="h-4 w-4"/> Download PDF
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                <thead>
                                    <tr className="text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        <th className="px-4 py-3 w-32">Timestamp</th>
                                        <th className="px-4 py-3 w-40">Action</th>
                                        <th className="px-4 py-3">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-5 dark:divide-slate-800">
                                    {activityLog.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">{format(parseISO(log.timestamp), 'dd/MM HH:mm:ss')}</td>
                                            <td className="px-4 py-4 font-bold text-slate-800 dark:text-indigo-400 text-xs">{log.action}</td>
                                            <td className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400">
                                                {log.details.includes('Batch #') ? (
                                                    <button 
                                                        onClick={() => setViewingLogEntry(log)}
                                                        className="text-indigo-600 hover:underline font-bold"
                                                    >
                                                        View Batch Details
                                                    </button>
                                                ) : (
                                                    log.details
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                );
            case 'memberReport':
                return (
                    <Card>
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Engagement Analytics</h2>
                            <button onClick={handleDownloadMemberReport} disabled={!selectedMemberId} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50">
                                <DownloadIcon className="h-4 w-4"/> Export Report PDF
                            </button>
                        </div>
                        <select onChange={e => setSelectedMemberId(e.target.value)} value={selectedMemberId} className="w-full p-3 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-bold mb-6">
                            <option value="">Select member to audit...</option>
                            {members.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                        </select>
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                                <thead className="bg-slate-5 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr><th className="px-6 py-4 text-left">Date</th><th className="px-6 py-4 text-left">Action</th><th className="px-6 py-4 text-left">Resource</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-5 dark:divide-slate-800">
                                    {memberActivityHistory.map((h, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-6 py-4 text-xs text-slate-500">{h.date}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-300">{h.type}</td>
                                            <td className="px-6 py-4 text-xs text-slate-500 italic">{h.resource}</td>
                                        </tr>
                                    ))}
                                    {memberActivityHistory.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-slate-400">No records found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                );
            case 'archiveHistory':
                return (
                    <Card title="System Archive (Deleted Items)">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                                <thead className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">History Summary</th><th className="px-4 py-3 text-left">Date Deleted</th><th className="px-4 py-3"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-5 dark:divide-slate-800">
                                    {archiveHistory.map(a => (
                                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                            <td className="px-4 py-4 text-[10px] font-black text-slate-500">{a.type.split('_')[0]}</td>
                                            <td className="px-4 py-4 text-sm font-bold text-slate-700 dark:text-white">{a.itemName} ({a.itemId})</td>
                                            <td className="px-4 py-4 text-xs text-slate-500 max-w-xs truncate">
                                                {a.history ? (
                                                    <span>{a.history.transactions.length} trans, {a.history.reservations.length} res</span>
                                                ) : 'N/A'}
                                            </td>
                                            <td className="px-4 py-4 text-xs text-slate-500">{format(parseISO(a.deletedAt), 'dd/MM/yyyy HH:mm')}</td>
                                            <td className="px-4 py-4 text-right">
                                                {a.history && (
                                                    <button 
                                                        onClick={() => setViewingArchiveHistory(a)}
                                                        className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                                                    >
                                                        View Full History
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {archiveHistory.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-slate-400 italic">No deleted items to display.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                );
            case 'monthlySummary':
                return (
                    <Card title="Operational Performance Report">
                         <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
                            <div className="w-full sm:w-64">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Reporting Month</label>
                                <input type="month" value={summaryMonth} onChange={e => setSummaryMonth(e.target.value)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                            </div>
                            <button onClick={handleGenerateMonthlySummary} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all">
                                <DownloadIcon className="h-5 w-5" /> Download Summary PDF
                            </button>
                        </div>
                    </Card>
                );
            case 'settings':
                return (
                    <Card title="System Configuration">
                        <div className="space-y-8">
                            <div className="max-w-md space-y-4">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Loan Rules</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Loan Period (Days)</label>
                                        <input type="number" value={loanPeriodInput} onChange={e => setLoanPeriodInput(e.target.value)} className="mt-1 block w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Max Renewals</label>
                                        <input type="number" value={maxRenewalsInput} onChange={e => setMaxRenewalsInput(e.target.value)} className="mt-1 block w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleUpdateSettings} 
                                    disabled={isSettingsSubmitting}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                                >
                                    {isSettingsSubmitting ? 'Saving...' : 'Update Rules'}
                                </button>
                            </div>

                            <div className="pt-8 border-t border-slate-200 dark:border-slate-700 max-w-md">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Change Admin Password</h3>
                                <div className="space-y-4">
                                    <input type="password" placeholder="New Password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                                    <input type="password" placeholder="Confirm Password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="w-full px-4 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700" />
                                    <button 
                                        onClick={handleAdminPassUpdate} 
                                        disabled={isPassSubmitting}
                                        className="px-6 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-900 transition disabled:opacity-50"
                                    >
                                        {isPassSubmitting ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-bold text-rose-600 mb-2">Danger Zone</h3>
                                <p className="text-sm text-slate-500 mb-4">Erases all library data. This action is irreversible.</p>
                                <button onClick={() => setResetStep(1)} className="px-6 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition">Reset Entire Database</button>
                            </div>
                        </div>
                    </Card>
                );
            default: return null;
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 bg-slate-50 dark:bg-slate-950 z-20 py-2">
                <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Management Console</h1>
                {activeView !== 'menu' && (
                    <button onClick={() => setActiveView('menu')} className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 transition-colors bg-white dark:bg-slate-900 px-4 py-2 rounded-full shadow-sm border">
                        ← Back to Menu
                    </button>
                )}
            </div>
            {renderContent()}

            <Modal
                isOpen={!!viewingLogEntry}
                onClose={() => setViewingLogEntry(null)}
                onConfirm={() => setViewingLogEntry(null)}
                title="Batch Details"
                confirmText="Close"
                confirmButtonClass="bg-indigo-600"
            >
                <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-500">
                        Date: {viewingLogEntry && format(parseISO(viewingLogEntry.timestamp), 'PPP p')}
                    </p>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
                        {viewingLogEntry?.details}
                    </div>
                </div>
            </Modal>

            <Modal 
                isOpen={!!viewingArchiveHistory} 
                onClose={() => setViewingArchiveHistory(null)} 
                onConfirm={() => setViewingArchiveHistory(null)}
                title={`History: ${viewingArchiveHistory?.itemName}`}
                confirmText="Done"
                confirmButtonClass="bg-indigo-600"
            >
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {viewingArchiveHistory?.history?.transactions && viewingArchiveHistory.history.transactions.length > 0 ? (
                        <div className="space-y-2">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Transactions</h4>
                            <div className="space-y-2">
                                {viewingArchiveHistory.history.transactions
                                    .sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())
                                    .map(t => (
                                        <div key={t.id} className="p-2 bg-slate-50 dark:bg-slate-900 rounded border text-xs">
                                            <div className="flex justify-between font-bold">
                                                <span>{t.type === TransactionType.CheckOut ? 'Check Out' : 'Check In'}</span>
                                                <span className="text-slate-400 font-mono">{format(parseISO(t.date), 'dd/MM/yyyy HH:mm')}</span>
                                            </div>
                                            <div className="mt-1">Book: {t.bookTitle}</div>
                                            <div>Member ID: {t.memberId}</div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : null}

                    {viewingArchiveHistory?.history?.reservations && viewingArchiveHistory.history.reservations.length > 0 ? (
                        <div className="space-y-2 pt-2">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Reservations</h4>
                            <div className="space-y-2">
                                {viewingArchiveHistory.history.reservations
                                    .sort((a,b) => parseISO(b.reservationDate).getTime() - parseISO(a.reservationDate).getTime())
                                    .map(r => (
                                        <div key={r.id} className="p-2 bg-slate-50 dark:bg-slate-900 rounded border text-xs">
                                            <div className="flex justify-between font-bold">
                                                <span>Reservation ({r.status})</span>
                                                <span className="text-slate-400 font-mono">{format(parseISO(r.reservationDate), 'dd/MM/yyyy')}</span>
                                            </div>
                                            <div className="mt-1">Pickup Date: {format(parseISO(r.pickupDate), 'dd/MM/yyyy')}</div>
                                            <div>Member ID: {r.memberId}</div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : null}

                    {(!viewingArchiveHistory?.history?.transactions?.length && !viewingArchiveHistory?.history?.reservations?.length) && (
                        <p className="text-center text-slate-400 italic py-8">No specific interaction history captured for this record.</p>
                    )}
                </div>
            </Modal>

            {/* Modals for Deletion */}
            <Modal 
                isOpen={!!bookToDelete} 
                onClose={() => !isBookSubmitting && setBookToDelete(null)} 
                onConfirm={handleDeleteBook} 
                title="Confirm Deletion" 
                confirmText={isBookSubmitting ? "Deleting..." : "Delete Forever"}
                confirmDisabled={isBookSubmitting}
            >
                <p>Delete <strong>{bookToDelete?.title}</strong>? All history for this book will be moved to archives.</p>
            </Modal>
            
            <Modal 
                isOpen={!!memberToDelete} 
                onClose={() => !isMemberSubmitting && setMemberToDelete(null)} 
                onConfirm={handleDeleteMember} 
                title="Confirm Deletion" 
                confirmText={isMemberSubmitting ? "Deleting..." : "Delete Member"}
                confirmDisabled={isMemberSubmitting}
            >
                <p>Removing <strong>{memberToDelete?.name}</strong> will move their activity to the system archive.</p>
            </Modal>
            
            {/* Modal for Edit Book */}
            <Modal 
                isOpen={!!bookToEdit} 
                onClose={() => !isBookSubmitting && setBookToEdit(null)} 
                onConfirm={handleUpdateBook} 
                title="Edit Book" 
                confirmText={isBookSubmitting ? "Updating..." : "Update Record"} 
                confirmButtonClass="bg-indigo-600"
                confirmDisabled={isBookSubmitting}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">Book ID:</span>
                        <span className="text-xs font-mono font-bold text-indigo-600">{bookToEdit?.id}</span>
                    </div>
                    <input value={editBookData.title} onChange={e => setEditBookData({...editBookData, title: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Title" />
                    <input value={editBookData.author} onChange={e => setEditBookData({...editBookData, author: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Author" />
                    <input value={editBookData.isbn} onChange={e => setEditBookData({...editBookData, isbn: e.target.value})} className="w-full p-2 border rounded-md" placeholder="ISBN" />
                    <input value={editBookData.category} onChange={e => setEditBookData({...editBookData, category: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Category" /> 
                    <input value={editBookData.language} onChange={e => setEditBookData({...editBookData, language: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Language" />
                    <input type="number" value={editBookData.totalCopies} onChange={e => setEditBookData({...editBookData, totalCopies: parseInt(e.target.value)})} className="w-full p-2 border rounded-md" placeholder="Copies" />
                </div>
            </Modal>

            {/* Modal for Edit Member */}
            <Modal 
                isOpen={!!memberToEdit} 
                onClose={() => !isMemberSubmitting && setMemberToEdit(null)} 
                onConfirm={handleUpdateMember} 
                title="Edit Member" 
                confirmText={isMemberSubmitting ? "Updating..." : "Update Profile"} 
                confirmButtonClass="bg-indigo-600"
                confirmDisabled={isMemberSubmitting}
            >
                <div className="space-y-4">
                    <input value={editMemberData.id} onChange={e => setEditMemberData({...editMemberData, id: e.target.value})} className="w-full p-2 border rounded-md font-mono" placeholder="4-digit ID" maxLength={4} />
                    <input value={editMemberData.name} onChange={e => setEditMemberData({...editMemberData, name: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Name" />
                    <input value={editMemberData.email} onChange={e => setEditMemberData({...editMemberData, email: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Email" />
                    <input value={editMemberData.phoneNumber} onChange={e => setEditMemberData({...editMemberData, phoneNumber: e.target.value})} className="w-full p-2 border rounded-md" placeholder="Phone" />
                </div>
            </Modal>

            {/* --- SYSTEM RESET MULTI-STEP MODALS --- */}
            
            {/* Step 1: Warning + Checkbox */}
            <Modal
                isOpen={resetStep === 1}
                onClose={() => setResetStep(0)}
                onConfirm={() => setResetStep(2)}
                title="Critical Warning"
                confirmText="Continue"
                confirmButtonClass="bg-indigo-600"
                confirmDisabled={!resetCheck}
            >
                <div className="space-y-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md border border-red-200">
                        <ExclamationTriangleIcon className="h-6 w-6 mb-2" />
                        <p className="font-bold">You are about to reset the entire library system.</p>
                        <p className="text-sm mt-1">This will permanently delete all books, members, transactions, and history logs. This action cannot be reversed.</p>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={resetCheck} onChange={(e) => setResetCheck(e.target.checked)} className="h-5 w-5 text-indigo-600 rounded" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">I understand that all data will be lost forever.</span>
                    </label>
                </div>
            </Modal>

            {/* Step 2: Password Prompt */}
            <Modal
                isOpen={resetStep === 2}
                onClose={() => setResetStep(0)}
                onConfirm={() => handleResetVerification()}
                title="Librarian Authentication"
                confirmText="Verify Password"
                confirmButtonClass="bg-indigo-600"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Please enter your librarian password to authorize this sensitive action.</p>
                    <input 
                        type="password" 
                        value={resetPassInput} 
                        onChange={(e) => setResetPassInput(e.target.value)} 
                        className="w-full p-3 border rounded-xl dark:bg-slate-700 dark:border-slate-600" 
                        placeholder="Librarian Password"
                    />
                </div>
            </Modal>

            {/* Step 3: Final OK */}
            <Modal
                isOpen={resetStep === 3}
                onClose={() => !isResetSubmitting && setResetStep(0)}
                onConfirm={handleSystemReset}
                title="Final Confirmation"
                confirmText={isResetSubmitting ? "Resetting..." : "Reset Now"}
                confirmButtonClass="bg-red-600"
                confirmDisabled={isResetSubmitting}
            >
                <div className="space-y-3">
                    <p className="font-black text-red-600 text-xl text-center">LAST CHANCE</p>
                    <p className="text-center text-slate-700 dark:text-slate-300">Clicking 'Reset Now' will initiate the data wipe immediately.</p>
                </div>
            </Modal>

        </div>
    );
};

export default Manage;