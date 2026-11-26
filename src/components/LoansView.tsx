import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  RotateCcw,
  UserCheck,
} from 'lucide-react';
import type { Book, Loan } from '../types';
import { BookCover } from './BookCover';

interface LoansViewProps {
  loans: Loan[];
  isSignedIn: boolean;
  onOpenAuth: () => void;
  onQuickDemoSignIn: () => Promise<void>;
  onOpenReader: (book: Book, loan: Loan) => void;
  onReturnLoan: (loanId: string) => Promise<void>;
  onExtendLoan: (loanId: string) => Promise<void>;
  onGoToCatalog: () => void;
}

function formatDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function LoansView({
  loans,
  isSignedIn,
  onOpenAuth,
  onQuickDemoSignIn,
  onOpenReader,
  onReturnLoan,
  onExtendLoan,
  onGoToCatalog,
}: LoansViewProps) {
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isSignedIn) {
    return (
      <section className="max-w-xl mx-auto my-8 bg-white border border-[#E6E0D4] rounded-lg p-8 text-center space-y-5">
        <BookOpen className="w-8 h-8 text-[#1E3A8A] mx-auto" />
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold text-[#1C1917]">
            Rak Pinjaman Anggota
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            Masuk sebagai anggota perpustakaan untuk melihat buku yang sedang Anda
            pinjam, membaca dokumen PDF secara penuh, dan memantau batas waktu
            pengembalian.
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

  const activeLoans = loans.filter((l) => l.status === 'borrowed');
  const returnedLoans = loans.filter((l) => l.status === 'returned');

  async function handleAction(loanId: string, fn: (id: string) => Promise<void>) {
    setErrorMsg(null);
    setBusyLoanId(loanId);
    try {
      await fn(loanId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses tindakan.');
    } finally {
      setBusyLoanId(null);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6E0D4] pb-5">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1C1917]">
            Rak Pinjaman Saya
          </h1>
          <p className="text-sm text-[#57534E] mt-1">
            Daftar buku yang sedang dipinjam beserta status tenggat pengembalian dan
            riwayat bacaan.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-[#57534E]">
          {activeLoans.length} / 5 Kuota Pinjaman Aktif
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md">
          {errorMsg}
        </div>
      )}

      {/* Active Loans */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#57534E]">
          Sedang Dipinjam ({activeLoans.length})
        </h2>

        {activeLoans.length === 0 ? (
          <div className="bg-white border border-[#E6E0D4] rounded-lg p-10 text-center space-y-3">
            <p className="font-serif text-lg font-medium text-[#1C1917]">
              Belum ada buku yang sedang dipinjam
            </p>
            <p className="text-sm text-[#57534E]">
              Kunjungi katalog untuk meminjam buku dan membacanya langsung melalui
              aplikasi.
            </p>
            <button
              type="button"
              onClick={onGoToCatalog}
              className="mt-2 px-4 py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors cursor-pointer"
            >
              Jelajahi Katalog Buku
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {activeLoans.map((loan) => {
              const book = loan.book;
              if (!book) return null;

              const msUntilDue = new Date(loan.dueAt).getTime() - Date.now();
              const isDueSoon = !loan.isOverdue && msUntilDue <= 24 * 60 * 60 * 1000;
              const daysLeft = Math.max(
                0,
                Math.ceil(msUntilDue / (24 * 60 * 60 * 1000))
              );

              return (
                <article
                  key={loan.id}
                  className={`flex flex-col sm:flex-row gap-5 p-5 bg-white rounded-lg border ${
                    loan.isOverdue ? 'border-[#FCA5A5]' : 'border-[#E6E0D4]'
                  }`}
                >
                  <BookCover
                    book={book}
                    className="w-28 aspect-[3/4] shrink-0 rounded mx-auto sm:mx-0"
                  />

                  <div className="flex-1 flex flex-col justify-between gap-4 min-w-0">
                    <div className="space-y-2">
                      {/* Explicit status indicator with icon + text (not color-only) */}
                      {loan.isOverdue ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="tabular-nums">
                            Terlambat {loan.daysOverdue} hari · Denda Rp{' '}
                            {loan.estimatedFineIdr.toLocaleString('id-ID')}
                          </span>
                        </div>
                      ) : isDueSoon ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B45309]">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Segera jatuh tempo dalam 24 jam</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15803D]">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="tabular-nums">
                            Aktif · Sisa {daysLeft} hari
                          </span>
                        </div>
                      )}

                      <h3 className="font-serif text-lg font-semibold text-[#1C1917] leading-snug">
                        {book.title}
                      </h3>
                      <p className="text-xs text-[#57534E]">{book.author}</p>

                      <div className="grid grid-cols-2 gap-2 pt-2 text-xs border-t border-[#F0EBE1]">
                        <div>
                          <span className="text-[#78716C] block">Dipinjam</span>
                          <span className="font-mono tabular-nums text-[#1C1917]">
                            {formatDateId(loan.borrowedAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78716C] block">Batas Kembali</span>
                          <span
                            className={`font-mono tabular-nums font-medium ${
                              loan.isOverdue ? 'text-[#B91C1C]' : 'text-[#1C1917]'
                            }`}
                          >
                            {formatDateId(loan.dueAt)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-[#57534E] font-mono tabular-nums">
                        Terakhir dibaca: Halaman {loan.lastPageRead}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenReader(book, loan)}
                        className="px-3.5 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Baca PDF
                      </button>

                      {!loan.isOverdue && loan.extendedCount === 0 && (
                        <button
                          type="button"
                          disabled={busyLoanId === loan.id}
                          onClick={() => handleAction(loan.id, onExtendLoan)}
                          className="px-3 py-2 text-xs font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded-md transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          Perpanjang +3 Hari
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busyLoanId === loan.id}
                        onClick={() => handleAction(loan.id, onReturnLoan)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1C1917] border border-[#D6CEBE] hover:bg-[#F3EFE7] rounded-md transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>
                          {busyLoanId === loan.id ? 'Memproses...' : 'Kembalikan'}
                        </span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Returned History */}
      {returnedLoans.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#57534E]">
            Riwayat Pengembalian ({returnedLoans.length})
          </h2>
          <div className="bg-white border border-[#E6E0D4] rounded-lg overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E6E0D4] bg-[#FBF9F5] text-xs text-[#57534E]">
                  <th className="py-3 px-4 font-medium">Judul Buku</th>
                  <th className="py-3 px-4 font-medium">Tanggal Pinjam</th>
                  <th className="py-3 px-4 font-medium">Tanggal Kembali</th>
                  <th className="py-3 px-4 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBE1]">
                {returnedLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-[#FBF9F5]">
                    <td className="py-3 px-4 font-medium text-[#1C1917]">
                      {loan.book?.title || 'Koleksi Perpustakaan'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#57534E]">
                      {formatDateId(loan.borrowedAt)}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-xs text-[#57534E]">
                      {loan.returnedAt ? formatDateId(loan.returnedAt) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-xs font-medium text-[#15803D]">
                      Dikembalikan
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
