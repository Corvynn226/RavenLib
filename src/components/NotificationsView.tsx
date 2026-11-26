import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Clock,
  Info,
  UserCheck,
} from 'lucide-react';
import type { LibraryNotification } from '../types';

interface NotificationsViewProps {
  notifications: LibraryNotification[];
  isSignedIn: boolean;
  onOpenAuth: () => void;
  onQuickDemoSignIn: () => Promise<void>;
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onGoToLoans: () => void;
}

function formatDateTimeId(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsView({
  notifications,
  isSignedIn,
  onOpenAuth,
  onQuickDemoSignIn,
  onMarkRead,
  onMarkAllRead,
  onGoToLoans,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'overdue'>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    if (filter === 'overdue') {
      return notifications.filter(
        (n) =>
          n.type === 'overdue' ||
          n.type === 'admin_reminder' ||
          n.type === 'due_soon'
      );
    }
    return notifications;
  }, [notifications, filter]);

  if (!isSignedIn) {
    return (
      <section className="max-w-xl mx-auto my-8 bg-white border border-[#E6E0D4] rounded-lg p-8 text-center space-y-5">
        <Bell className="w-8 h-8 text-[#1E3A8A] mx-auto" />
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold text-[#1C1917]">
            Notifikasi Pengembalian Buku
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            Masuk sebagai anggota perpustakaan untuk menerima pengingat otomatis saat
            buku mendekati jatuh tempo atau melewati batas waktu pengembalian.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onQuickDemoSignIn}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Masuk Demo (Rani Pratama)</span>
          </button>
          <button
            type="button"
            onClick={onOpenAuth}
            className="px-4 py-2.5 text-sm font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] border border-[#D6CEBE] rounded-md transition-colors cursor-pointer"
          >
            Masuk / Daftar Akun
          </button>
        </div>
      </section>
    );
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await onMarkAllRead();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6E0D4] pb-5">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1C1917]">
            Pusat Notifikasi
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Pengingat otomatis keterlambatan pengembalian buku, jadwal jatuh tempo, dan
            catatan sirkulasi Anda.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markingAll}
            onClick={handleMarkAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] border border-[#D6CEBE] rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Tandai Semua Sudah Dibaca</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-[#1E3A8A] text-white'
              : 'bg-[#F3EFE7] text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Semua ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'unread'
              ? 'bg-[#1E3A8A] text-white'
              : 'bg-[#F3EFE7] text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Belum Dibaca ({unreadCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter('overdue')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
            filter === 'overdue'
              ? 'bg-[#1E3A8A] text-white'
              : 'bg-[#F3EFE7] text-[#57534E] hover:text-[#1C1917]'
          }`}
        >
          Pengingat Jatuh Tempo & Terlambat
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E6E0D4] rounded-lg p-12 text-center space-y-2">
          <p className="font-serif text-lg font-medium text-[#1C1917]">
            Tidak ada notifikasi pada tampilan ini
          </p>
          <p className="text-sm text-[#57534E]">
            Semua pengingat peminjaman dan pengembalian Anda sudah tertangani.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E6E0D4] bg-white border border-[#E6E0D4] rounded-lg overflow-hidden">
          {filtered.map((notif) => {
            const isOverdueAlert =
              notif.type === 'overdue' || notif.type === 'admin_reminder';
            const isDueSoon = notif.type === 'due_soon';

            return (
              <article
                key={notif.id}
                className={`p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${
                  notif.read ? 'bg-white' : 'bg-[#FBF9F5]'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-0.5 shrink-0">
                    {isOverdueAlert ? (
                      <AlertTriangle className="w-5 h-5 text-[#B91C1C]" />
                    ) : isDueSoon ? (
                      <Clock className="w-5 h-5 text-[#B45309]" />
                    ) : (
                      <Info className="w-5 h-5 text-[#1E3A8A]" />
                    )}
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                      <span
                        className={`font-semibold ${
                          isOverdueAlert
                            ? 'text-[#B91C1C]'
                            : isDueSoon
                              ? 'text-[#B45309]'
                              : 'text-[#1E3A8A]'
                        }`}
                      >
                        {isOverdueAlert
                          ? 'Pengingat Terlambat'
                          : isDueSoon
                            ? 'Mendekati Tenggat'
                            : 'Informasi Sirkulasi'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatDateTimeId(notif.createdAt)}
                      </span>
                      {!notif.read && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#1C1917]">
                            Belum dibaca
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="font-serif text-lg font-semibold text-[#1C1917]">
                      {notif.title}
                    </h2>
                    <p className="text-sm text-[#44403C] leading-relaxed">
                      {notif.message}
                    </p>

                    {(isOverdueAlert || isDueSoon) && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={onGoToLoans}
                          className="text-xs font-medium text-[#1E3A8A] hover:underline cursor-pointer"
                        >
                          Buka Rak Pinjaman untuk mengembalikan buku
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!notif.read && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(notif.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#1C1917] bg-white border border-[#D6CEBE] hover:bg-[#F3EFE7] rounded-md transition-colors shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Tandai Dibaca</span>
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
