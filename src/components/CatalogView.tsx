import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Search,
  X,
} from 'lucide-react';
import type { Book, Loan } from '../types';
import { BookCover } from './BookCover';

interface CatalogViewProps {
  books: Book[];
  loans: Loan[];
  isSignedIn: boolean;
  onBorrowBook: (book: Book, durationDays: number) => Promise<void>;
  onOpenReader: (book: Book, loan: Loan | null) => void;
  onGoToLoans: () => void;
  onGoToNotifications: () => void;
}

export function CatalogView({
  books,
  loans,
  isSignedIn,
  onBorrowBook,
  onOpenReader,
  onGoToLoans,
  onGoToNotifications,
}: CatalogViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [durationDays, setDurationDays] = useState(7);
  const [borrowingId, setBorrowingId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(books.map((b) => b.category)));
    return ['Semua', ...unique];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const matchesCat =
        selectedCategory === 'Semua' || book.category === selectedCategory;
      const matchesSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        book.category.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [books, searchQuery, selectedCategory]);

  const activeLoansByBookId = useMemo(() => {
    const map = new Map<string, Loan>();
    for (const loan of loans) {
      if (loan.status === 'borrowed') {
        map.set(loan.bookId, loan);
      }
    }
    return map;
  }, [loans]);

  const overdueLoans = useMemo(
    () => loans.filter((l) => l.status === 'borrowed' && l.isOverdue),
    [loans]
  );

  const totalAvailableCopies = useMemo(
    () => books.reduce((sum, b) => sum + b.availableCopies, 0),
    [books]
  );

  async function handleBorrow(book: Book, days: number) {
    setFeedbackError(null);
    setBorrowingId(book.id);
    try {
      await onBorrowBook(book, days);
      setDetailBook(null);
    } catch (err) {
      setFeedbackError(
        err instanceof Error ? err.message : 'Gagal meminjam buku.'
      );
    } finally {
      setBorrowingId(null);
    }
  }

  return (
    <div className="space-y-12">
      {/* Editorial Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-between py-2 space-y-6">
          <div className="space-y-4">
            <p className="text-xs tracking-widest uppercase text-[#57534E] font-medium">
              Koleksi Perpustakaan Daring
            </p>
            <h1 className="font-serif text-4xl lg:text-5xl font-semibold text-[#1C1917] leading-[1.12] tracking-tight">
              Pinjam buku secara daring dan baca langsung di ruang baca digital
            </h1>
            <p className="text-base text-[#57534E] leading-relaxed max-w-xl">
              Telusuri monograf arsitektur, kajian sains maritim, filsafat, dan arsip
              sejarah dalam format PDF terkurasi. Pantau tenggat pengembalian dan terima
              pengingat otomatis agar koleksi tetap berputar bagi seluruh anggota.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#katalog-koleksi"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors whitespace-nowrap"
            >
              <span>Jelajahi Koleksi</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onGoToLoans}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] border border-[#D6CEBE] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              <span>Buka Rak Pinjaman</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-6">
          <figure className="h-full flex flex-col">
            <div className="flex-1 overflow-hidden border border-[#E6E0D4] rounded-lg bg-[#F3EFE7] min-h-[260px] lg:min-h-[360px]">
              <img
                src="/src/assets/images/hero_reading_room_1795676566980.jpg"
                alt="Suasana ruang baca Pustaka Aksara dengan meja kayu ek dan cahaya alami"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <figcaption className="mt-2.5 text-xs text-[#57534E] flex items-center justify-between">
              <span>Ruang Baca Utama Pustaka Aksara</span>
              <span className="font-mono tabular-nums">Akses Daring 24 Jam</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Operational Utility Ribbon (4 columns below hero split) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border-y border-[#E6E0D4] divide-y lg:divide-y-0 lg:divide-x divide-[#E6E0D4] bg-[#FFFFFF]">
        <div className="px-5 py-4">
          <p className="text-xs text-[#57534E]">Judul Tersedia</p>
          <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-[#1C1917]">
            {books.length} Judul
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#57534E]">Salinan Siap Pinjam</p>
          <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-[#1C1917]">
            {totalAvailableCopies} Eksemplar
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#57534E]">Durasi Peminjaman</p>
          <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-[#1C1917]">
            3 / 7 / 14 Hari
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-[#57534E]">Denda Keterlambatan</p>
          <p className="mt-1 text-xl font-semibold font-mono tabular-nums text-[#1C1917]">
            Rp 2.000 / Hari
          </p>
        </div>
      </section>

      {/* Overdue Notice for Signed-In Member */}
      {isSignedIn && overdueLoans.length > 0 && (
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B91C1C] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="font-sans text-sm font-semibold text-[#991B1B]">
                Peringatan Pengembalian Terlambat ({overdueLoans.length} buku)
              </h2>
              <p className="text-xs text-[#7F1D1D] leading-relaxed">
                Anda memiliki {overdueLoans.length} buku yang melewati batas waktu
                pengembalian. Segera kembalikan melalui Rak Pinjaman agar keterlambatan
                tidak bertambah.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onGoToNotifications}
              className="px-3.5 py-2 text-xs font-medium text-[#991B1B] bg-white border border-[#FCA5A5] hover:bg-[#FEE2E2] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              Lihat Notifikasi
            </button>
            <button
              type="button"
              onClick={onGoToLoans}
              className="px-3.5 py-2 text-xs font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              Kelola Pinjaman
            </button>
          </div>
        </section>
      )}

      {/* Catalog Search & Filter Toolbar */}
      <section id="katalog-koleksi" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E6E0D4] pb-5">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#1C1917]">
              Katalog Buku Digital
            </h2>
            <p className="text-sm text-[#57534E] mt-1">
              Pilih buku untuk membaca pratinjau atau meminjam salinan digital secara daring.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul, penulis, atau ISBN..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#1E3A8A] text-white'
                  : 'bg-[#F3EFE7] text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {feedbackError && (
          <div className="p-3 text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-md">
            {feedbackError}
          </div>
        )}

        {filteredBooks.length === 0 ? (
          <div className="py-16 text-center bg-white border border-[#E6E0D4] rounded-lg space-y-2">
            <p className="font-serif text-lg font-medium text-[#1C1917]">
              Tidak ada buku yang cocok dengan pencarian
            </p>
            <p className="text-sm text-[#57534E]">
              Coba ubah kata kunci atau pilih kategori koleksi lainnya.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredBooks.map((book) => {
              const activeLoan = activeLoansByBookId.get(book.id) || null;
              return (
                <article
                  key={book.id}
                  className="group flex flex-col bg-white border border-[#E6E0D4] rounded-lg overflow-hidden transition-colors hover:border-[#C7BFA9]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackError(null);
                      setDetailBook(book);
                    }}
                    className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1E3A8A]"
                  >
                    <BookCover book={book} className="aspect-[3/4] w-full" />
                  </button>

                  <div className="flex-1 p-4 flex flex-col justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="text-xs text-[#57534E] flex items-center gap-1.5 truncate">
                        <span>{book.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{book.year}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{book.pages} hlm</span>
                      </div>

                      <h3 className="font-serif text-base font-semibold text-[#1C1917] leading-snug line-clamp-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackError(null);
                            setDetailBook(book);
                          }}
                          className="text-left hover:text-[#1E3A8A] transition-colors cursor-pointer"
                        >
                          {book.title}
                        </button>
                      </h3>

                      <p className="text-xs text-[#57534E] truncate">{book.author}</p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-[#F0EBE1]">
                      <div className="flex items-center justify-between text-xs">
                        {activeLoan ? (
                          <span
                            className={`font-medium ${
                              activeLoan.isOverdue
                                ? 'text-[#B91C1C]'
                                : 'text-[#15803D]'
                            }`}
                          >
                            {activeLoan.isOverdue
                              ? `Terlambat ${activeLoan.daysOverdue} hari`
                              : 'Sedang Anda pinjam'}
                          </span>
                        ) : (
                          <span
                            className={`tabular-nums font-medium ${
                              book.availableCopies > 0
                                ? 'text-[#15803D]'
                                : 'text-[#B45309]'
                            }`}
                          >
                            {book.availableCopies > 0
                              ? `${book.availableCopies} dari ${book.totalCopies} tersedia`
                              : 'Semua salinan dipinjam'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {activeLoan ? (
                          <button
                            type="button"
                            onClick={() => onOpenReader(book, activeLoan)}
                            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Baca PDF
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={
                                book.availableCopies <= 0 || borrowingId === book.id
                              }
                              onClick={() => handleBorrow(book, 7)}
                              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
                            >
                              {borrowingId === book.id ? 'Meminjam...' : 'Pinjam Buku'}
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenReader(book, null)}
                              className="px-3 py-2 text-xs font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Pratinjau
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Book Detail & Custom Duration Borrow Modal */}
      {detailBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="book-detail-title"
        >
          <div className="w-full max-w-2xl bg-white border border-[#E6E0D4] rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E0D4] bg-[#FBF9F5]">
              <span className="text-xs uppercase tracking-widest text-[#57534E]">
                Detail Bibliografi
              </span>
              <button
                type="button"
                onClick={() => setDetailBook(null)}
                className="p-1.5 text-[#57534E] hover:text-[#1C1917] rounded cursor-pointer"
                aria-label="Tutup detail buku"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-12 gap-6">
              <div className="sm:col-span-4">
                <BookCover
                  book={detailBook}
                  className="aspect-[3/4] w-full rounded"
                />
              </div>

              <div className="sm:col-span-8 space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs text-[#57534E]">
                    {detailBook.category} · {detailBook.year} · {detailBook.language}
                  </div>
                  <h3
                    id="book-detail-title"
                    className="font-serif text-2xl font-semibold text-[#1C1917] leading-snug"
                  >
                    {detailBook.title}
                  </h3>
                  <p className="text-sm font-medium text-[#57534E]">
                    {detailBook.author}
                  </p>
                </div>

                <p className="text-sm text-[#44403C] leading-relaxed">
                  {detailBook.description}
                </p>

                <dl className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E6E0D4] text-xs">
                  <div>
                    <dt className="text-[#78716C]">ISBN</dt>
                    <dd className="font-mono tabular-nums text-[#1C1917] mt-0.5">
                      {detailBook.isbn}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Jumlah Halaman</dt>
                    <dd className="font-mono tabular-nums text-[#1C1917] mt-0.5">
                      {detailBook.pages} halaman
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Ketersediaan</dt>
                    <dd className="font-mono tabular-nums text-[#1C1917] mt-0.5">
                      {detailBook.availableCopies} / {detailBook.totalCopies} salinan
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#78716C]">Ukuran Berkas PDF</dt>
                    <dd className="font-mono tabular-nums text-[#1C1917] mt-0.5">
                      {Math.max(1, Math.round(detailBook.pdfSizeBytes / 1024))} KB
                    </dd>
                  </div>
                </dl>

                {!activeLoansByBookId.has(detailBook.id) && (
                  <div className="pt-3 border-t border-[#E6E0D4] space-y-2">
                    <label className="block text-xs font-medium text-[#1C1917]">
                      Pilih Lama Peminjaman
                    </label>
                    <div className="flex items-center gap-2">
                      {[3, 7, 14].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setDurationDays(days)}
                          className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                            durationDays === days
                              ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                              : 'bg-white text-[#1C1917] border-[#D6CEBE] hover:bg-[#F3EFE7]'
                          }`}
                        >
                          {days} Hari
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {feedbackError && (
                  <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded">
                    {feedbackError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {activeLoansByBookId.has(detailBook.id) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const loan = activeLoansByBookId.get(detailBook.id) || null;
                        setDetailBook(null);
                        onOpenReader(detailBook, loan);
                      }}
                      className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors cursor-pointer"
                    >
                      Baca PDF Sekarang
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={
                          detailBook.availableCopies <= 0 ||
                          borrowingId === detailBook.id
                        }
                        onClick={() => handleBorrow(detailBook, durationDays)}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors disabled:opacity-45 cursor-pointer"
                      >
                        {borrowingId === detailBook.id
                          ? 'Memproses...'
                          : `Pinjam (${durationDays} Hari)`}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailBook;
                          setDetailBook(null);
                          onOpenReader(target, null);
                        }}
                        className="px-4 py-2.5 text-sm font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded-md transition-colors cursor-pointer"
                      >
                        Baca Pratinjau
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
