import React, { useState, useMemo } from 'react';
import { Book, Member, Transaction, Reservation, TransactionType, Settings } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { SearchIcon, BookOpenIcon, BookmarkIcon, SparklesIcon, HistoryIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import { addDays, format, parseISO, startOfDay, isAfter, subDays, differenceInDays, isBefore } from 'date-fns';
import { getBookRecommendations, Recommendation } from '../lib/gemini';

interface MemberDashboardProps {
    currentMember: Member;
    books: Book[];
    transactions: Transaction[];
    reservations: Reservation[];
    onCancelReservation: (reservationId: string) => { success: boolean; message: string };
    onRenewLoan?: (transactionId: string) => { success: boolean; message: string };
    showNotification: (message: string, type: 'success' | 'error') => void;
    settings?: Settings;
}

const StatusPill: React.FC<{ status: string, detail?: string, colorClass: string }> = ({ status, detail, colorClass }) => (
    <div className="flex flex-col items-start gap-1">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${colorClass}`}>
            {status}
        </span>
        {detail && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic ml-1 leading-tight">{detail}</span>}
    </div>
);

const MemberDashboard: React.FC<MemberDashboardProps> = ({ currentMember, books, transactions, reservations, onCancelReservation, onRenewLoan, showNotification, settings }) => {
    const [activeTab, setActiveTab] = useState<'browse' | 'loans' | 'reservations'>('browse');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    
    const [aiRecs, setAiRecs] = useState<Recommendation[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    
    const [resToCancel, setResToCancel] = useState<Reservation | null>(null);

    const categories = useMemo(() => Array.from(new Set(books.map(b => b.category))).sort(), [books]);
    const loanPeriodDays = settings?.loanPeriodDays || 15;

    // Logic to find books currently held by the member
    const myActiveLoans = useMemo(() => {
        const active: Transaction[] = [];
        const bookTransactions = transactions.filter(t => t.memberId === currentMember.id);
        const uniqueBookIds = Array.from(new Set(bookTransactions.map(t => t.bookId)));
        
        uniqueBookIds.forEach(bid => {
            const history = bookTransactions
                .filter(t => t.bookId === bid)
                .sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
            
            const currentStack: Transaction[] = [];
            history.forEach(t => {
                if (t.type === TransactionType.CheckOut) {
                    currentStack.push(t);
                } else {
                    currentStack.pop();
                }
            });
            active.push(...currentStack);
        });
        return active.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    }, [transactions, currentMember.id]);

    const myActiveReservations = useMemo(() => 
        reservations.filter(r => r.memberId === currentMember.id && r.status === 'Active')
            .sort((a,b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime())
    , [reservations, currentMember.id]);

    const totalHistoryCount = useMemo(() => 
        transactions.filter(t => t.memberId === currentMember.id).length + 
        reservations.filter(r => r.memberId === currentMember.id).length
    , [transactions, reservations, currentMember.id]);

    const handleGetAiRecommendations = async () => {
        if (totalHistoryCount < 3) return;
        setIsAiLoading(true);
        const history = [
            ...transactions.filter(t => t.memberId === currentMember.id),
            ...reservations.filter(r => r.memberId === currentMember.id)
        ];
        const recs = await getBookRecommendations(history, books);
        setAiRecs(recs);
        setIsAiLoading(false);
    };

    const getBookStatusInfo = (book: Book) => {
        const checkoutCounts = transactions.filter(t => t.bookId === book.id && t.type === TransactionType.CheckOut).length;
        const checkinCounts = transactions.filter(t => t.bookId === book.id && t.type === TransactionType.CheckIn).length;
        const currentlyCheckedOutCount = Math.max(0, checkoutCounts - checkinCounts);
        const onShelf = Math.max(0, book.totalCopies - currentlyCheckedOutCount);

        const myActiveLoan = transactions.find(t => 
            t.bookId === book.id && 
            t.memberId === currentMember.id && 
            t.type === TransactionType.CheckOut && 
            !transactions.some(ti => ti.bookId === book.id && ti.memberId === currentMember.id && ti.type === TransactionType.CheckIn && parseISO(ti.date) > parseISO(t.date))
        );
        if (myActiveLoan) {
            return { 
                status: 'In Your Care', 
                detail: `Due: ${format(addDays(parseISO(myActiveLoan.date), loanPeriodDays), 'dd/MM/yyyy')}`, 
                colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800', 
                onShelf 
            };
        }

        const myReservation = reservations.find(r => r.bookId === book.id && r.memberId === currentMember.id && r.status === 'Active');
        if (myReservation) {
            return { 
                status: 'Reserved by You', 
                detail: `Pickup: ${format(parseISO(myReservation.pickupDate), 'dd/MM/yyyy')}`, 
                colorClass: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800', 
                onShelf 
            };
        }

        const allActiveReservations = reservations
            .filter(r => r.bookId === book.id && r.status === 'Active')
            .sort((a, b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime());

        if (onShelf > 0) {
            if (onShelf > allActiveReservations.length) {
                return { 
                    status: 'Available', 
                    detail: `Standard 15-day loan`, 
                    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800', 
                    onShelf 
                };
            } else {
                const soonestReservation = allActiveReservations[onShelf - 1];
                const pickupDate = startOfDay(parseISO(soonestReservation.pickupDate));
                const tomorrow = startOfDay(addDays(new Date(), 1));
                
                if (isAfter(pickupDate, tomorrow)) {
                    const daysAvailable = differenceInDays(pickupDate, new Date());
                    return {
                        status: 'Short-term Loan',
                        detail: `Available until ${format(subDays(pickupDate, 1), 'dd/MM/yyyy')} (${daysAvailable} days)`,
                        colorClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
                        onShelf
                    };
                }
            }
        }

        return { 
            status: 'Unavailable', 
            detail: 'All copies are currently borrowed', 
            colorClass: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700', 
            onShelf 
        };
    };

    const handleCancelClick = () => {
        if (resToCancel) {
            const res = onCancelReservation(resToCancel.id);
            showNotification(res.message, res.success ? 'success' : 'error');
            setResToCancel(null);
        }
    };

    const filteredBooks = useMemo(() => books.filter(book => (book.title.toLowerCase().includes(searchTerm.toLowerCase()) || book.author.toLowerCase().includes(searchTerm.toLowerCase())) && (categoryFilter === 'All' || book.category === categoryFilter)), [books, searchTerm, categoryFilter]);
    
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Blue Gradient Welcome Card - Photo Icon Removed */}
            <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 rounded-2xl p-8 text-white shadow-xl shadow-indigo-200 dark:shadow-none animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-48 w-48 rounded-full bg-blue-400/20 blur-2xl"></div>
                <div className="relative">
                    <h1 className="text-3xl font-black tracking-tight">Welcome, {currentMember.name}</h1>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-3">
                        <p className="text-indigo-100/80 font-medium">Patron ID: <span className="font-mono">{currentMember.id}</span></p>
                        <p className="text-xs text-indigo-100/60 flex items-center gap-1.5 uppercase tracking-widest font-bold">
                            <SparklesIcon className="h-3 w-3" /> Patron since {format(parseISO(currentMember.joinDate), 'dd MMMM yyyy')}
                        </p>
                    </div>
                </div>
            </div>

            {/* AI Reading Compass Section */}
            <Card className="border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/5">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                            <SparklesIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Your Reading Compass</h2>
                            <p className="text-xs text-slate-500 font-medium">Curated selections just for you from our catalog</p>
                        </div>
                    </div>
                    {aiRecs.length === 0 && !isAiLoading && (
                        <button 
                            onClick={handleGetAiRecommendations}
                            disabled={totalHistoryCount < 3}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Discover My Next Read
                        </button>
                    )}
                </div>

                {isAiLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                        <div className="h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        <p className="text-sm font-bold text-indigo-600 animate-pulse">Personalizing your recommendations...</p>
                    </div>
                ) : aiRecs.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                        {aiRecs.map((rec, i) => {
                            const book = books.find(b => b.title.toLowerCase() === rec.title.toLowerCase());
                            const status = book ? getBookStatusInfo(book) : null;
                            return (
                                <div key={i} className="flex flex-col bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors leading-tight">{rec.title}</h3>
                                        {status && (
                                            <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter border ${status.colorClass}`}>
                                                {status.status}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                        {rec.language}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 italic leading-relaxed border-l-2 border-indigo-100 dark:border-indigo-900 pl-3">
                                        "{rec.reason}"
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ) : totalHistoryCount < 3 && (
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                        <p className="text-sm text-slate-500 font-medium italic">Borrow 3 or more books to unlock the AI Reading Compass!</p>
                    </div>
                )}
            </Card>

            {/* Navigation Tabs */}
            <div className="flex space-x-6 border-b border-slate-200 dark:border-slate-800 px-2 overflow-x-auto scrollbar-hide">
                <button onClick={() => setActiveTab('browse')} className={`pb-3 px-1 font-bold text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'browse' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <BookOpenIcon className="h-4 w-4" /> Browse Catalog
                </button>
                <button onClick={() => setActiveTab('loans')} className={`pb-3 px-1 font-bold text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'loans' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <HistoryIcon className="h-4 w-4" /> Active Loans ({myActiveLoans.length})
                </button>
                <button onClick={() => setActiveTab('reservations')} className={`pb-3 px-1 font-bold text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'reservations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <BookmarkIcon className="h-4 w-4" /> My Reservations ({myActiveReservations.length})
                </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'browse' && (
                <Card className="overflow-hidden p-0 rounded-2xl">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 bg-slate-50/30 dark:bg-slate-800/20">
                        <div className="relative flex-grow">
                            <input 
                                type="text" 
                                placeholder="Search by title, author, isbn..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)} 
                                className="w-full pl-10 pr-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-shadow shadow-sm" 
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                        </div>
                        <select 
                            value={categoryFilter} 
                            onChange={e => setCategoryFilter(e.target.value)} 
                            className="md:w-64 px-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-xl font-medium shadow-sm"
                        >
                            <option value="All">All Categories</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                            <thead>
                                <tr className="text-left text-xs font-black text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900">
                                    <th className="px-8 py-5">Book Details</th>
                                    <th className="px-6 py-5 text-center">Language</th>
                                    <th className="px-6 py-5 text-center">Copies</th>
                                    <th className="px-8 py-5">Availability</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {filteredBooks.map(book => {
                                    const { status, detail, colorClass, onShelf } = getBookStatusInfo(book);
                                    return (
                                        <tr key={book.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="font-bold text-slate-900 dark:text-white text-base">{book.title}</div>
                                                <div className="text-xs font-semibold text-slate-400 mt-1">{book.author} • {book.category}</div>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                    {book.language}
                                                </span>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    <span className={onShelf > 0 ? 'text-emerald-600' : 'text-slate-400'}>{onShelf}</span>
                                                    <span className="mx-1 opacity-20">/</span>
                                                    <span className="opacity-50">{book.totalCopies}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <StatusPill status={status} detail={detail} colorClass={colorClass} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {activeTab === 'loans' && (
                <Card title="My Active Loans">
                    {myActiveLoans.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                                <thead className="text-left text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="px-4 py-4">Book Title</th>
                                        <th className="px-4 py-4">Borrowed On</th>
                                        <th className="px-4 py-4 text-right">Due Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {myActiveLoans.map(loan => {
                                        const dueDate = loan.dueDate ? parseISO(loan.dueDate) : addDays(parseISO(loan.date), loanPeriodDays);
                                        const isOverdue = isBefore(dueDate, new Date());
                                        const daysLeft = differenceInDays(dueDate, new Date());
                                        
                                        return (
                                            <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                                <td className="px-4 py-5">
                                                    <div className="font-bold text-slate-800 dark:text-white">{loan.bookTitle}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{loan.bookId}</div>
                                                </td>
                                                <td className="px-4 py-5 text-sm text-slate-500">{format(parseISO(loan.date), 'dd/MM/yyyy')}</td>
                                                <td className="px-4 py-5 text-right">
                                                    <div className={`font-bold text-sm ${isOverdue ? 'text-red-600' : 'text-slate-800 dark:text-slate-200'}`}>
                                                        {format(dueDate, 'dd MMMM yyyy')}
                                                    </div>
                                                    <div className={`text-[10px] font-black uppercase tracking-tighter ${isOverdue ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                                                        {isOverdue ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft === 0 ? 'Due Today' : `${daysLeft} days remaining`}`}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-16 text-center">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 inline-block rounded-full mb-4">
                                <HistoryIcon className="h-10 w-10 text-slate-200" />
                            </div>
                            <p className="text-slate-500 font-bold">You don't have any books checked out at the moment.</p>
                            <button onClick={() => setActiveTab('browse')} className="mt-4 text-indigo-600 font-bold hover:underline">Explore the catalog</button>
                        </div>
                    )}
                </Card>
            )}

            {activeTab === 'reservations' && (
                <Card title="My Reservations Queue">
                    {myActiveReservations.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                                <thead className="text-left text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="px-4 py-4">Book Title</th>
                                        <th className="px-4 py-4">Placed On</th>
                                        <th className="px-4 py-4">Pickup By</th>
                                        <th className="px-4 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                    {myActiveReservations.map(res => {
                                        const book = books.find(b => b.id === res.bookId);
                                        return (
                                            <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                                <td className="px-4 py-5">
                                                    <div className="font-bold text-slate-800 dark:text-white">{book?.title || 'Unknown Book'}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-tighter font-bold">ISBN: {book?.isbn}</div>
                                                </td>
                                                <td className="px-4 py-5 text-sm text-slate-500">{format(parseISO(res.reservationDate), 'dd/MM/yyyy')}</td>
                                                <td className="px-4 py-5 text-sm font-bold text-amber-600">{format(parseISO(res.pickupDate), 'dd MMMM yyyy')}</td>
                                                <td className="px-4 py-5 text-right">
                                                    <button 
                                                        onClick={() => setResToCancel(res)}
                                                        className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
                                                        title="Cancel Reservation"
                                                    >
                                                        <TrashIcon className="h-5 w-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-16 text-center">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 inline-block rounded-full mb-4">
                                <BookmarkIcon className="h-10 w-10 text-slate-200" />
                            </div>
                            <p className="text-slate-500 font-bold">You don't have any active reservations.</p>
                        </div>
                    )}
                </Card>
            )}

            {/* Cancel Confirmation Modal */}
            <Modal
                isOpen={!!resToCancel}
                onClose={() => setResToCancel(null)}
                onConfirm={handleCancelClick}
                title="Cancel Reservation?"
                confirmText="Yes, Cancel"
                confirmButtonClass="bg-red-600 hover:bg-red-700"
            >
                <p>Are you sure you want to release your reservation for <strong>{books.find(b => b.id === resToCancel?.bookId)?.title}</strong>?</p>
                <p className="text-sm text-slate-500 mt-2">This will remove you from the priority queue for this book.</p>
            </Modal>
        </div>
    );
};

export default MemberDashboard;