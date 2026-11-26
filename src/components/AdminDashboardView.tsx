import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BellRing,
  BookPlus,
  Clock,
  FileUp,
  Lock,
  LogOut,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { AdminStatus, AuthSession, Book, Loan } from '../types';
import {
  claimAdminApi,
  deleteBookApi,
  fetchAdminLoansApi,
  fetchAdminStatus,
  loginAdminApi,
  sendOverdueRemindersApi,
  simulateOverdueApi,
  uploadBookPdfApi,
} from '../api';

interface AdminDashboardViewProps {
  adminSession: AuthSession | null;
  books: Book[];
  onAdminAuthenticated: (session: AuthSession) => void;
  onAdminSignOut: () => void;
  onBooksChanged: () => Promise<void>;
  onOpenReader: (book: Book) => void;
  onToast: (message: string) => void;
}

function formatDateId(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminDashboardView({
  adminSession,
  books,
  onAdminAuthenticated,
  onAdminSignOut,
  onBooksChanged,
  onOpenReader,
  onToast,
}: AdminDashboardViewProps) {
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Admin data
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [loanFilter, setLoanFilter] = useState<'all' | 'overdue' | 'borrowed' | 'returned'>('all');
  const [sendingReminders, setSendingReminders] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Upload PDF form
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Teknologi');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [isbn, setIsbn] = useState('');
  const [totalCopies, setTotalCopies] = useState('3');
  const [description, setDescription] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminStatus()
      .then(setAdminStatus)
      .catch(() => setAdminStatus({ mode: 'unclaimed', configured: false }));
  }, []);

  async function refreshAdminLoans(token: string) {
    try {
      const loans = await fetchAdminLoansApi(token);
      setAllLoans(loans);
    } catch {
      // Ignore transient refresh failure
    }
  }

  useEffect(() => {
    if (adminSession?.token) {
      refreshAdminLoans(adminSession.token);
    }
  }, [adminSession?.token]);

  async function handleAdminAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);

    if (adminStatus?.mode === 'unclaimed') {
      if (passwordInput.length < 6) {
        setAuthError('Kata sandi admin minimal 6 karakter.');
        return;
      }
      if (passwordInput !== confirmPassword) {
        setAuthError('Konfirmasi kata sandi tidak cocok.');
        return;
      }
    }

    setAuthLoading(true);
    try {
      const session =
        adminStatus?.mode === 'unclaimed'
          ? await claimAdminApi(passwordInput)
          : await loginAdminApi(passwordInput);
      onAdminAuthenticated(session);
      setPasswordInput('');
      setConfirmPassword('');
      setAdminStatus({ mode: 'claimed', configured: true });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Autentikasi admin gagal.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleUploadSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adminSession) return;
    setUploadError(null);

    if (!pdfFile) {
      setUploadError('Pilih berkas PDF buku terlebih dahulu.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('author', author);
    formData.append('category', category);
    formData.append('year', year);
    formData.append('isbn', isbn);
    formData.append('totalCopies', totalCopies);
    formData.append('description', description);
    formData.append('pdf', pdfFile);
    if (coverFile) {
      formData.append('cover', coverFile);
    }

    setUploading(true);
    try {
      const uploaded = await uploadBookPdfApi(adminSession.token, formData);
      await onBooksChanged();
      setTitle('');
      setAuthor('');
      setIsbn('');
      setDescription('');
      setPdfFile(null);
      setCoverFile(null);
      const pdfInput = document.getElementById('admin-pdf-input') as HTMLInputElement | null;
      const coverInput = document.getElementById('admin-cover-input') as HTMLInputElement | null;
      if (pdfInput) pdfInput.value = '';
      if (coverInput) coverInput.value = '';
      onToast(`Buku "${uploaded.title}" (${uploaded.pages} halaman) berhasil diunggah ke katalog.`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Gagal mengunggah PDF.');
    } finally {
      setUploading(false);
    }
  }

  async function handleBulkOverdueReminder() {
    if (!adminSession) return;
    setSendingReminders(true);
    try {
      const res = await sendOverdueRemindersApi(adminSession.token);
      if (res.sentCount === 0) {
        onToast('Tidak ada peminjaman terlambat yang perlu dikirim pengingat.');
      } else {
        onToast(`Berhasil mengirim ${res.sentCount} notifikasi pengingat keterlambatan.`);
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal mengirim pengingat.');
    } finally {
      setSendingReminders(false);
    }
  }

  async function handleSingleReminder(loanId: string) {
    if (!adminSession) return;
    setBusyId(loanId);
    try {
      await sendOverdueRemindersApi(adminSession.token, loanId);
      onToast('Pengingat pengembalian telah dikirim ke notifikasi peminjam.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal mengirim pengingat.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSimulateOverdue(loanId: string) {
    if (!adminSession) return;
    setBusyId(loanId);
    try {
      await simulateOverdueApi(adminSession.token, loanId);
      await refreshAdminLoans(adminSession.token);
      onToast('Status peminjaman diubah menjadi terlambat 2 hari dan notifikasi dibuat.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal mensimulasikan keterlambatan.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteBook(book: Book) {
    if (!adminSession) return;
    setBusyId(book.id);
    try {
      await deleteBookApi(adminSession.token, book.id);
      await onBooksChanged();
      onToast(`Buku "${book.title}" telah dihapus dari katalog.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal menghapus buku.');
    } finally {
      setBusyId(null);
    }
  }

  const overdueLoans = useMemo(
    () => allLoans.filter((l) => l.status === 'borrowed' && l.isOverdue),
    [allLoans]
  );

  const activeBorrowed = useMemo(
    () => allLoans.filter((l) => l.status === 'borrowed'),
    [allLoans]
  );

  const filteredLoans = useMemo(() => {
    if (loanFilter === 'overdue') return overdueLoans;
    if (loanFilter === 'borrowed') return activeBorrowed;
    if (loanFilter === 'returned') {
      return allLoans.filter((l) => l.status === 'returned');
    }
    return allLoans;
  }, [allLoans, loanFilter, overdueLoans, activeBorrowed]);

  // --- Admin Login / First-Run Claim Gate ---
  if (!adminSession) {
    const isUnclaimed = adminStatus?.mode === 'unclaimed';

    return (
      <section className="max-w-md mx-auto my-8 bg-white border border-[#E6E0D4] rounded-lg p-8 space-y-6">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-md bg-[#F3EFE7] border border-[#E6E0D4] flex items-center justify-center">
            {isUnclaimed ? (
              <ShieldCheck className="w-5 h-5 text-[#1E3A8A]" />
            ) : (
              <Lock className="w-5 h-5 text-[#1E3A8A]" />
            )}
          </div>
          <h1 className="font-serif text-2xl font-semibold text-[#1C1917]">
            {isUnclaimed
              ? 'Aktivasi Kata Sandi Admin Pertama Kali'
              : 'Masuk Dasbor Pengelola Admin'}
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            {isUnclaimed
              ? 'Kata sandi pengelola belum ditetapkan. Buat kata sandi admin perpustakaan Anda untuk membuka fitur unggah PDF dan pengiriman notifikasi keterlambatan.'
              : 'Masukkan kata sandi pengelola perpustakaan untuk mengunggah koleksi PDF dan mengelola peminjaman.'}
          </p>
        </div>

        <form onSubmit={handleAdminAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
              {isUnclaimed ? 'Buat Kata Sandi Admin' : 'Kata Sandi Admin'}
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
            />
          </div>

          {isUnclaimed && (
            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Konfirmasi Kata Sandi Admin
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>
          )}

          {authError && (
            <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
          >
            {authLoading
              ? 'Memverifikasi...'
              : isUnclaimed
                ? 'Tetapkan Sandi & Buka Dasbor'
                : 'Masuk Dasbor Admin'}
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="space-y-10">
      {/* Admin Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6E0D4] pb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#57534E]">
            Panel Pengelola Perpustakaan
          </p>
          <h1 className="font-serif text-3xl font-semibold text-[#1C1917] mt-1">
            Dasbor Admin & Unggah PDF
          </h1>
        </div>
        <button
          type="button"
          onClick={onAdminSignOut}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] border border-[#D6CEBE] rounded-md transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar Sesi Admin</span>
        </button>
      </div>

      {/* KPI Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-[#E6E0D4] rounded-lg divide-y lg:divide-y-0 lg:divide-x divide-[#E6E0D4]">
        <div className="p-5">
          <p className="text-xs text-[#57534E]">Total Judul PDF</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#1C1917]">
            {books.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#57534E]">Salinan Tersedia</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#1C1917]">
            {books.reduce((acc, b) => acc + b.availableCopies, 0)}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#57534E]">Peminjaman Aktif</p>
          <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-[#1C1917]">
            {activeBorrowed.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#57534E]">Peminjaman Terlambat</p>
          <p
            className={`mt-1 text-2xl font-semibold font-mono tabular-nums ${
              overdueLoans.length > 0 ? 'text-[#B91C1C]' : 'text-[#15803D]'
            }`}
          >
            {overdueLoans.length}
          </p>
        </div>
      </section>

      {/* Main Split: Upload PDF Form + Overdue Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload PDF Panel */}
        <section className="lg:col-span-5 bg-white border border-[#E6E0D4] rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-[#F0EBE1] pb-4">
            <BookPlus className="w-5 h-5 text-[#1E3A8A]" />
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
                Unggah Buku PDF Baru
              </h2>
              <p className="text-xs text-[#57534E]">
                Jumlah halaman dideteksi otomatis dari berkas PDF.
              </p>
            </div>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Berkas PDF Buku (Maks. 25 MB) *
              </label>
              <label
                htmlFor="admin-pdf-input"
                className="flex flex-col items-center justify-center gap-2 p-5 border border-dashed border-[#C7BFA9] rounded-md bg-[#FBF9F5] hover:bg-[#F3EFE7] transition-colors cursor-pointer text-center"
              >
                <FileUp className="w-5 h-5 text-[#1E3A8A]" />
                <span className="text-xs font-medium text-[#1C1917]">
                  {pdfFile
                    ? `${pdfFile.name} (${(pdfFile.size / 1024).toFixed(0)} KB)`
                    : 'Klik untuk memilih berkas .pdf'}
                </span>
                <input
                  id="admin-pdf-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Judul Buku *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Pengantar Tata Kota Berkelanjutan"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  Penulis *
                </label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Nama penulis"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  Kategori *
                </label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Teknologi / Sastra / Sejarah"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  Tahun
                </label>
                <input
                  type="number"
                  min={1900}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  Salinan
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={totalCopies}
                  onChange={(e) => setTotalCopies(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  ISBN
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Gambar Sampul (Opsional, JPG/PNG/WEBP)
              </label>
              <input
                id="admin-cover-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="block w-full text-xs text-[#57534E] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#D6CEBE] file:text-xs file:font-medium file:bg-[#F3EFE7] file:text-[#1C1917] hover:file:bg-[#E6E0D4]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Deskripsi / Sinopsis
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ringkasan singkat isi buku..."
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            {uploadError && (
              <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded">
                {uploadError}
              </p>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
            >
              {uploading ? 'Mengunggah & Memproses PDF...' : 'Unggah Buku ke Katalog'}
            </button>
          </form>
        </section>

        {/* Right Column: Loan Monitoring & Overdue Notifications */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E6E0D4] rounded-lg overflow-hidden">
            <div className="p-5 border-b border-[#E6E0D4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
                  Pemantauan Peminjaman & Pengingat Terlambat
                </h2>
                <p className="text-xs text-[#57534E] mt-0.5">
                  Kirim pengingat ke notifikasi anggota atau uji simulasi keterlambatan.
                </p>
              </div>
              <button
                type="button"
                disabled={sendingReminders || overdueLoans.length === 0}
                onClick={handleBulkOverdueReminder}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-md transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>
                  {sendingReminders
                    ? 'Mengirim...'
                    : `Kirim Pengingat Massal (${overdueLoans.length})`}
                </span>
              </button>
            </div>

            {/* Filter Strip */}
            <div className="px-5 py-3 bg-[#FBF9F5] border-b border-[#E6E0D4] flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['all', `Semua (${allLoans.length})`],
                  ['overdue', `Terlambat (${overdueLoans.length})`],
                  ['borrowed', `Aktif (${activeBorrowed.length})`],
                  ['returned', 'Dikembalikan'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLoanFilter(key)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                    loanFilter === key
                      ? 'bg-[#1C1917] text-white'
                      : 'text-[#57534E] hover:text-[#1C1917]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredLoans.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#57534E]">
                Belum ada catatan peminjaman pada kategori ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E0D4] bg-[#FBF9F5] text-[#57534E]">
                      <th className="py-3 px-4 font-medium">Peminjam & Buku</th>
                      <th className="py-3 px-4 font-medium">Tenggat</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Aksi Pengingat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE1]">
                    {filteredLoans.map((loan) => (
                      <tr key={loan.id} className="hover:bg-[#FBF9F5]">
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#1C1917]">
                            {loan.userName}
                          </div>
                          <div className="text-[#57534E] truncate max-w-[220px]">
                            {loan.book?.title || loan.bookId}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[#57534E] whitespace-nowrap">
                          {formatDateId(loan.dueAt)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {loan.status === 'returned' ? (
                            <span className="font-medium text-[#15803D]">
                              Dikembalikan
                            </span>
                          ) : loan.isOverdue ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span className="tabular-nums">
                                Terlambat {loan.daysOverdue} hr
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-[#1E3A8A]">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Dipinjam</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {loan.status === 'borrowed' && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busyId === loan.id}
                                onClick={() => handleSingleReminder(loan.id)}
                                className="px-2.5 py-1 text-[11px] font-medium text-[#1E3A8A] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded transition-colors cursor-pointer"
                              >
                                Kirim Pengingat
                              </button>
                              {!loan.isOverdue && (
                                <button
                                  type="button"
                                  disabled={busyId === loan.id}
                                  onClick={() => handleSimulateOverdue(loan.id)}
                                  className="px-2.5 py-1 text-[11px] font-medium text-[#B45309] border border-[#FCD34D] hover:bg-[#FEF3C7] rounded transition-colors cursor-pointer"
                                  title="Uji sistem notifikasi dengan mengubah tenggat menjadi terlambat 2 hari"
                                >
                                  Simulasi Terlambat
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Uploaded PDF Catalog Management */}
          <div className="bg-white border border-[#E6E0D4] rounded-lg overflow-hidden">
            <div className="p-5 border-b border-[#E6E0D4]">
              <h2 className="font-serif text-xl font-semibold text-[#1C1917]">
                Inventaris Koleksi PDF ({books.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E0D4] bg-[#FBF9F5] text-[#57534E]">
                    <th className="py-3 px-4 font-medium">Judul & Penulis</th>
                    <th className="py-3 px-4 font-medium">Halaman</th>
                    <th className="py-3 px-4 font-medium">Salinan</th>
                    <th className="py-3 px-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE1]">
                  {books.map((book) => (
                    <tr key={book.id} className="hover:bg-[#FBF9F5]">
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#1C1917] max-w-[260px] truncate">
                          {book.title}
                        </div>
                        <div className="text-[#57534E]">
                          {book.author} · {book.category}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#57534E]">
                        {book.pages} hlm
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#1C1917]">
                        {book.availableCopies} / {book.totalCopies}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenReader(book)}
                            className="px-2.5 py-1 text-[11px] font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded cursor-pointer"
                          >
                            Lihat PDF
                          </button>
                          <button
                            type="button"
                            disabled={busyId === book.id}
                            onClick={() => handleDeleteBook(book)}
                            className="p-1.5 text-[#57534E] hover:text-[#B91C1C] rounded cursor-pointer"
                            aria-label={`Hapus ${book.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
