import type {
  AdminStatus,
  AuthSession,
  Book,
  LibraryNotification,
  Loan,
} from './types';

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || 'Terjadi kesalahan pada server.');
  }
  return data as T;
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchBooks(): Promise<Book[]> {
  const res = await fetch('/api/books');
  const data = await handleJson<{ books: Book[] }>(res);
  return data.books;
}

export async function loginDemoReader(): Promise<AuthSession> {
  const res = await fetch('/api/auth/demo-reader', { method: 'POST' });
  return handleJson<AuthSession>(res);
}

export async function registerMemberApi(
  name: string,
  email: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  return handleJson<AuthSession>(res);
}

export async function loginMemberApi(
  email: string,
  password: string
): Promise<AuthSession> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return handleJson<AuthSession>(res);
}

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const res = await fetch('/api/admin/status');
  return handleJson<AdminStatus>(res);
}

export async function claimAdminApi(password: string): Promise<AuthSession> {
  const res = await fetch('/api/admin/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return handleJson<AuthSession>(res);
}

export async function loginAdminApi(password: string): Promise<AuthSession> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return handleJson<AuthSession>(res);
}

export async function fetchMyLoans(token: string): Promise<Loan[]> {
  const res = await fetch('/api/loans', { headers: authHeaders(token) });
  const data = await handleJson<{ loans: Loan[] }>(res);
  return data.loans;
}

export async function borrowBookApi(
  token: string,
  bookId: string,
  durationDays: number
): Promise<Loan> {
  const res = await fetch('/api/loans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ bookId, durationDays }),
  });
  const data = await handleJson<{ loan: Loan }>(res);
  return data.loan;
}

export async function returnLoanApi(token: string, loanId: string): Promise<Loan> {
  const res = await fetch(`/api/loans/${loanId}/return`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await handleJson<{ loan: Loan }>(res);
  return data.loan;
}

export async function extendLoanApi(token: string, loanId: string): Promise<Loan> {
  const res = await fetch(`/api/loans/${loanId}/extend`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  const data = await handleJson<{ loan: Loan }>(res);
  return data.loan;
}

export async function saveReadingProgressApi(
  token: string,
  loanId: string,
  lastPageRead: number
): Promise<void> {
  await fetch(`/api/loans/${loanId}/progress`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ lastPageRead }),
  });
}

export async function fetchNotifications(token: string): Promise<LibraryNotification[]> {
  const res = await fetch('/api/notifications', { headers: authHeaders(token) });
  const data = await handleJson<{ notifications: LibraryNotification[] }>(res);
  return data.notifications;
}

export async function markNotificationReadApi(
  token: string,
  notificationId: string
): Promise<void> {
  const res = await fetch(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function markAllNotificationsReadApi(token: string): Promise<void> {
  const res = await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: authHeaders(token),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function uploadBookPdfApi(
  adminToken: string,
  formData: FormData
): Promise<Book> {
  const res = await fetch('/api/admin/books', {
    method: 'POST',
    headers: authHeaders(adminToken),
    body: formData,
  });
  const data = await handleJson<{ book: Book }>(res);
  return data.book;
}

export async function deleteBookApi(adminToken: string, bookId: string): Promise<void> {
  const res = await fetch(`/api/admin/books/${bookId}`, {
    method: 'DELETE',
    headers: authHeaders(adminToken),
  });
  await handleJson<{ ok: boolean }>(res);
}

export async function fetchAdminLoansApi(adminToken: string): Promise<Loan[]> {
  const res = await fetch('/api/admin/loans', { headers: authHeaders(adminToken) });
  const data = await handleJson<{ loans: Loan[] }>(res);
  return data.loans;
}

export async function sendOverdueRemindersApi(
  adminToken: string,
  loanId?: string
): Promise<{ sentCount: number }> {
  const res = await fetch('/api/admin/notifications/remind-overdue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(adminToken),
    },
    body: JSON.stringify(loanId ? { loanId } : {}),
  });
  return handleJson<{ sentCount: number }>(res);
}

export async function simulateOverdueApi(
  adminToken: string,
  loanId: string
): Promise<Loan> {
  const res = await fetch(`/api/admin/loans/${loanId}/simulate-overdue`, {
    method: 'POST',
    headers: authHeaders(adminToken),
  });
  const data = await handleJson<{ loan: Loan }>(res);
  return data.loan;
}
