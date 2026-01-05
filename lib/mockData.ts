
import { Book, Member, Transaction, Reservation, TransactionType, Settings } from '../types';
import { subDays, format, formatISO, addDays } from 'date-fns';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const initialBooks: Book[] = [
  { id: "B001", title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "9780743273565", category: "Classic Fiction", totalCopies: 3, language: "English" },
  { id: "B002", title: "To Kill a Mockingbird", author: "Harper Lee", isbn: "9780061120084", category: "Classic Fiction", totalCopies: 2, language: "English" },
  { id: "B003", title: "1984", author: "George Orwell", isbn: "9780451524935", category: "Dystopian", totalCopies: 4, language: "English" },
  { id: "B004", title: "Pride and Prejudice", author: "Jane Austen", isbn: "9780141439518", category: "Romance", totalCopies: 2, language: "English" },
  { id: "B005", title: "The Catcher in the Rye", author: "J.D. Salinger", isbn: "9780316769488", category: "Coming-of-Age", totalCopies: 1, language: "English" },
  { id: "B006", title: "The Lord of the Rings", author: "J.R.R. Tolkien", isbn: "9780618640157", category: "Fantasy", totalCopies: 3, language: "English" },
  { id: "B007", title: "Brave New World", author: "Aldous Huxley", isbn: "9780060850524", category: "Dystopian", totalCopies: 2, language: "English" },
  { id: "B008", title: "Moby Dick", author: "Herman Melville", isbn: "9781503280786", category: "Adventure", totalCopies: 1, language: "English" },
  { id: "B009", title: "Don Quixote", author: "Miguel de Cervantes", isbn: "9780060934347", category: "Adventure", totalCopies: 1, language: "Spanish" },
];

export const initialMembers: Member[] = [
  { id: "M001", name: "Alice Johnson", email: "alice.j@example.com", phoneNumber: "5550101", joinDate: formatISO(subDays(new Date(), 30)) },
  { id: "M002", name: "Bob Smith", email: "bob.s@example.com", phoneNumber: "5550102", joinDate: formatISO(subDays(new Date(), 90)) },
  { id: "M003", name: "Charlie Brown", email: "charlie.b@example.com", phoneNumber: "5550103", joinDate: formatISO(subDays(new Date(), 5)) },
];

export const initialTransactions: Transaction[] = [
  { id: generateId(), bookId: "B002", bookTitle: "To Kill a Mockingbird", memberId: "M001", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 2)), renewalCount: 0 },
  { id: generateId(), bookId: "B006", bookTitle: "The Lord of the Rings", memberId: "M003", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 5)), renewalCount: 0 },
  { id: generateId(), bookId: "B001", bookTitle: "The Great Gatsby", memberId: "M002", type: TransactionType.CheckIn, date: formatISO(subDays(new Date(), 1)), renewalCount: 0 },
  { id: generateId(), bookId: "B001", bookTitle: "The Great Gatsby", memberId: "M002", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 10)), renewalCount: 0 },
  { id: generateId(), bookId: "B003", bookTitle: "1984", memberId: "M001", type: TransactionType.CheckIn, date: formatISO(subDays(new Date(), 6)), renewalCount: 0 },
  { id: generateId(), bookId: "B003", bookTitle: "1984", memberId: "M001", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 12)), renewalCount: 0 },
  { id: generateId(), bookId: "B003", bookTitle: "1984", memberId: "M002", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 4)), renewalCount: 0 },
  // Overdue book for testing
  { id: generateId(), bookId: "B005", bookTitle: "The Catcher in the Rye", memberId: "M003", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 20)), renewalCount: 0 },
  // Fulfilled reservation transaction
  { id: generateId(), bookId: "B007", bookTitle: "Brave New World", memberId: "M001", type: TransactionType.CheckOut, date: formatISO(subDays(new Date(), 8)), renewalCount: 0 },
  { id: generateId(), bookId: "B007", bookTitle: "Brave New World", memberId: "M001", type: TransactionType.CheckIn, date: formatISO(subDays(new Date(), 1)), renewalCount: 0 },
  
  // --- NOTIFICATION TEST DATA FOR M001 ---
  
  // 1. Due Tomorrow: B009 (Don Quixote) for M001
  // Created 14 days ago, assuming 15 day loan period -> Due tomorrow
  { 
      id: generateId(), 
      bookId: "B009", 
      bookTitle: "Don Quixote", 
      memberId: "M001", 
      type: TransactionType.CheckOut, 
      date: formatISO(subDays(new Date(), 14)), 
      renewalCount: 0,
      dueDate: formatISO(addDays(new Date(), 1)) // Explicitly due tomorrow
  },
  
  // 2. Occupy B008 (Moby Dick) so it is UNAVAILABLE for reservation test
  // Moby Dick has 1 copy (see initialBooks). M002 borrows it.
  { 
      id: generateId(), 
      bookId: "B008", 
      bookTitle: "Moby Dick", 
      memberId: "M002", 
      type: TransactionType.CheckOut, 
      date: formatISO(subDays(new Date(), 2)), 
      renewalCount: 0 
  }
];

export const initialReservations: Reservation[] = [
    { id: generateId(), bookId: "B004", memberId: "M002", reservationDate: formatISO(new Date()), pickupDate: format(addDays(new Date(), 3), 'yyyy-MM-dd'), status: 'Active' },
    // Overdue reservation for testing
    { id: generateId(), bookId: "B001", memberId: "M001", reservationDate: formatISO(subDays(new Date(), 5)), pickupDate: format(subDays(new Date(), 2), 'yyyy-MM-dd'), status: 'Active' },
    // Past fulfilled reservation
    { id: generateId(), bookId: "B007", memberId: "M001", reservationDate: formatISO(subDays(new Date(), 10)), pickupDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'), status: 'Fulfilled'},
    // Past cancelled reservation
    { id: generateId(), bookId: "B008", memberId: "M002", reservationDate: formatISO(subDays(new Date(), 5)), pickupDate: format(subDays(new Date(), 2), 'yyyy-MM-dd'), status: 'Cancelled'},
    
    // --- NOTIFICATION TEST DATA FOR M001 ---
    
    // 1. Reservation Tomorrow - AVAILABLE
    // B006 (Lord of the Rings) has 3 copies. 1 is checked out to M003 (in transactions). 2 are available.
    { 
        id: generateId(), 
        bookId: "B006", 
        memberId: "M001", 
        reservationDate: formatISO(subDays(new Date(), 3)), 
        pickupDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'), // Tomorrow
        status: 'Active' 
    },

    // 2. Reservation Tomorrow - UNAVAILABLE
    // B008 (Moby Dick) has 1 copy. Checked out to M002 (in transactions above). 0 available.
    { 
        id: generateId(), 
        bookId: "B008", 
        memberId: "M001", 
        reservationDate: formatISO(subDays(new Date(), 3)), 
        pickupDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'), // Tomorrow
        status: 'Active' 
    }
];

export const initialSettings: Settings = {
    loanPeriodDays: 15,
    maxRenewals: 2
};
