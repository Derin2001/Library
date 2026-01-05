import React, { useState, useMemo, useEffect } from 'react';
import { Book, Member, Transaction, TransactionType, Reservation } from '../types';
import Card from './common/Card';
import { SearchIcon, CloseIcon } from './icons';
import { format, parseISO } from 'date-fns';
import { downloadCSV, downloadPDF } from '../lib/utils';
import DownloadControl from './common/DownloadControl';

interface BookBorrowingHistoryProps {
    books: Book[];
    members: Member[];
    transactions: Transaction[];
    reservations: Reservation[];
    onLogActivity: (action: string, details: string) => void;
}

interface LoanHistory {
    member: Member;
    checkoutDate: string;
    checkinDate: string | null;
}

const BookBorrowingHistory: React.FC<BookBorrowingHistoryProps> = ({ books, members, transactions, reservations, onLogActivity }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [historyView, setHistoryView] = useState<'current' | 'past'>('current');
    const [searchDate, setSearchDate] = useState('');

    const filteredBooks = useMemo(() => {
        if (!searchTerm) return books;
        return books.filter(book =>
            book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
            book.isbn.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [books, searchTerm]);

    const bookLoanHistory = useMemo((): LoanHistory[] => {
        if (!selectedBook) return [];
        const bookTransactions = transactions.filter(t => t.bookId === selectedBook.id).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
        const fullHistory: LoanHistory[] = [];
        const historyMap = new Map<string, { checkouts: string[], checkins: string[] }>();

        bookTransactions.forEach(t => {
            const memberHistory = historyMap.get(t.memberId) || { checkouts: [], checkins: [] };
            if (t.type === TransactionType.CheckOut) memberHistory.checkouts.push(t.date);
            else memberHistory.checkins.push(t.date);
            historyMap.set(t.memberId, memberHistory);
        });

        historyMap.forEach((dates, memberId) => {
            const member = members.find(m => m.id === memberId);
            if (!member) return;
            const { checkouts, checkins } = dates;
            const pairedCheckins = [...checkins];
            checkouts.forEach((checkoutDate) => {
                const checkinIndex = pairedCheckins.findIndex(ci => parseISO(ci) > parseISO(checkoutDate));
                let checkinDate: string | null = null;
                if(checkinIndex !== -1) checkinDate = pairedCheckins.splice(checkinIndex, 1)[0];
                fullHistory.push({ member, checkoutDate, checkinDate });
            });
        });
        return fullHistory.sort((a, b) => parseISO(b.checkoutDate).getTime() - parseISO(a.checkoutDate).getTime());
    }, [selectedBook, transactions, members]);

    const handleDownloadHistory = (formatType: 'csv' | 'pdf') => {
        if (!selectedBook) return;
        const loanData = bookLoanHistory.map(l => ({ Member: l.member.name, Language: selectedBook.language, CheckedOut: format(parseISO(l.checkoutDate), 'dd/MM/yyyy'), Returned: l.checkinDate ? format(parseISO(l.checkinDate), 'dd/MM/yyyy') : 'Still Out' }));
        if (formatType === 'csv') downloadCSV(loanData, `History_${selectedBook.id}.csv`);
        else downloadPDF(loanData, `History_${selectedBook.id}.pdf`, `Borrowing History: ${selectedBook.title}`);
    };

    return (
        <Card>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Book Borrowing History</h2>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <input type="text" placeholder="Search catalog..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-xl" />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr className="text-[10px] font-black uppercase text-slate-400">
                            <th className="px-6 py-3 text-left">Title</th>
                            <th className="px-6 py-3 text-left">Language</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredBooks.map(book => (
                            <tr key={book.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedBook(book)}>
                                <td className="px-6 py-4 text-sm font-bold">{book.title}</td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-500">{book.language}</td>
                                <td className="px-6 py-4 text-right"><button className="text-indigo-600 text-xs font-bold">View Log</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedBook && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center items-center p-4">
                     <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">{selectedBook.title}</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{selectedBook.language} Catalog</p>
                            </div>
                            <button onClick={() => setSelectedBook(null)}><CloseIcon className="h-6 w-6 text-slate-400"/></button>
                        </div>
                        <div className="flex justify-end mb-4"><DownloadControl onDownload={handleDownloadHistory} /></div>
                        <div className="overflow-y-auto">
                            <table className="min-w-full text-left text-xs">
                                <thead><tr><th className="py-2 border-b">Member</th><th className="py-2 border-b">Out</th><th className="py-2 border-b">Back</th></tr></thead>
                                <tbody>
                                    {bookLoanHistory.map((l, i) => (
                                        <tr key={i}><td className="py-2">{l.member.name}</td><td className="py-2">{format(parseISO(l.checkoutDate), 'dd/MM/yyyy')}</td><td className="py-2">{l.checkinDate ? format(parseISO(l.checkinDate), 'dd/MM/yyyy') : '-'}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default BookBorrowingHistory;