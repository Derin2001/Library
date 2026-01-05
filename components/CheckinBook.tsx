
import React, { useState, useMemo } from 'react';
import { Book, Transaction, TransactionType, Member } from '../types';
import Card from './common/Card';
import { SearchIcon } from './icons';
import { format, parseISO } from 'date-fns';
import Modal from './common/Modal';

interface CheckedOutBookInfo {
    transactionId: string;
    bookId: string;
    title: string;
    memberId: string;
    memberName: string;
    checkoutDate: string;
    renewalCount: number;
}

interface CheckinBookProps {
    books: Book[];
    transactions: Transaction[];
    members: Member[];
    onCheckin: (bookId: string, memberId: string, title: string) => void;
    onRenewLoan?: (transactionId: string, daysToExtend?: number) => { success: boolean; message: string };
    showNotification: (message: string, type: 'success' | 'error') => void;
}

const CheckinBook: React.FC<CheckinBookProps> = ({ books, transactions, members, onCheckin, onRenewLoan, showNotification }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [checkinCandidate, setCheckinCandidate] = useState<CheckedOutBookInfo | null>(null);
    
    // Renewal State
    const [renewCandidate, setRenewCandidate] = useState<CheckedOutBookInfo | null>(null);
    const [daysToExtend, setDaysToExtend] = useState(15);

    const checkedOutBooks = useMemo(() => {
        const activeLoansMap = new Map<string, Transaction[]>();
        const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sortedTransactions.forEach(t => {
            const key = `${t.bookId}::${t.memberId}`;
            const activeList = activeLoansMap.get(key) || [];

            if (t.type === TransactionType.CheckOut) {
                activeList.push(t);
                activeLoansMap.set(key, activeList);
            } else if (t.type === TransactionType.CheckIn) {
                if (activeList.length > 0) {
                    activeList.shift();
                    activeLoansMap.set(key, activeList);
                }
            }
        });

        const allActiveTransactions: Transaction[] = [];
        activeLoansMap.forEach((list) => {
            allActiveTransactions.push(...list);
        });

        return allActiveTransactions
            .map(t => {
                const book = books.find(b => b.id === t.bookId);
                const member = members.find(m => m.id === t.memberId);
                return {
                    transactionId: t.id,
                    bookId: t.bookId,
                    title: book?.title || 'Unknown Book',
                    memberId: t.memberId,
                    memberName: member?.name || 'Unknown Member',
                    checkoutDate: t.date,
                    renewalCount: t.renewalCount || 0
                };
            })
            .filter(book =>
                !searchTerm ||
                book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                book.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                book.memberName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime());
    }, [books, transactions, members, searchTerm]);
    
    const requestCheckin = (book: CheckedOutBookInfo) => {
        const memberExists = members.some(m => m.id === book.memberId);
        if (!memberExists) {
            showNotification(`Cannot check in book. Member information (ID: ${book.memberId}) could not be verified.`, 'error');
            return;
        }
        setCheckinCandidate(book);
    };

    const confirmCheckin = () => {
        if (checkinCandidate) {
            onCheckin(checkinCandidate.bookId, checkinCandidate.memberId, checkinCandidate.title);
            showNotification(`${checkinCandidate.title} checked in successfully.`, 'success');
            setCheckinCandidate(null);
        }
    };
    
    const handleRenewRequest = (book: CheckedOutBookInfo) => {
        setRenewCandidate(book);
        setDaysToExtend(15);
    };

    const confirmRenew = () => {
        if (onRenewLoan && renewCandidate) {
            const result = onRenewLoan(renewCandidate.transactionId, daysToExtend);
            showNotification(result.message, result.success ? 'success' : 'error');
            setRenewCandidate(null);
        }
    };
    
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-6">Check-in Book</h1>
            <Card>
                 <div className="relative mb-4">
                    <input
                        type="text"
                        placeholder="Search by title, Member ID or Name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border dark:bg-slate-800 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Title</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Checked Out By</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Checkout Date</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                            {checkedOutBooks.map((book) => (
                                <tr key={book.transactionId} className="even:bg-slate-50 dark:even:bg-slate-800/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{book.title}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{book.memberId} - {book.memberName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{format(parseISO(book.checkoutDate), 'dd/MM/yyyy')}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        {onRenewLoan && (
                                            <button 
                                                onClick={() => handleRenewRequest(book)} 
                                                className="text-indigo-600 hover:text-indigo-800 transition"
                                            >
                                                Renew
                                            </button>
                                        )}
                                        <button onClick={() => requestCheckin(book)} className="text-green-600 hover:text-green-800 transition">Check-in</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {checkedOutBooks.length === 0 && <p className="text-center py-4 text-slate-500">No books are currently checked out.</p>}
                </div>
            </Card>

            <Modal
                isOpen={!!checkinCandidate}
                onClose={() => setCheckinCandidate(null)}
                onConfirm={confirmCheckin}
                title="Confirm Check-in"
                confirmText="Confirm Return"
                confirmButtonClass="bg-green-600 hover:bg-green-700"
            >
                <div className="space-y-2">
                    <p>Are you sure you want to check in the following book?</p>
                    <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded-md">
                        <p className="font-semibold">{checkinCandidate?.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Returned by: {checkinCandidate?.memberId} - {checkinCandidate?.memberName}</p>
                    </div>
                </div>
            </Modal>
            
            <Modal
                isOpen={!!renewCandidate}
                onClose={() => setRenewCandidate(null)}
                onConfirm={confirmRenew}
                title="Renew Loan"
                confirmText="Confirm Renewal"
                confirmButtonClass="bg-indigo-600 hover:bg-indigo-700"
            >
                <div className="space-y-4">
                    <div>
                        <p className="mb-2">Renewing book: <strong>{renewCandidate?.title}</strong></p>
                         <p className="text-sm text-slate-600 dark:text-slate-400">Current Member: {renewCandidate?.memberName} ({renewCandidate?.memberId})</p>
                    </div>
                    <div>
                         <label htmlFor="renewDays" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                             Days to Extend (Max 15)
                         </label>
                         <input 
                             type="number"
                             id="renewDays"
                             min="1"
                             max="15"
                             value={daysToExtend}
                             onChange={(e) => {
                                 const val = parseInt(e.target.value);
                                 if (!isNaN(val)) {
                                     setDaysToExtend(Math.min(Math.max(val, 1), 15));
                                 }
                             }}
                             className="w-full px-3 py-2 border dark:bg-slate-700 dark:border-slate-600 rounded-md"
                         />
                         <p className="text-xs text-slate-500 mt-1">Default extension is 15 days.</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CheckinBook;
