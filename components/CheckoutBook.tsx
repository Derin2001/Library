import React, { useState, useMemo, useEffect } from 'react';
import { Book, Member, BookStatus, Reservation, Transaction } from '../types';
import Card from './common/Card';
import Modal from './common/Modal';
import { SearchIcon, ExclamationTriangleIcon } from './icons';
import { addDays, format, parseISO, isAfter, startOfDay, subDays, isBefore, isValid } from 'date-fns';

interface BookWithAvailability extends Book {
    availableCopies: number;
    status: BookStatus;
}

interface CheckoutBookProps {
    books: BookWithAvailability[];
    members: Member[];
    categories: string[];
    // ✅ Updated to Promise for async handling
    onCheckout: (bookId: string, memberId: string, dueDate: string, forceCheckout?: boolean) => Promise<{ success: boolean; message: string; }>;
    reservations: Reservation[];
    transactions: Transaction[];
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


const CheckoutBook: React.FC<CheckoutBookProps> = ({ books, members, categories, onCheckout, reservations, transactions, showNotification }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    
    // State for the checkout modal
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [bookToCheckout, setBookToCheckout] = useState<BookWithAvailability | null>(null);
    const [dueDate, setDueDate] = useState('');
    const [memberIdForCheckout, setMemberIdForCheckout] = useState('');
    const [selectedMemberForCheckout, setSelectedMemberForCheckout] = useState<Member | null>(null);
    
    const [isMemberSearchOpen, setIsMemberSearchOpen] = useState(false);
    const [adjustedDueDateMessage, setAdjustedDueDateMessage] = useState('');
    const [maxDueDate, setMaxDueDate] = useState<string | undefined>(undefined);

    // Mercy Rule State
    const [isMercyModalOpen, setIsMercyModalOpen] = useState(false);

    // ✅ Loading State Added
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (memberIdForCheckout) {
            const member = members.find(m => m.id === memberIdForCheckout);
            setSelectedMemberForCheckout(member || null);
        } else {
            setSelectedMemberForCheckout(null);
        }
    }, [memberIdForCheckout, members]);

    const filteredBooks = useMemo(() => {
        return books.filter(book => {
            const matchesCategory = selectedCategory === 'All' || book.category === selectedCategory;
            const matchesSearch = !searchTerm || (
                book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
                book.isbn.toLowerCase().includes(searchTerm.toLowerCase())
            );
            return matchesCategory && matchesSearch;
        });
    }, [books, searchTerm, selectedCategory]);
    
    const handleSelectMember = (member: Member) => {
        setMemberIdForCheckout(member.id);
        setSelectedMemberForCheckout(member);
        setIsMemberSearchOpen(false);
    };

    const handleOpenCheckoutConfirm = (book: BookWithAvailability) => {
        setAdjustedDueDateMessage('');
        setMaxDueDate(undefined);
        
        const onShelfCopies = book.availableCopies;

        const sortedReservations = reservations
            .filter(r => r.bookId === book.id && r.status === 'Active' && isAfter(parseISO(r.pickupDate), new Date()))
            .sort((a, b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime());

        const standardDueDate = addDays(new Date(), 15);
        let finalDueDate = standardDueDate;
        let adjustmentMessage = '';

        const criticalReservation = sortedReservations[onShelfCopies - 1];

        if (criticalReservation) {
            const reservationPickupDate = startOfDay(parseISO(criticalReservation.pickupDate));
            const maxDate = subDays(reservationPickupDate, 1);
            
            const minDueDate = startOfDay(new Date()); 
            
            if (isBefore(maxDate, minDueDate)) {
                showNotification(`Cannot check out. This book is needed for an upcoming reservation today or has passed.`, 'error');
                return;
            }

            setMaxDueDate(format(maxDate, 'yyyy-MM-dd'));

            if (isAfter(standardDueDate, maxDate)) {
                finalDueDate = maxDate;
                adjustmentMessage = `Note: Due date shortened to ${format(maxDate, 'dd/MM/yyyy')} due to upcoming reservation on ${format(reservationPickupDate, 'dd/MM/yyyy')}.`;
            }
        }
        
        setDueDate(format(finalDueDate, 'yyyy-MM-dd'));
        setAdjustedDueDateMessage(adjustmentMessage);
        setBookToCheckout(book);
        setMemberIdForCheckout('');
        setSelectedMemberForCheckout(null);
        setConfirmModalOpen(true);
    };

    // ✅ FIXED: Async Checkout Request
    const handleCheckoutRequest = async () => {
        if (bookToCheckout && selectedMemberForCheckout && dueDate) {
             if (isSubmitting) return; // Prevent double click

             // Pre-check for active loans
             const memberId = selectedMemberForCheckout.id;
             const memberActiveLoans = transactions.filter(t => t.memberId === memberId && t.type === 'CheckOut').length;
             const memberReturnedLoans = transactions.filter(t => t.memberId === memberId && t.type === 'CheckIn').length;
             
             // If Mercy needed, close Confirm and Open Mercy (No DB call yet)
             if (memberActiveLoans > memberReturnedLoans) {
                 setConfirmModalOpen(false);
                 setIsMercyModalOpen(true);
                 return;
             }

             // Normal Checkout
             setIsSubmitting(true);
             // ⏳ Wait for DB
             const result = await onCheckout(bookToCheckout.id, selectedMemberForCheckout.id, new Date(dueDate).toISOString());
             
             setIsSubmitting(false);
             setConfirmModalOpen(false);

             if (result.success) {
                showNotification(result.message, 'success');
                setBookToCheckout(null);
                setAdjustedDueDateMessage('');
                setMaxDueDate(undefined);
             } else {
                showNotification(result.message, 'error');
             }
        }
    };

    // ✅ FIXED: Async Mercy Checkout
    const handleMercyCheckout = async () => {
        if (bookToCheckout && selectedMemberForCheckout && dueDate) {
            if (isSubmitting) return;
            setIsSubmitting(true);

            // ⏳ Wait for DB
            const result = await onCheckout(bookToCheckout.id, selectedMemberForCheckout.id, new Date(dueDate).toISOString(), true); // Force = true
            
            setIsSubmitting(false);
            setIsMercyModalOpen(false);

            if (result.success) {
                showNotification(result.message, 'success');
                setBookToCheckout(null);
            } else {
                 showNotification(result.message, 'error');
            }
        }
    }
    
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

    const getFormattedDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = parseISO(dateStr);
        return isValid(date) ? format(date, 'dd/MM/yyyy') : '';
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Checkout Book</h1>
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
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Copies</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Checkout</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredBooks.map((book) => (
                                <tr key={book.id} className="even:bg-slate-50 dark:even:bg-slate-800/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{book.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{book.author}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{book.language}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusChip(book.status)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{book.availableCopies} / {book.totalCopies}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={() => handleOpenCheckoutConfirm(book)}
                                            disabled={book.status === BookStatus.Unavailable}
                                            className="text-indigo-600 hover:text-indigo-900 disabled:text-slate-400 disabled:cursor-not-allowed transition"
                                        >
                                            Checkout
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredBooks.length === 0 && <p className="text-center py-4 text-slate-500">No books match your search criteria.</p>}
                </div>
            </Card>
            
            <MemberSearchModal isOpen={isMemberSearchOpen} onClose={() => setIsMemberSearchOpen(false)} onSelect={handleSelectMember} members={members} />
            
            <Modal
                isOpen={confirmModalOpen}
                // ✅ Loading Protection
                onClose={() => !isSubmitting && setConfirmModalOpen(false)}
                onConfirm={handleCheckoutRequest}
                title="Confirm Checkout"
                confirmText={isSubmitting ? "Processing..." : "Confirm"}
                confirmButtonClass={`bg-indigo-600 hover:bg-indigo-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                confirmDisabled={!selectedMemberForCheckout || isSubmitting}
            >
                <div className="space-y-4">
                    <p>Checking out book: <strong>{bookToCheckout?.title}</strong></p>
                    <div>
                        <label htmlFor="member-id-checkout" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Member ID</label>
                        <div className="flex gap-2 mt-1">
                            <input
                                type="text"
                                id="member-id-checkout"
                                placeholder="Enter Member ID..."
                                value={memberIdForCheckout}
                                onChange={e => setMemberIdForCheckout(e.target.value)}
                                className="w-full px-3 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                             <button onClick={() => setIsMemberSearchOpen(true)} className="flex-shrink-0 px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition">
                                Search
                            </button>
                        </div>
                        {selectedMemberForCheckout && <p className="text-xs text-green-500 mt-1 pl-1">Selected: <span className="font-medium">{selectedMemberForCheckout.id} - {selectedMemberForCheckout.name}</span></p>}
                        {!selectedMemberForCheckout && memberIdForCheckout && <p className="text-xs text-red-500 mt-1 pl-1">Member ID not found.</p>}
                    </div>
                    <div>
                        <label htmlFor="due-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Due Date
                        </label>
                        <input
                            type="date"
                            id="due-date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            min={format(new Date(), 'yyyy-MM-dd')}
                            max={maxDueDate}
                            className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        {dueDate && (
                            <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400">
                                Selected Date: {getFormattedDate(dueDate)}
                            </p>
                        )}
                    </div>
                    {adjustedDueDateMessage && (
                        <div className="mt-3 p-3 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-md border border-amber-300 dark:border-amber-600">
                            {adjustedDueDateMessage}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={isMercyModalOpen}
                // ✅ Loading Protection
                onClose={() => !isSubmitting && setIsMercyModalOpen(false)}
                onConfirm={handleMercyCheckout}
                title="Mercy Rule Override"
                confirmText={isSubmitting ? "Processing..." : "Override & Checkout"}
                confirmButtonClass={`bg-red-600 hover:bg-red-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                confirmDisabled={isSubmitting}
            >
                <div className="flex flex-col space-y-3">
                    <div className="flex items-start p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-md border border-red-200 dark:border-red-800">
                        <ExclamationTriangleIcon className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-lg mb-1">Checkout Restricted</h3>
                            <p className="text-sm mb-2">
                                Member <strong>{selectedMemberForCheckout?.name}</strong> already has books checked out that have not been returned.
                            </p>
                            <p className="text-sm mb-2">
                                You are attempting to check out: <strong>{bookToCheckout?.title}</strong>
                            </p>
                            <p className="text-sm font-medium">
                                Do you wish to apply the "Mercy Rule" and allow this checkout anyway?
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CheckoutBook;