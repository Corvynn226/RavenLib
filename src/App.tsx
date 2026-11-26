import { useCallback, useEffect, useMemo, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import type { AuthSession, Book, LibraryNotification, Loan } from './types';
import {
  borrowBookApi,
  extendLoanApi,
  fetchBooks,
  fetchMyLoans,
  fetchNotifications,
  loginDemoReader,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  returnLoanApi,
} from './api';
import { CatalogView } from './components/CatalogView';
import { LoansView } from './components/LoansView';
import { NotificationsView } from './components/NotificationsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { PdfReaderModal } from './components/PdfReaderModal';
import { AuthModal } from './components/AuthModal';

type AppView = 'catalog' | 'loans' | 'notifications' | 'admin';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('catalog');
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  const [memberSession, setMemberSession] = useState<AuthSession | null>(null);
  const [adminSession, setAdminSession] = useState<AuthSession | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [notifications, setNotifications] = useState<LibraryNotification[]>([]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingBorrowAfterAuth, setPendingBorrowAfterAuth] = useState<{
    book: Book;
    durationDays: number;
  } | null>(null);

  const [readerState, setReaderState] = useState<{
    book: Book;
    loan: Loan | null;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadBooks = useCallback(async () => {
    try {
      const list = await fetchBooks();
      setBooks(list);
    } catch {
      showToast('Gagal memuat daftar buku perpustakaan.');
    } finally {
      setLoadingBooks(false);
    }
  }, [showToast]);

  const loadMemberData = useCallback(async (token: string) => {
    try {
      const [userLoans, userNotifs] = await Promise.all([
        fetchMyLoans(token),
        fetchNotifications(token),
      ]);
      setLoans(userLoans);
      setNotifications(userNotifs);
    } catch {
      // Ignore transient refresh errors
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    if (!memberSession?.token) {
      setLoans([]);
      setNotifications([]);
      return;
    }
    loadMemberData(memberSession.token);

    // Poll every 30s for newly triggered overdue reminders
    const interval = setInterval(() => {
      loadMemberData(memberSession.token);
    }, 30_000);
    return () => clearInterval(interval);
  }, [memberSession?.token, loadMemberData]);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleBorrowBook = async (book: Book, durationDays: number) => {
    if (!memberSession) {
      setPendingBorrowAfterAuth({ book, durationDays });
      setAuthModalOpen(true);
      return;
    }
    const createdLoan = await borrowBookApi(
      memberSession.token,
      book.id,
      durationDays
    );
    await Promise.all([loadBooks(), loadMemberData(memberSession.token)]);
    showToast(`Buku "${book.title}" berhasil dipinjam selama ${durationDays} hari.`);

    // If reader modal is currently open on this book, upgrade to full loan access
    if (readerState?.book.id === book.id) {
      setReaderState({ book, loan: createdLoan });
    }
  };

  const handleMemberAuthenticated = async (session: AuthSession) => {
    setMemberSession(session);
    showToast(`Selamat datang, ${session.user.name}.`);
    if (pendingBorrowAfterAuth) {
      const { book, durationDays } = pendingBorrowAfterAuth;
      setPendingBorrowAfterAuth(null);
      try {
        const createdLoan = await borrowBookApi(session.token, book.id, durationDays);
        await Promise.all([loadBooks(), loadMemberData(session.token)]);
        showToast(`Buku "${book.title}" berhasil dipinjam.`);
        if (readerState?.book.id === book.id) {
          setReaderState({ book, loan: createdLoan });
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal meminjam buku.');
      }
    }
  };

  const handleQuickDemoSignIn = async () => {
    try {
      const session = await loginDemoReader();
      await handleMemberAuthenticated(session);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal masuk akun demo.');
    }
  };

  const handleReturnLoan = async (loanId: string) => {
    if (!memberSession) return;
    await returnLoanApi(memberSession.token, loanId);
    await Promise.all([loadBooks(), loadMemberData(memberSession.token)]);
    showToast('Buku berhasil dikembalikan ke koleksi perpustakaan.');
  };

  const handleExtendLoan = async (loanId: string) => {
    if (!memberSession) return;
    await extendLoanApi(memberSession.token, loanId);
    await loadMemberData(memberSession.token);
    showToast('Masa peminjaman diperpanjang 3 hari.');
  };

  const handleMarkNotifRead = async (notifId: string) => {
    if (!memberSession) return;
    await markNotificationReadApi(memberSession.token, notifId);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllNotifsRead = async () => {
    if (!memberSession) return;
    await markAllNotificationsReadApi(memberSession.token);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleProgressUpdated = (loanId: string, page: number) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === loanId ? { ...l, lastPageRead: page } : l))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#FBF9F5]/95 backdrop-blur-xs border-b border-[#E6E0D4]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className="font-serif text-xl font-semibold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pustaka Aksara
          </button>

          {/* Zone 2: Clean single-line text nav links */}
          <nav
            aria-label="Navigasi Utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveView('catalog')}
              className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeView === 'catalog'
                  ? 'border-[#1E3A8A] text-[#1C1917]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Katalog Buku
            </button>
            <button
              type="button"
              onClick={() => setActiveView('loans')}
              className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeView === 'loans'
                  ? 'border-[#1E3A8A] text-[#1C1917]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Rak Pinjaman
            </button>
            <button
              type="button"
              onClick={() => setActiveView('notifications')}
              className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeView === 'notifications'
                  ? 'border-[#1E3A8A] text-[#1C1917]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              <span>Notifikasi</span>
              {unreadNotifCount > 0 && (
                <span className="ml-1 font-mono tabular-nums text-xs text-[#B91C1C]">
                  ({unreadNotifCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                activeView === 'admin'
                  ? 'border-[#1E3A8A] text-[#1C1917]'
                  : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Dasbor Admin
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            {memberSession ? (
              <button
                type="button"
                onClick={() => {
                  setMemberSession(null);
                  showToast('Anda telah keluar dari sesi anggota.');
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] border border-[#D6CEBE] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Keluar dari akun anggota"
              >
                <User className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span className="max-w-[130px] truncate">{memberSession.user.name}</span>
                <LogOut className="w-3.5 h-3.5 text-[#57534E]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Masuk Anggota
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation row */}
        <nav
          aria-label="Navigasi Seluler"
          className="md:hidden flex items-center justify-around border-t border-[#E6E0D4] px-2 py-2 text-xs font-medium bg-[#FBF9F5]"
        >
          <button
            type="button"
            onClick={() => setActiveView('catalog')}
            className={`px-2 py-1 whitespace-nowrap ${
              activeView === 'catalog' ? 'text-[#1E3A8A] font-semibold' : 'text-[#57534E]'
            }`}
          >
            Katalog
          </button>
          <button
            type="button"
            onClick={() => setActiveView('loans')}
            className={`px-2 py-1 whitespace-nowrap ${
              activeView === 'loans' ? 'text-[#1E3A8A] font-semibold' : 'text-[#57534E]'
            }`}
          >
            Pinjaman
          </button>
          <button
            type="button"
            onClick={() => setActiveView('notifications')}
            className={`px-2 py-1 whitespace-nowrap ${
              activeView === 'notifications'
                ? 'text-[#1E3A8A] font-semibold'
                : 'text-[#57534E]'
            }`}
          >
            Notifikasi{unreadNotifCount > 0 ? ` (${unreadNotifCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`px-2 py-1 whitespace-nowrap ${
              activeView === 'admin' ? 'text-[#1E3A8A] font-semibold' : 'text-[#57534E]'
            }`}
          >
            Admin
          </button>
        </nav>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 md:px-8 py-8 md:py-12">
        {loadingBooks ? (
          <div className="py-20 text-center text-sm text-[#57534E]">
            Memuat koleksi perpustakaan...
          </div>
        ) : activeView === 'catalog' ? (
          <CatalogView
            books={books}
            loans={loans}
            isSignedIn={Boolean(memberSession)}
            onBorrowBook={handleBorrowBook}
            onOpenReader={(book, loan) => setReaderState({ book, loan })}
            onGoToLoans={() => setActiveView('loans')}
            onGoToNotifications={() => setActiveView('notifications')}
          />
        ) : activeView === 'loans' ? (
          <LoansView
            loans={loans}
            isSignedIn={Boolean(memberSession)}
            onOpenAuth={() => setAuthModalOpen(true)}
            onQuickDemoSignIn={handleQuickDemoSignIn}
            onOpenReader={(book, loan) => setReaderState({ book, loan })}
            onReturnLoan={handleReturnLoan}
            onExtendLoan={handleExtendLoan}
            onGoToCatalog={() => setActiveView('catalog')}
          />
        ) : activeView === 'notifications' ? (
          <NotificationsView
            notifications={notifications}
            isSignedIn={Boolean(memberSession)}
            onOpenAuth={() => setAuthModalOpen(true)}
            onQuickDemoSignIn={handleQuickDemoSignIn}
            onMarkRead={handleMarkNotifRead}
            onMarkAllRead={handleMarkAllNotifsRead}
            onGoToLoans={() => setActiveView('loans')}
          />
        ) : (
          <AdminDashboardView
            adminSession={adminSession}
            books={books}
            onAdminAuthenticated={(session) => {
              setAdminSession(session);
              showToast('Berhasil masuk ke Dasbor Admin.');
            }}
            onAdminSignOut={() => {
              setAdminSession(null);
              showToast('Sesi admin telah diakhiri.');
            }}
            onBooksChanged={loadBooks}
            onOpenReader={(book) => setReaderState({ book, loan: null })}
            onToast={showToast}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E6E0D4] bg-[#FBF9F5] py-6 mt-12">
        <div className="max-w-[1280px] mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#57534E]">
          <span>Pustaka Aksara — Perpustakaan Digital & Ruang Baca Daring</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveView('catalog')}
              className="hover:text-[#1C1917] cursor-pointer"
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => setActiveView('loans')}
              className="hover:text-[#1C1917] cursor-pointer"
            >
              Rak Pinjaman
            </button>
            <button
              type="button"
              onClick={() => setActiveView('admin')}
              className="hover:text-[#1C1917] cursor-pointer"
            >
              Portal Admin
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingBorrowAfterAuth(null);
        }}
        onAuthenticated={handleMemberAuthenticated}
      />

      <PdfReaderModal
        book={readerState?.book || null}
        loan={readerState?.loan || null}
        token={
          activeView === 'admin' && adminSession
            ? adminSession.token
            : memberSession?.token || null
        }
        isAdmin={activeView === 'admin' && Boolean(adminSession)}
        onClose={() => setReaderState(null)}
        onBorrowFromPreview={async (book) => {
          await handleBorrowBook(book, 7);
        }}
        onProgressUpdated={handleProgressUpdated}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#1C1917] text-[#FBF9F5] px-4 py-3 rounded-md shadow-lg text-xs font-medium"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
