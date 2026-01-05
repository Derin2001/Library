export enum BookStatus {
  OnShelf = 'On Shelf',
  CheckedOut = 'Checked Out',
  Reserved = 'Reserved',
  Unavailable = 'Unavailable'
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  totalCopies: number;
  language: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  joinDate: string;
}

export enum TransactionType {
  CheckOut = 'CheckOut',
  CheckIn = 'CheckIn',
}

export interface Transaction {
  id: string;
  bookId: string;
  bookTitle: string;
  memberId: string;
  type: TransactionType;
  date: string;
  dueDate?: string;
  renewalCount?: number;
}

export interface Reservation {
  id: string;
  bookId: string;
  memberId: string;
  reservationDate: string;
  pickupDate: string;
  status: 'Active' | 'Fulfilled' | 'Cancelled' | 'Expired' | 'Cancelled (Overdue)' | 'Cancelled (Member)';
}

export interface OverdueBook {
    bookTitle: string;
    memberId: string;
    memberName: string;
    dueDate: Date;
    daysOverdue: number;
}

export interface OverdueReservation {
    reservationId: string;
    bookTitle: string;
    memberId: string;
    memberName: string;
    pickupDate: string;
}

export interface ArchiveRecord {
    id: string;
    type: 'BOOK_DELETED' | 'MEMBER_DELETED';
    itemId: string;
    itemName: string;
    additionalInfo?: string;
    history?: {
        transactions: Transaction[];
        reservations: Reservation[];
    };
    deletedAt: string;
}

export interface ActivityLogEntry {
    id: string;
    timestamp: string;
    action: string;
    details: string;
}

export interface Settings {
    loanPeriodDays: number;
    maxRenewals: number;
}

export type View = 
  | 'DASHBOARD'
  | 'ADD_MEMBER'
  | 'CHECKOUT_BOOK'
  | 'CHECKIN_BOOK'
  | 'ADD_BOOK'
  | 'RESERVE_BOOK'
  | 'MANAGE';

export type UserRole = 'LIBRARIAN' | 'MEMBER' | null;