export type UserRole = 'member' | 'admin';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  year: number;
  isbn: string;
  pages: number;
  language: string;
  description: string;
  coverUrl: string | null;
  pdfFilename: string;
  pdfSizeBytes: number;
  totalCopies: number;
  availableCopies: number;
  createdAt: string;
}

export type LoanStatus = 'borrowed' | 'returned';

export interface Loan {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  userEmail: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: LoanStatus;
  lastPageRead: number;
  extendedCount: number;
  isOverdue: boolean;
  daysOverdue: number;
  estimatedFineIdr: number;
  book?: Book;
}

export type NotificationType =
  | 'overdue'
  | 'due_soon'
  | 'admin_reminder'
  | 'borrow_confirmed'
  | 'return_confirmed';

export interface LibraryNotification {
  id: string;
  userId: string;
  loanId: string | null;
  bookId: string | null;
  bookTitle: string | null;
  type: NotificationType;
  title: string;
  message: string;
  daysOverdue: number;
  read: boolean;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

export interface AdminStatus {
  mode: 'env' | 'claimed' | 'unclaimed';
  configured: boolean;
}
