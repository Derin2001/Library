import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { View, Book, Member, Transaction, Reservation, BookStatus, TransactionType, OverdueBook, OverdueReservation, ArchiveRecord, ActivityLogEntry, UserRole, Settings } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import Login from './components/Login';
import AddMember from './components/AddMember';
import AddBook from './components/AddBook';
import CheckoutBook from './components/CheckoutBook';
import CheckinBook from './components/CheckinBook';
import ReserveBook from './components/ReserveBook';
import Manage from './components/Manage';
import MemberDashboard from './components/MemberDashboard';
import { addDays, isBefore, parseISO, differenceInDays, formatISO, startOfDay, subDays, format } from 'date-fns';
import Toast from './components/common/Toast';
import { supabase } from './lib/supabase';

// ✅ 1. IMPORT OFFLINE TOOLS
import OfflineStatus from './components/OfflineStatus';
import { handleLibraryAction } from './lib/OfflineManager';

const App: React.FC = () => {
    // =========================================================================
    // 1. STATE MANAGEMENT
    // =========================================================================
    const [books, setBooks] = useState<Book[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [settings, setSettings] = useState<Settings>({ loanPeriodDays: 15, maxRenewals: 2 });
    const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
    const [archiveHistory, setArchiveHistory] = useState<any[]>([]);

    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const showNotification = useCallback((message: string, type: 'success' | 'error') => setNotification({ message, type }), []);
    const closeNotification = () => setNotification(null);

    // =========================================================================
    // 2. DATA LOADING FUNCTION (Updated for Offline Caching)
    // =========================================================================
    const fetchAllData = useCallback(async () => {
        // A. ONLINE MODE: Fetch from Supabase -> Save to LocalStorage
        if (navigator.onLine) {
            const [
                booksRes,
                membersRes,
                transRes,
                resRes,
                settingsRes,
                logRes,
                archiveRes
            ] = await Promise.all([
                supabase.from('books').select('*'),
                supabase.from('members').select('*'),
                supabase.from('transactions').select('*'),
                supabase.from('reservations').select('*'),
                supabase.from('settings').select('*').eq('id', 1).single(),
                supabase.from('activity_log').select('*').order('timestamp', { ascending: false }).limit(100),
                supabase.from('archive_history').select('*').order('deletedDate', { ascending: false })
            ]);

            if (booksRes.data) {
                setBooks(booksRes.data);
                localStorage.setItem('cached_books', JSON.stringify(booksRes.data));
            }
            if (membersRes.data) {
                setMembers(membersRes.data);
                localStorage.setItem('cached_members', JSON.stringify(membersRes.data));
            }
            if (transRes.data) {
                setTransactions(transRes.data);
                localStorage.setItem('cached_transactions', JSON.stringify(transRes.data));
            }
            if (resRes.data) {
                setReservations(resRes.data);
                localStorage.setItem('cached_reservations', JSON.stringify(resRes.data));
            }
            if (settingsRes.data) {
                setSettings({ loanPeriodDays: settingsRes.data.loanPeriodDays, maxRenewals: settingsRes.data.maxRenewals });
                localStorage.setItem('cached_settings', JSON.stringify(settingsRes.data));
            }
            if (logRes.data) setActivityLog(logRes.data);

            if (archiveRes.data) {
                const mappedArchive = archiveRes.data.map(a => ({
                    id: a.id,
                    type: a.itemType || 'UNKNOWN',
                    itemName: a.info || 'Unknown Item',
                    itemId: 'N/A',
                    deletedAt: a.deletedDate,
                    history: null 
                }));
                setArchiveHistory(mappedArchive);
            }
        } 
        // B. OFFLINE MODE: Fetch from LocalStorage
        else {
            const cBooks = localStorage.getItem('cached_books');
            const cMembers = localStorage.getItem('cached_members');
            const cTrans = localStorage.getItem('cached_transactions');
            const cRes = localStorage.getItem('cached_reservations');
            const cSettings = localStorage.getItem('cached_settings');

            if (cBooks) setBooks(JSON.parse(cBooks));
            if (cMembers) setMembers(JSON.parse(cMembers));
            if (cTrans) setTransactions(JSON.parse(cTrans));
            if (cRes) setReservations(JSON.parse(cRes));
            if (cSettings) setSettings(JSON.parse(cSettings));
            
            showNotification('You are offline. Loaded local data.', 'success');
        }
    }, [showNotification]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);
    
    // =========================================================================
    // 3. AUTH & UI STATE
    // =========================================================================
    const [isLoggedIn, setIsLoggedIn] = useLocalStorage<boolean>('isLoggedIn', false);
    const [userRole, setUserRole] = useLocalStorage<UserRole>('userRole', null);
    const [currentMemberId, setCurrentMemberId] = useLocalStorage<string | null>('currentMemberId', null);
    const [currentView, setCurrentView] = useLocalStorage<View>('currentView', 'DASHBOARD');

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const mainContentRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (mainContentRef.current) mainContentRef.current.scrollTo(0, 0); }, [currentView]);

    const logActivity = useCallback(async (action: string, details: string) => {
        const newEntry = { id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, timestamp: new Date().toISOString(), action, details };
        setActivityLog(prev => [newEntry, ...prev]);
        // Logs are always strictly online or fire-and-forget, keeping simple
        if(navigator.onLine) {
             await supabase.from('activity_log').insert([newEntry]);
        }
    }, []);

    // =========================================================================
    // 4. CALCULATIONS
    // =========================================================================
    const overdueBooks = useMemo((): OverdueBook[] => {
        const activeLoansTransactions: Transaction[] = [];
        const pairs = new Set(transactions.map(t => `${t.memberId}::${t.bookId}`));
        pairs.forEach(p => {
            const [mid, bid] = p.split('::');
            const pt = transactions.filter(t => t.memberId === mid && t.bookId === bid).sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
            const active: Transaction[] = [];
            pt.forEach(t => t.type === TransactionType.CheckOut ? active.push(t) : active.shift());
            activeLoansTransactions.push(...active);
        });
        return activeLoansTransactions.map(t => {
            const due = t.dueDate ? parseISO(t.dueDate) : addDays(parseISO(t.date), settings.loanPeriodDays);
            if (isBefore(due, new Date())) return { bookTitle: t.bookTitle, memberId: t.memberId, memberName: members.find(m => m.id === t.memberId)?.name || 'Unknown', dueDate: due, daysOverdue: differenceInDays(new Date(), due) };
            return null;
        }).filter((i): i is OverdueBook => i !== null);
    }, [transactions, members, settings.loanPeriodDays]);

    const overdueReservations = useMemo((): OverdueReservation[] => reservations.filter(r => r.status === 'Active' && isBefore(parseISO(r.pickupDate), startOfDay(new Date()))).map(r => ({ reservationId: r.id, bookTitle: books.find(b => b.id === r.bookId)?.title || 'Unknown', memberId: r.memberId, memberName: members.find(m => m.id === r.memberId)?.name || 'Unknown', pickupDate: r.pickupDate })), [reservations, books, members]);

    const booksWithAvailability = useMemo(() => {
        const checkoutCounts: Record<string, number> = {};
        const checkinCounts: Record<string, number> = {};
        transactions.forEach(t => {
            if (t.type === TransactionType.CheckOut) checkoutCounts[t.bookId] = (checkoutCounts[t.bookId] || 0) + 1;
            else checkinCounts[t.bookId] = (checkinCounts[t.bookId] || 0) + 1;
        });
        const activeReservationsByBook = reservations.reduce((acc, r) => {
            if (r.status === 'Active') {
                if (!acc[r.bookId]) acc[r.bookId] = [];
                acc[r.bookId].push(r);
            }
            return acc;
        }, {} as Record<string, Reservation[]>);

        return books.map(book => {
            const checkedOut = Math.max(0, (checkoutCounts[book.id] || 0) - (checkinCounts[book.id] || 0));
            const onShelfCopies = book.totalCopies - checkedOut;
            const activeResCount = (activeReservationsByBook[book.id] || []).length;
            let status: BookStatus = BookStatus.OnShelf;
            if (onShelfCopies <= 0) status = BookStatus.Unavailable;
            else if (onShelfCopies <= activeResCount) status = BookStatus.Reserved;
            return { ...book, availableCopies: onShelfCopies, status };
        });
    }, [books, transactions, reservations]);

    // =========================================================================
    // 5. HANDLERS
    // =========================================================================
    const generateMemberId = () => {
        const numericIds = members.map(m => parseInt(m.id)).filter(n => !isNaN(n)).sort((a, b) => a - b);
        let nextId = 0;
        if (numericIds.length > 0) nextId = numericIds[numericIds.length - 1] + 1;
        return nextId.toString().padStart(4, '0');
    };
    const generateBookId = () => {
        const numericIds = books.map(b => b.id.startsWith('A') ? parseInt(b.id.substring(1)) : NaN).filter(n => !isNaN(n)).sort((a, b) => a - b);
        let nextNum = 1;
        if (numericIds.length > 0) nextNum = numericIds[numericIds.length - 1] + 1;
        return 'A' + nextNum.toString().padStart(3, '0');
    };

    const verifyLogin = async (role: 'LIBRARIAN' | 'MEMBER', id?: string, password?: string): Promise<boolean> => {
        if (!navigator.onLine) {
            // Simple offline login check (Optional: can be improved)
            if (role === 'MEMBER') {
                 const member = members.find(m => m.id === id);
                 if (member && password === `${member.id}@123`) {
                    setIsLoggedIn(true); setUserRole('MEMBER'); setCurrentMemberId(member.id);
                    return true;
                 }
            }
            return false;
        }

        if (role === 'LIBRARIAN' && id && password) {
            const { data, error } = await supabase.from('admin_auth').select('id').eq('username', id).eq('password', password).single();
            if (data && !error) { 
                setIsLoggedIn(true); 
                setUserRole('LIBRARIAN'); 
                setCurrentView('DASHBOARD');
                await fetchAllData(); 
                return true; 
            }
            return false;
        } else if (role === 'MEMBER' && id && password) {
             const member = members.find(m => m.id === id);
             if (member && password === `${member.id}@123`) { 
                 setIsLoggedIn(true); 
                 setUserRole('MEMBER'); 
                 setCurrentMemberId(member.id); 
                 await fetchAllData();
                 return true; 
             }
        }
        return false;
    };

    const handleSignOut = useCallback(() => {
        setIsLoggedIn(false); setUserRole(null); setCurrentMemberId(null); setNotification(null);
        setCurrentView('DASHBOARD');
    }, [setIsLoggedIn, setCurrentView]);

    const handleUpdateAdminPassword = async (newPass: string) => {
        const updateData = { id: 1, password: newPass };
        handleLibraryAction('admin_auth', 'UPDATE', updateData, () => {
            showNotification('Password updated successfully!', 'success');
        });
        return {success: true, message: 'Updated'};
    };

    const handleVerifyAdminForReset = async (passwordInput: string) => {
        if (!navigator.onLine) return false; // Reset verification only online
        try {
            const { data } = await supabase.from('admin_auth').select('id').eq('password', passwordInput).single();
            return !!data;
        } catch(e) { return false; }
    };

    // --- BOOKS (UPDATED WITH OFFLINE MANAGER) ---
    const handleUpdateBook = async (id: string, d: Partial<Omit<Book, 'id'>>) => {
        const updateData = { id, ...d };
        handleLibraryAction('books', 'UPDATE', updateData, () => {
            setBooks(p => p.map(b => b.id === id ? {...b, ...d} : b));
            showNotification(`Book updated successfully.`, 'success');
        });
        return {success: true, message: 'Updated'};
    };

    const handleDeleteBook = async (id: string) => {
        const bookTransactions = transactions.filter(t => t.bookId === id);
        const checkOutCount = bookTransactions.filter(t => t.type === TransactionType.CheckOut).length;
        const checkInCount = bookTransactions.filter(t => t.type === TransactionType.CheckIn).length;

        if (checkOutCount > checkInCount) {
            showNotification('Cannot delete: Book is issued to a member. Receive it first.', 'error');
            return;
        }

        const book = books.find(b => b.id === id);
        
        handleLibraryAction('books', 'DELETE', { id }, async () => {
            if (book) {
                // Keep archive history as online-only or separate to keep offline logic simple
                if(navigator.onLine) {
                    const dbEntry = { id: `arch-${Date.now()}`, itemType: 'BOOK', info: `${book.title} by ${book.author}`, deletedDate: new Date().toISOString() };
                    await supabase.from('archive_history').insert([dbEntry]);
                    const uiEntry = { id: dbEntry.id, type: 'BOOK', itemName: book.title, itemId: book.id, deletedAt: dbEntry.deletedDate, history: null };
                    setArchiveHistory(p => [uiEntry, ...p]);
                }
            }
            setBooks(p => p.filter(b => b.id !== id));
            showNotification('Book deleted successfully.', 'success');
        });
    };

    // --- MEMBERS (UPDATED WITH OFFLINE MANAGER) ---
    const handleUpdateMember = async (oldId: string, d: any) => {
        const updateData = { id: oldId, ...d };
        handleLibraryAction('members', 'UPDATE', updateData, () => {
            setMembers(p => p.map(m => m.id === oldId ? {...m, ...d} : m));
            showNotification('Member updated successfully', 'success');
        });
        return {success: true, message: 'Updated'};
    };

    const handleDeleteMember = async (id: string) => {
        const memberTransactions = transactions.filter(t => t.memberId === id);
        const bookStatus: {[key: string]: number} = {};
        
        memberTransactions.forEach(t => {
            if (!bookStatus[t.bookId]) bookStatus[t.bookId] = 0;
            if (t.type === TransactionType.CheckOut) bookStatus[t.bookId]++;
            else if (t.type === TransactionType.CheckIn) bookStatus[t.bookId]--;
        });

        const hasActiveLoans = Object.values(bookStatus).some(count => count > 0);

        if (hasActiveLoans) {
            showNotification('Cannot delete: Member has unreturned books.', 'error');
            return;
        }

        const member = members.find(m => m.id === id);

        handleLibraryAction('members', 'DELETE', { id }, async () => {
            if (member && navigator.onLine) {
                const dbEntry = { id: `arch-${Date.now()}`, itemType: 'MEMBER', info: `${member.name} (ID: ${member.id})`, deletedDate: new Date().toISOString() };
                await supabase.from('archive_history').insert([dbEntry]);
                const uiEntry = { id: dbEntry.id, type: 'MEMBER', itemName: member.name, itemId: member.id, deletedAt: dbEntry.deletedDate, history: null };
                setArchiveHistory(p => [uiEntry, ...p]);
            }
            setMembers(p => p.filter(m => m.id !== id));
            showNotification('Member deleted successfully', 'success');
        });
    };

    // --- SETTINGS (UPDATED) ---
    const handleUpdateSettings = async (newSettings: Settings) => {
        const updateData = { id: 1, ...newSettings };
        handleLibraryAction('settings', 'UPDATE', updateData, () => {
             setSettings(newSettings);
             showNotification('Settings updated globally.', 'success');
        });
        return {success: true, message: 'Updated'};
    };

    const handleResetSystem = async () => { 
        if(!navigator.onLine) { alert("System reset requires Internet!"); return; }
        if(!window.confirm("Are you sure? This will delete EVERYTHING from the database!")) return;
        await supabase.from('transactions').delete().neq('id', '0');
        await supabase.from('reservations').delete().neq('id', '0');
        await supabase.from('books').delete().neq('id', '0');
        await supabase.from('members').delete().neq('id', '0');
        await supabase.from('activity_log').delete().neq('id', '0');
        await supabase.from('archive_history').delete().neq('id', '0');
        setBooks([]); setMembers([]); setTransactions([]); setReservations([]); setActivityLog([]); setArchiveHistory([]);
        handleSignOut(); 
        showNotification('System Reset Complete.', 'success');
    };

    // --- RENEWAL (UPDATED WITH OFFLINE MANAGER) ---
    const handleRenewLoan = async (transactionId: string) => {
        const loan = transactions.find(t => t.id === transactionId);
        if (!loan) return { success: false, message: 'Record not found.' };

        const currentDueDateObj = loan.dueDate ? parseISO(loan.dueDate) : parseISO(loan.date);
        let newDueDate = addDays(currentDueDateObj, settings.loanPeriodDays);
        let message = 'Loan renewed successfully.';

        // Conflict check logic
        const book = books.find(b => b.id === loan.bookId);
        if (book) {
            const conflictingReservations = reservations.filter(r =>
                r.bookId === loan.bookId &&
                r.status === 'Active' &&
                isBefore(parseISO(r.pickupDate), newDueDate)
            ).sort((a, b) => parseISO(a.pickupDate).getTime() - parseISO(b.pickupDate).getTime());

            const checkOuts = transactions.filter(t => t.bookId === loan.bookId && t.type === TransactionType.CheckOut).length;
            const checkIns = transactions.filter(t => t.bookId === loan.bookId && t.type === TransactionType.CheckIn).length;
            const currentOnShelf = book.totalCopies - (checkOuts - checkIns);

            if (conflictingReservations.length > currentOnShelf) {
                const earliestRes = conflictingReservations[0];
                const resPickupDate = parseISO(earliestRes.pickupDate);
                const cappedDueDate = subDays(resPickupDate, 1);

                if (isBefore(cappedDueDate, currentDueDateObj) || cappedDueDate.getTime() === currentDueDateObj.getTime()) {
                    const resDateStr = format(resPickupDate, 'dd/MM/yyyy');
                    showNotification(`Cannot renew: Reservation starts on ${resDateStr}.`, 'error');
                    return { success: false, message: 'Blocked by Reservation' };
                }
                newDueDate = cappedDueDate;
                message = `Renewed only until ${format(newDueDate, 'dd/MM/yyyy')} due to an upcoming reservation.`;
            }
        }

        const newRenewalCount = (loan.renewalCount || 0) + 1;
        
        // Prepare Data for Update
        const updateData = { 
            id: transactionId, 
            dueDate: newDueDate.toISOString(), 
            renewalCount: newRenewalCount 
        };

        handleLibraryAction('transactions', 'UPDATE', updateData, () => {
             setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, dueDate: newDueDate.toISOString(), renewalCount: newRenewalCount } : t));
             logActivity('Renew Loan', `Renewed ${loan.bookTitle} until ${format(newDueDate, 'yyyy-MM-dd')}`);
             showNotification(message, 'success');
        });

        return { success: true, message: 'Renewed' };
    };

    // --- TRANSACTION ACTIONS (UPDATED) ---
    const handleCheckout = async (bid: string, mid: string, dd: string) => {
        const book = books.find(b => b.id === bid);
        if (!book) return {success: false, message: 'Book not found'};
        const memberName = members.find(m => m.id === mid)?.name || 'Unknown';
        
        const trans = { 
            id: `T${Date.now()}`, 
            bookId: bid, 
            bookTitle: book.title, 
            memberId: mid, 
            memberName: memberName, 
            type: TransactionType.CheckOut, 
            date: new Date().toISOString(), 
            dueDate: dd, 
            renewalCount: 0 
        };

        handleLibraryAction('transactions', 'INSERT', trans, () => {
            setTransactions(p => [...p, trans]);
            logActivity('Checkout', `Issued ${book.title} to ${mid}`);
            showNotification(`Checkout successful: "${book.title}" to ${memberName}`, 'success');
        });
        return {success: true, message: 'Checkout successful'};
    };

    const handleCheckin = async (bid: string, mid: string, title: string) => {
        const memberName = members.find(m => m.id === mid)?.name || 'Unknown';
        const trans = { 
            id: `T${Date.now()}`, 
            bookId: bid, 
            bookTitle: title, 
            memberId: mid, 
            memberName: memberName, 
            type: TransactionType.CheckIn, 
            date: new Date().toISOString() 
        };

        handleLibraryAction('transactions', 'INSERT', trans, () => {
            setTransactions(p => [...p, trans]);
            logActivity('Check-in', `Returned ${title} from ${mid}`);
            showNotification(`Returned successful: "${title}"`, 'success');
        });
    };

    // --- RESERVATION ACTIONS (UPDATED) ---
    const handleReserveBook = async (r: Omit<Reservation, 'id' | 'reservationDate' | 'status'>) => {
        const nr = { ...r, id: `R${Date.now()}`, reservationDate: new Date().toISOString(), status: 'Active' as const };
        
        handleLibraryAction('reservations', 'INSERT', nr, () => {
             setReservations(p => [...p, nr]);
             logActivity('Reserve Book', `Reserved book ID ${r.bookId}`);
             showNotification('Reservation saved successfully.', 'success');
        });
        return {success: true, message: 'Reserved'};
    };

    const handleCancelReservation = async (id: string) => {
        const updateData = { id, status: 'Cancelled' };
        handleLibraryAction('reservations', 'UPDATE', updateData, () => {
            setReservations(p => p.map(r => r.id === id ? {...r, status: 'Cancelled'} : r));
            showNotification('Reservation cancelled.', 'success');
        });
        return {success: true, message: 'Cancelled'};
    };

    const handleIssueReservedBook = async (id: string) => {
        const updateData = { id, status: 'Fulfilled' };
        handleLibraryAction('reservations', 'UPDATE', updateData, () => {
             setReservations(p => p.map(r => r.id === id ? {...r, status: 'Fulfilled'} : r));
             showNotification('Reserved book issued successfully.', 'success');
        });
        return {success: true, message: 'Issued'};
    };

    const handleUpdateReservationDate = async (id: string, date: string) => {
        const updateData = { id, pickupDate: date };
        handleLibraryAction('reservations', 'UPDATE', updateData, () => {
            setReservations(prev => prev.map(r => r.id === id ? { ...r, pickupDate: date } : r));
            showNotification('Reservation date updated.', 'success');
        });
        return { success: true, message: 'Date updated.' };
    };

    const handleCancelOverdueReservation = async (id: string) => {
        const updateData = { id, status: 'Cancelled (Overdue)' };
        handleLibraryAction('reservations', 'UPDATE', updateData, () => {
            setReservations(prev => prev.map(r => r.id === id ? {...r, status: 'Cancelled (Overdue)'} : r)); 
            showNotification('Overdue reservation cancelled.', 'success'); 
        });
    };

    // --- ADDING HANDLERS (UPDATED) ---
    const handleAddBook = async (b: Book) => {
        const nb = {...b, id: generateBookId()};
        
        handleLibraryAction('books', 'INSERT', nb, () => {
             setBooks(p => [...p, nb]);
             logActivity('Add Book', `Added: ${nb.title} (ID: ${nb.id})`);
             showNotification(`Book "${nb.title}" added successfully.`, 'success');
        });
        return {success: true, message: 'Added', newBook: nb};
    };

    // NOTE: Bulk operations are kept Online-Only for safety
    const handleBulkAddBooks = async (bs: Omit<Book, 'id'>[]) => {
        if(!navigator.onLine) { showNotification("Bulk add requires internet!", "error"); return { success: 0, failed: bs.length, errors: ['Offline'] }; }
        const numericIds = books.map(b => b.id.startsWith('A') ? parseInt(b.id.substring(1)) : NaN).filter(n => !isNaN(n));
        let maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        const newBooks = bs.map((b, index) => ({
            ...b,
            id: 'A' + (maxId + index + 1).toString().padStart(3, '0') 
        }));
        const { error } = await supabase.from('books').insert(newBooks as any);
        if (error) { return { success: 0, failed: bs.length, errors: [error.message] }; }
        setBooks(p => [...p, ...newBooks]);
        const batchId = Math.floor(1000 + Math.random() * 9000);
        const bookList = newBooks.map(b => `- ${b.title} (ID: ${b.id})`).join('\n');
        await logActivity('Bulk Add Books', `Batch #${batchId}: Added ${bs.length} books.\n\nBooks Added:\n${bookList}`);
        showNotification(`${bs.length} books added successfully.`, 'success');
        return {success: bs.length, failed: 0, errors: []};
    };

    const handleAddMember = async (m: Member) => {
        const finalId = m.id ? m.id.padStart(4, '0') : generateMemberId();
        if (members.some(member => member.id === finalId)) return { success: false, message: `Member ID ${finalId} exists.` };
        const nm = {...m, id: finalId, joinDate: new Date().toISOString()};
        
        handleLibraryAction('members', 'INSERT', nm, () => {
             setMembers(p => [...p, nm]);
             logActivity('Add Member', `Added: ${nm.name} (ID: ${nm.id})`);
             showNotification(`Member "${nm.name}" added successfully.`, 'success');
        });
        return {success: true, message: 'Added', newMember: nm};
    };

    // Bulk operations kept online-only
    const handleBulkAddMembers = async (ms: Member[]) => {
        if(!navigator.onLine) { showNotification("Bulk add requires internet!", "error"); return { success: 0, failed: ms.length, errors: ['Offline'] }; }
        const numericIds = members.map(m => parseInt(m.id)).filter(n => !isNaN(n));
        let maxId = numericIds.length > 0 ? Math.max(...numericIds) : 0;
        let autoIdCounter = 1;
        const newMembers = ms.map(m => {
            let finalId = m.id;
            if (!finalId) {
                finalId = (maxId + autoIdCounter).toString().padStart(4, '0');
                autoIdCounter++;
            } else {
                finalId = finalId.padStart(4, '0');
            }
            return { ...m, id: finalId, joinDate: new Date().toISOString() };
        });
        const { error } = await supabase.from('members').insert(newMembers);
        if (error) return {success: 0, failed: ms.length, errors: []};
        setMembers(p => [...p, ...newMembers]);
        const batchId = Math.floor(1000 + Math.random() * 9000);
        const ids = newMembers.map(m => `- ${m.name} (${m.id})`).join('\n');
        logActivity('Bulk Add Members', `Batch #${batchId}: Added ${ms.length} members.\n\nMembers Added:\n${ids}`);
        showNotification(`${ms.length} members added.`, 'success');
        return {success: ms.length, failed: 0, errors: []};
    };

    // =========================================================================
    // 6. RENDER (Updated with OfflineStatus)
    // =========================================================================

    if (!isLoggedIn) return <Login onLogin={verifyLogin} onLoginAttempt={(s, u) => logActivity(s ? 'Login' : 'Login Failed', `User: ${u}`)} />;

    if (userRole === 'MEMBER' && currentMemberId) {
        const member = members.find(m => m.id === currentMemberId);
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <Header toggleSidebar={() => {}} onSignOut={handleSignOut} userName={member?.name} role="MEMBER" />
                <main className="pt-[65px]">
                    <MemberDashboard 
                        currentMember={member!} 
                        books={books} 
                        transactions={transactions} 
                        reservations={reservations} 
                        onCancelReservation={async (id) => { 
                             // Using handleLibraryAction for member cancel too
                             const updateData = { id, status: 'Cancelled (Member)' };
                             handleLibraryAction('reservations', 'UPDATE', updateData, () => {
                                setReservations(prev => prev.map(r => r.id === id ? {...r, status: 'Cancelled (Member)'} : r)); 
                                showNotification('Reservation cancelled.', 'success');
                             });
                             return {success: true, message: 'Cancelled'}; 
                        }} 
                        showNotification={showNotification} 
                        settings={settings} 
                    />
                </main>
                <OfflineStatus />
                {notification && <Toast message={notification.message} type={notification.type} onClose={closeNotification} />}
            </div>
        );
    }

    const uniqueCategories = Array.from(new Set(books.map(b => b.category))).sort();

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} setView={setCurrentView} currentView={currentView} />
            <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
                <Header toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} onSignOut={handleSignOut} role="LIBRARIAN" />
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-950" ref={mainContentRef}>
                    
                    {currentView === 'DASHBOARD' && (
                        <Dashboard 
                            transactions={transactions} 
                            totalBooks={books.length} 
                            totalMembers={members.length} 
                            activeLoans={transactions.filter(t => t.type === TransactionType.CheckOut).length - transactions.filter(t => t.type === TransactionType.CheckIn).length} 
                            overdueBooks={overdueBooks} 
                            overdueReservations={overdueReservations} 
                            onExtendReservation={handleUpdateReservationDate}
                            onCancelOverdueReservation={handleCancelOverdueReservation}
                            onLogActivity={logActivity} 
                        />
                    )}
                    
                    {currentView === 'ADD_MEMBER' && (
                        <AddMember 
                            onAddMember={handleAddMember} 
                            onBulkAddMembers={handleBulkAddMembers} 
                            showNotification={showNotification} 
                            existingMembers={members} 
                        />
                    )}

                    {currentView === 'ADD_BOOK' && (
                        <AddBook 
                            onAddBook={handleAddBook} 
                            onBulkAddBooks={handleBulkAddBooks} 
                            categories={uniqueCategories} 
                            showNotification={showNotification} 
                            existingBooks={books} 
                        />
                    )}
                    
                    {currentView === 'CHECKOUT_BOOK' && (
                        <CheckoutBook 
                            books={booksWithAvailability} 
                            members={members} 
                            categories={['All', ...uniqueCategories]} 
                            onCheckout={handleCheckout} 
                            reservations={reservations} 
                            transactions={transactions} 
                            showNotification={showNotification} 
                        />
                    )}
                    
                    {currentView === 'CHECKIN_BOOK' && (
                        <CheckinBook 
                            books={books} 
                            transactions={transactions} 
                            members={members} 
                            onCheckin={handleCheckin} 
                            onRenewLoan={handleRenewLoan} 
                            showNotification={showNotification} 
                        />
                    )}
                    
                    {currentView === 'RESERVE_BOOK' && (
                        <ReserveBook 
                            settings={settings} 
                            reservations={reservations} 
                            books={books} 
                            members={members} 
                            categories={['All', ...uniqueCategories]} 
                            booksWithAvailability={booksWithAvailability} 
                            transactions={transactions} 
                            onReserveBook={handleReserveBook} 
                            onCancelReservation={handleCancelReservation} 
                            onIssueBook={handleIssueReservedBook} 
                            onUpdateReservationDate={handleUpdateReservationDate} 
                            showNotification={showNotification} 
                        />
                    )}
                    
                    {currentView === 'MANAGE' && (
                        <Manage 
                            verifyAdminForReset={handleVerifyAdminForReset} 
                            onUpdateAdminPassword={handleUpdateAdminPassword} 
                            books={books} 
                            members={members} 
                            transactions={transactions} 
                            reservations={reservations} 
                            archiveHistory={archiveHistory} 
                            activityLog={activityLog} 
                            settings={settings} 
                            onUpdateBook={handleUpdateBook} 
                            onDeleteBook={handleDeleteBook} 
                            onUpdateMember={handleUpdateMember} 
                            onDeleteMember={handleDeleteMember} 
                            onResetSystem={handleResetSystem} 
                            onUpdateSettings={handleUpdateSettings} 
                            showNotification={showNotification} 
                            onLogActivity={logActivity} 
                        />
                    )}
                </main>
            </div>
            
            {/* ✅ OFFLINE STATUS UI ADDED HERE */}
            <OfflineStatus />
            
            {notification && <Toast message={notification.message} type={notification.type} onClose={closeNotification} />}
        </div>
    );
};

export default App;