import React, { useState, useMemo, useEffect } from 'react';
import { Reservation, Book, Member, BookStatus, Transaction, TransactionType, Settings } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { format, parseISO, addDays, isAfter, startOfDay, isBefore, isValid, subDays, differenceInDays } from 'date-fns';
import { SearchIcon, ExclamationTriangleIcon, PencilIcon } from './icons';

interface BookWithAvailability extends Book {
    availableCopies: number;
    status: BookStatus;
}

interface ReserveBookProps {
    settings: Settings;
    reservations: Reservation[];
    books: Book[];
    members: Member[];
    categories: string[];
    booksWithAvailability: BookWithAvailability[];
    transactions: Transaction[];
    // ✅ Updated types to return Promise
    onReserveBook: (reservation: { bookId: string; memberId: string; pickupDate: string; }) => Promise<{ success: boolean; message: string }>;
    onCancelReservation: (reservationId: string) => Promise<{ success: boolean; message: string }>;
    onIssueBook: (reservationId: string) => Promise<{ success: boolean; message: string }>;
    onUpdateReservationDate: (reservationId: string, newPickupDate: string) => Promise<{ success: boolean; message: string }>;
    showNotification: (message: string, type: 'success' | 'error') => void;
}

const MemberSearchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (member: Member) => void;
    members: Member[];
}> = ({ isOpen, onClose, onSelect, members }) => {
    const [searchTerm, setSearchTerm] = useState('');
    if (!isOpen) return null;

    const filteredMembers = members.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (e: React.MouseEvent, member: Member) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(member);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[1060] flex justify-center items-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Search Member</h2>
                <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 mb-4 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md"
                />
                <ul className="overflow-y-auto space-y-2">
                    {filteredMembers.map(member => (
                        <li 
                            key={member.id} 
                            onClick={(e) => handleSelect(e, member)} 
                            className="p-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-600 transition-colors"
                        >
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{member.id} - {member.name}</p>
                            <p className="text-sm text-slate-500">{member.email || 'No email'} • {member.phoneNumber}</p>
                        </li>
                    ))}
                    {filteredMembers.length === 0 && <li className="text-slate-500 text-center py-2">No members found.</li>}
                </ul>
                <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-md self-end">Close</button>
            </div>
        </div>
    );
};

const getStatusChip = (status: BookStatus) => {
    switch (status) {
        case BookStatus.OnShelf:
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Available</span>;
        case BookStatus.Reserved:
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Reserved</span>;
        case BookStatus.Unavailable:
            return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Unavailable</span>;
        default:
            return null;
    }
};


const ReserveBook: React.FC<ReserveBookProps> = ({ 
    settings,
    reservations, 
    books, 
    members, 
    categories,
    booksWithAvailability,
    transactions,
    onReserveBook, 
    onCancelReservation,
    onIssueBook,
    onUpdateReservationDate,
    showNotification 
}) => {
    const [memberId, setMemberId] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [pickupDate, setPickupDate] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    
    const [reservationSearchTerm, setReservationSearchTerm] = useState('');

    const [bookToReserve, setBookToReserve] = useState<Book | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    
    const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    // Edit Date State
    const [resToEdit, setResToEdit] = useState<Reservation | null>(null);
    const [newEditDate, setNewEditDate] = useState('');
    const [maxEditDateInfo, setMaxEditDateInfo] = useState<{ date: Date, isReservationLimit: boolean, limitedByMember?: string } | null>(null);
    
    // New state for issuing confirmation
    const [issueConfirmModalOpen, setIssueConfirmModalOpen] = useState(false);
    const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
    
    const [issueWarningData, setIssueWarningData] = useState<{
        conflictingMemberId: string;
        conflictingMemberName: string;
        conflictingPickupDate: string;
        currentReservationId: string;
    } | null>(null);

    const [isMemberSearchOpen, setIsMemberSearchOpen] = useState(false);

    useEffect(() => {
        if (memberId) {
            const member = members.find(m => m.id === memberId);
            setSelectedMember(member || null);
        } else {
            setSelectedMember(null);
        }
    }, [memberId, members]);

    const filteredBooks = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        return booksWithAvailability.filter(book => {
            const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
            const matchesSearch = !searchTerm.trim() ||
                book.title.toLowerCase().includes(lowercasedFilter) ||
                book.author.toLowerCase().includes(lowercasedFilter) ||
                book.isbn.toLowerCase().includes(lowercasedFilter);
            return matchesCategory && matchesSearch;
        });
    }, [booksWithAvailability, searchTerm, selectedCategory]);

    const filteredReservations = useMemo(() => {
        const activeReservations = reservations.filter(res => res.status === 'Active');
        
        if (!reservationSearchTerm.trim()) return activeReservations;
        
        const lowerTerm = reservationSearchTerm.toLowerCase();
        return activeReservations.filter(res => {
            const book = books.find(b => b.id === res.bookId);
            const member = members.find(m => m.id === res.memberId);
            const title = book ? book.title.toLowerCase() : '';
            const memberName = member ? member.name.toLowerCase() : '';
            const mId = res.memberId.toLowerCase();
            return title.includes(lowerTerm) || memberName.includes(lowerTerm) || mId.includes(lowerTerm);
        });
    }, [reservations, reservationSearchTerm, books, members]);

     const calculateEarliestAvailableDate = (book: Book) => {
        const LOAN_PERIOD_DAYS = settings.loanPeriodDays;
        const bookTransactions = transactions.filter(t => t.bookId === book.id);
        const activeCheckouts: Transaction[] = [];
        const memberBookPairs = new Set<string>(bookTransactions.map(t => `${t.memberId}::${t.bookId}`));
        
        memberBookPairs.forEach(pair => {
            const [mId, bId] = (pair as string).split('::');
            const pt = bookTransactions.filter(t => t.memberId === mId && t.bookId === bId).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
            const potential: Transaction[] = [];
            pt.forEach(t => t.type === TransactionType.CheckOut ? potential.push(t) : potential.shift());
            activeCheckouts.push(...potential);
        });

        const copyFreeDates: Date[] = [];
        activeCheckouts.forEach(checkout => {
            const dueDate = checkout.dueDate ? parseISO(checkout.dueDate) : addDays(parseISO(checkout.date), LOAN_PERIOD_DAYS);
            copyFreeDates.push(dueDate);
        });
        const onShelfCopies = book.totalCopies - activeCheckouts.length;
        for (let i = 0; i < onShelfCopies; i++) {
            copyFreeDates.push(new Date(0));
        }
        
        const bookReservations = reservations
            .filter(r => r.bookId === book.id && r.status === 'Active')
            .sort((a, b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime());
        
        const tempCopyFreeDates = [...copyFreeDates].sort((a, b) => a.getTime() - b.getTime());

        bookReservations.forEach(res => {
            const resPickupDate = startOfDay(parseISO(res.pickupDate));
            let assigned = false;
            for (let i = 0; i < tempCopyFreeDates.length; i++) {
                if (tempCopyFreeDates[i] <= resPickupDate) {
                    tempCopyFreeDates[i] = addDays(resPickupDate, LOAN_PERIOD_DAYS);
                    assigned = true;
                    break;
                }
            }
            if(assigned) {
                tempCopyFreeDates.sort((a, b) => a.getTime() - b.getTime());
            }
        });

        const earliestDate = tempCopyFreeDates[0];
        const tomorrow = addDays(new Date(), 1);
        return isAfter(earliestDate, tomorrow) ? earliestDate : tomorrow;
    }

    const calculateMaxPickupDate = (reservation: Reservation) => {
        const book = books.find(b => b.id === reservation.bookId);
        if (!book) return { date: addDays(new Date(), 90), isReservationLimit: false };

        const LOAN_PERIOD_DAYS = settings.loanPeriodDays;
        const bookReservations = reservations
            .filter(r => r.bookId === reservation.bookId && r.status === 'Active')
            .sort((a, b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime());
        
        const currentIndex = bookReservations.findIndex(r => r.id === reservation.id);
        const blockingIndex = currentIndex + book.totalCopies;

        if (blockingIndex < bookReservations.length && blockingIndex >= 0) {
            const blockingRes = bookReservations[blockingIndex];
            const maxDate = subDays(parseISO(blockingRes.pickupDate), LOAN_PERIOD_DAYS);
            const member = members.find(m => m.id === blockingRes.memberId);
            return { 
                date: maxDate, 
                isReservationLimit: true, 
                limitedByMember: member ? member.name : blockingRes.memberId 
            };
        }

        return { date: addDays(new Date(), 90), isReservationLimit: false };
    };

    const handleOpenEditDate = (res: Reservation) => {
        const maxInfo = calculateMaxPickupDate(res);
        setResToEdit(res);
        setNewEditDate(res.pickupDate);
        setMaxEditDateInfo(maxInfo);
    };

    // ✅ FIXED: Added async/await for Date Change
    const handleConfirmDateChange = async () => {
        if (resToEdit && newEditDate) {
            const newDate = parseISO(newEditDate);
            
            // Check for 15-day gap restriction
            const conflictingReservation = reservations.find(r => 
                r.id !== resToEdit.id &&
                r.memberId === resToEdit.memberId && 
                r.status === 'Active' &&
                Math.abs(differenceInDays(newDate, parseISO(r.pickupDate))) < 15
            );

            if (conflictingReservation) {
                const confBook = books.find(b => b.id === conflictingReservation.bookId);
                showNotification(`Cannot update. Member has another reservation for '${confBook?.title || 'Another Book'}' on ${format(parseISO(conflictingReservation.pickupDate), 'dd/MM/yyyy')}. Pickup dates must be at least 15 days apart.`, 'error');
                return;
            }

            const result = await onUpdateReservationDate(resToEdit.id, newEditDate);
            showNotification(result.message, result.success ? 'success' : 'error');
            setResToEdit(null);
        }
    };

    const handleOpenReservationModal = (book: Book) => {
        setBookToReserve(book);
        setMemberId('');
        setSelectedMember(null);
        const earliestDate = calculateEarliestAvailableDate(book);
        setPickupDate(format(earliestDate, 'yyyy-MM-dd'));
        setIsConfirmModalOpen(true);
    };

    const handleSelectMember = (member: Member) => {
        setMemberId(member.id);
        setSelectedMember(member);
        setIsMemberSearchOpen(false);
    };

    // ✅ FIXED: Added async/await for Reservation Submission
    const handleReserveSubmit = async () => {
        if (!bookToReserve || !memberId || !pickupDate) {
            showNotification("An unexpected error occurred. Please try again.", 'error');
            return;
        }
        
        const memberIdClean = memberId.trim();
        const memberExists = members.find(m => m.id === memberIdClean);
        if (!memberExists) {
            showNotification(`Cannot reserve book. Member ID '${memberIdClean}' not found in database.`, 'error');
            return;
        }

        const requestedDate = parseISO(pickupDate);

        // Rule 1: Same person cannot reserve the SAME book twice
        const duplicateBookRes = reservations.find(r => 
            r.memberId === memberIdClean && 
            r.bookId === bookToReserve.id && 
            r.status === 'Active'
        );
        if (duplicateBookRes) {
            showNotification(`Member already has an active reservation for '${bookToReserve.title}'. Cannot reserve the same book multiple times.`, 'error');
            return;
        }

        // Rule 2: 15-day gap check
        const conflictingRes = reservations.find(r => 
            r.memberId === memberIdClean && 
            r.status === 'Active' && 
            Math.abs(differenceInDays(requestedDate, parseISO(r.pickupDate))) < 15
        );
        if (conflictingRes) {
            const confBook = books.find(b => b.id === conflictingRes.bookId);
            showNotification(`Conflict: Member has a reservation for '${confBook?.title || 'Another Book'}' on ${format(parseISO(conflictingRes.pickupDate), 'dd/MM/yyyy')}. Reservations must be at least 15 days apart.`, 'error');
            return;
        }

        // AWAITing the result to ensure we get the success status correctly
        const result = await onReserveBook({ bookId: bookToReserve.id, memberId: memberIdClean, pickupDate });
        showNotification(result.message, result.success ? 'success' : 'error');
        
        if (result.success) {
            setBookToReserve(null);
            setMemberId('');
            setSelectedMember(null);
            setPickupDate('');
            setIsConfirmModalOpen(false);
        }
    };

    const openCancelModal = (reservation: Reservation) => {
        setReservationToCancel(reservation);
        setIsCancelModalOpen(true);
    };

    // ✅ FIXED: Added async/await for Cancellation
    const handleCancelReservation = async () => {
        if (reservationToCancel) {
            const result = await onCancelReservation(reservationToCancel.id);
            showNotification(result.message, result.success ? 'success' : 'error');
        }
        setIsCancelModalOpen(false);
        setReservationToCancel(null);
    };
    
    // ✅ FIXED: Added async/await for Issue Book
    const executeIssueBook = async (reservationId: string) => {
         const result = await onIssueBook(reservationId);
         showNotification(result.message, result.success ? 'success' : 'error');
         setIssueWarningData(null);
         setIssueConfirmModalOpen(false);
         setSelectedReservationId(null);
    };

    const confirmIssue = () => {
        if(selectedReservationId) {
            executeIssueBook(selectedReservationId);
        }
    };

    const handleIssue = (reservationId: string) => {
        const targetReservation = reservations.find(r => r.id === reservationId);
        if (!targetReservation) return;
        const memberExists = members.some(m => m.id === targetReservation.memberId);
        if (!memberExists) {
            showNotification(`Cannot issue book. Member (ID: ${targetReservation.memberId}) not found in database.`, 'error');
            return;
        }
        const sameBookReservations = reservations.filter(r => r.bookId === targetReservation.bookId && r.status === 'Active');
        sameBookReservations.sort((a, b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime());

        if (sameBookReservations.length > 0 && sameBookReservations[0].id !== targetReservation.id) {
            const conflictingRes = sameBookReservations[0];
             if (isBefore(parseISO(conflictingRes.pickupDate), parseISO(targetReservation.pickupDate))) {
                 const conflictingMemberName = members.find(m => m.id === conflictingRes.memberId)?.name || 'Unknown Member';
                 setIssueWarningData({
                     conflictingMemberId: conflictingRes.memberId,
                     conflictingMemberName: conflictingMemberName,
                     conflictingPickupDate: conflictingRes.pickupDate,
                     currentReservationId: reservationId
                 });
                 return;
             }
        }
        setSelectedReservationId(reservationId);
        setIssueConfirmModalOpen(true);
    };

    const getBookTitle = (bookId: string) => books.find(b => b.id === bookId)?.title || 'Unknown Book';
    const getMemberName = (memberId: string) => members.find(m => m.id === memberId)?.name || 'Unknown Member';
    const getFormattedDate = (date: Date | string) => {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return isValid(d) ? format(d, 'dd/MM/yyyy') : '';
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Reserve a Book</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <div className="relative flex-grow">
                                <input
                                    type="text"
                                    placeholder="Search by title, author, or ISBN..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                                className="md:w-1/3 w-full px-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="All">All Categories</option>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                        <div className="overflow-auto max-h-[60vh]">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Title</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Author</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Lang</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="relative px-6 py-3"><span className="sr-only">Reserve</span></th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                                    {filteredBooks.map((book) => (
                                        <tr key={book.id} className="even:bg-slate-50 dark:even:bg-slate-800/50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{book.title}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{book.author}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{book.language}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusChip(book.status)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button 
                                                    onClick={() => handleOpenReservationModal(book)}
                                                    className="text-indigo-600 hover:text-indigo-900 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                                                >
                                                    Reserve
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredBooks.length === 0 && <p className="text-center py-4 text-slate-500">No books match your search criteria.</p>}
                        </div>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                    <Card title="Current Reservations">
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Search active reservations..."
                                value={reservationSearchTerm}
                                onChange={e => setReservationSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>

                        {filteredReservations.length > 0 ? (
                             <ul className="space-y-3 max-h-[70vh] overflow-y-auto">
                                {filteredReservations.map(res => {
                                    return (
                                        <li key={res.id} className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{getBookTitle(res.bookId)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">For: {res.memberId} - {getMemberName(res.memberId)}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Pickup: {format(parseISO(res.pickupDate), 'dd/MM/yyyy')}</p>
                                            <div className="flex justify-end items-center space-x-3 mt-2">
                                                 <button
                                                    onClick={() => handleIssue(res.id)}
                                                    className="text-green-600 hover:text-green-800 text-xs font-medium"
                                                >
                                                    Issue
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditDate(res)}
                                                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center"
                                                >
                                                    <PencilIcon className="h-3 w-3 mr-1" /> Change Date
                                                </button>
                                                <button onClick={() => openCancelModal(res)} className="text-red-600 hover:text-red-800 text-xs font-medium">Cancel</button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        ) : (
                             <p className="text-center py-4 text-slate-500 text-sm">No active reservations found.</p>
                        )}
                    </Card>
                </div>
            </div>
            
            <MemberSearchModal isOpen={isMemberSearchOpen} onClose={() => setIsMemberSearchOpen(false)} onSelect={handleSelectMember} members={members} />

            <Modal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleCancelReservation}
                title="Cancel Reservation"
                confirmText="Yes, Cancel"
            >
                Are you sure you want to cancel the reservation for "{getBookTitle(reservationToCancel?.bookId || '')}"? This action cannot be undone.
            </Modal>

            <Modal
                isOpen={!!resToEdit}
                onClose={() => setResToEdit(null)}
                onConfirm={handleConfirmDateChange}
                title="Update Pickup Date"
                confirmText="Save Date"
                confirmButtonClass="bg-indigo-600 hover:bg-indigo-700"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Adjusting pickup date for <strong>{getBookTitle(resToEdit?.bookId || '')}</strong> reserved by <strong>{getMemberName(resToEdit?.memberId || '')}</strong>.
                    </p>
                    <div>
                        <label htmlFor="new-pickup-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">New Pickup Date</label>
                        <input
                            type="date"
                            id="new-pickup-date"
                            value={newEditDate}
                            onChange={(e) => setNewEditDate(e.target.value)}
                            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                            max={maxEditDateInfo ? format(maxEditDateInfo.date, 'yyyy-MM-dd') : undefined}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"
                        />
                         {maxEditDateInfo?.isReservationLimit && (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                                Extension limit: <strong>{getFormattedDate(maxEditDateInfo.date)}</strong>. This is due to the next reservation by <strong>{maxEditDateInfo.limitedByMember}</strong> on <strong>{getFormattedDate(addDays(maxEditDateInfo.date, settings.loanPeriodDays))}</strong>.
                            </p>
                        )}
                        {!maxEditDateInfo?.isReservationLimit && (
                             <p className="mt-2 text-xs text-slate-500 font-medium italic">
                                No upcoming reservations hinder this pickup; extension up to 90 days allowed.
                             </p>
                        )}
                    </div>
                </div>
            </Modal>
            
             <Modal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleReserveSubmit}
                title={`Reserve: ${bookToReserve?.title}`}
                confirmText="Confirm Reservation"
                confirmButtonClass="bg-indigo-600 hover:bg-indigo-700"
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="member" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Member ID</label>
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="text" 
                                id="member" 
                                value={memberId} 
                                onChange={e => setMemberId(e.target.value)}
                                required 
                                placeholder="Enter Member ID"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"
                            />
                            <button onClick={() => setIsMemberSearchOpen(true)} className="flex-shrink-0 px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                                Search
                            </button>
                        </div>
                        {selectedMember && <p className="text-xs text-slate-500 mt-1">Selected: <span className="font-medium">{selectedMember.id} - {selectedMember.name}</span></p>}
                        {!selectedMember && memberId && <p className="text-xs text-red-500 mt-1">Member ID not found.</p>}
                    </div>
                      <div>
                        <label htmlFor="pickupDate" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Pickup Date</label>
                        <input 
                            type="date" 
                            id="pickupDate" 
                            value={pickupDate} 
                            onChange={e => setPickupDate(e.target.value)} 
                            required 
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm"
                            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')} 
                        />
                        {pickupDate && (
                            <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400">
                                Selected Date: {getFormattedDate(pickupDate)}
                            </p>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!issueWarningData}
                onClose={() => setIssueWarningData(null)}
                onConfirm={() => issueWarningData && executeIssueBook(issueWarningData.currentReservationId)}
                title="Priority Conflict Warning"
                confirmText="Yes, Issue Anyway"
                confirmButtonClass="bg-amber-600 hover:bg-amber-700"
            >
                <div className="flex flex-col space-y-3">
                     <div className="flex items-start p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-md">
                        <ExclamationTriangleIcon className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                        <div>
                             <h3 className="font-semibold text-lg mb-1">Wait! Earlier Reservation Found</h3>
                             <p className="text-sm">
                                This book was reserved earlier by member <span className="font-bold">{issueWarningData?.conflictingMemberId} - {issueWarningData?.conflictingMemberName}</span> with a pickup date of <span className="font-bold">{issueWarningData && format(parseISO(issueWarningData.conflictingPickupDate), 'dd/MM/yyyy')}</span>.
                             </p>
                             <p className="text-sm mt-2">
                                Do you wish to continue and issue the book to the current member anyway?
                             </p>
                        </div>
                      </div>
                </div>
            </Modal>

            <Modal
                isOpen={issueConfirmModalOpen}
                onClose={() => setIssueConfirmModalOpen(false)}
                onConfirm={confirmIssue}
                title="Confirm Issue Book"
                confirmText="Issue Book"
                confirmButtonClass="bg-green-600 hover:bg-green-700"
            >
                <p>Are you sure you want to issue this reserved book to the member?</p>
            </Modal>
        </div>
    );
};

export default ReserveBook;