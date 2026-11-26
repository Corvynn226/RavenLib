import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Lock,
  Moon,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Book, Loan } from '../types';
import { saveReadingProgressApi } from '../api';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfReaderModalProps {
  book: Book | null;
  loan: Loan | null;
  token: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onBorrowFromPreview: (book: Book) => Promise<void>;
  onProgressUpdated?: (loanId: string, page: number) => void;
}

type ReaderTheme = 'warm' | 'light' | 'dark';

export function PdfReaderModal({
  book,
  loan,
  token,
  isAdmin,
  onClose,
  onBorrowFromPreview,
  onProgressUpdated,
}: PdfReaderModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [theme, setTheme] = useState<ReaderTheme>('warm');
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrowing, setBorrowing] = useState(false);

  const hasFullAccess = Boolean(loan && loan.status === 'borrowed') || isAdmin;
  const previewLimit = 2;
  const isLockedPage = !hasFullAccess && currentPage > previewLimit;

  useEffect(() => {
    if (!book) return;
    let cancelled = false;

    async function loadPdf() {
      if (!book) return;
      setLoadingDoc(true);
      setError(null);
      setPdfDoc(null);

      try {
        const url = `/api/books/${book.id}/pdf${hasFullAccess ? '' : '?preview=1'}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(
            (errJson as { error?: string }).error || 'Gagal memuat berkas PDF.'
          );
        }
        const buffer = await res.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        const startPage =
          loan && loan.lastPageRead >= 1 && loan.lastPageRead <= doc.numPages
            ? loan.lastPageRead
            : 1;
        setCurrentPage(startPage);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal membuka PDF.');
        }
      } finally {
        if (!cancelled) {
          setLoadingDoc(false);
        }
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [book?.id, hasFullAccess, token]);

  useEffect(() => {
    if (!pdfDoc || isLockedPage) return;
    let cancelled = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;
      setRenderingPage(true);

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
        const page = await pdfDoc.getPage(currentPage);
        if (cancelled || !canvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const task = page.render({
          canvasContext: context,
          viewport,
          canvas,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (
          err &&
          typeof err === 'object' &&
          'name' in err &&
          (err as { name: string }).name === 'RenderingCancelledException'
        ) {
          return;
        }
      } finally {
        if (!cancelled) {
          setRenderingPage(false);
        }
      }
    }

    renderPage();

    if (loan && loan.status === 'borrowed' && token) {
      saveReadingProgressApi(token, loan.id, currentPage)
        .then(() => {
          onProgressUpdated?.(loan.id, currentPage);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, currentPage, scale, isLockedPage]);

  useEffect(() => {
    if (!book) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentPage((p) => Math.min(numPages, p + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentPage((p) => Math.max(1, p - 1));
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [book, numPages, onClose]);

  if (!book) return null;

  const surfaceStyles: Record<ReaderTheme, string> = {
    warm: 'bg-[#F3EFE7] text-[#1C1917]',
    light: 'bg-[#F5F5F4] text-[#1C1917]',
    dark: 'bg-[#18181B] text-[#F4F4F5]',
  };

  async function handleBorrowClick() {
    if (!book) return;
    setBorrowing(true);
    try {
      await onBorrowFromPreview(book);
    } finally {
      setBorrowing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1C1917]/80 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Pembaca PDF ${book.title}`}
    >
      {/* Top Reader Toolbar */}
      <header className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 bg-[#FFFFFF] border-b border-[#E6E0D4] text-[#1C1917]">
        <div className="min-w-0 flex items-center gap-3">
          <BookOpen className="w-4 h-4 text-[#1E3A8A] shrink-0" />
          <div className="min-w-0">
            <h2 className="font-serif text-sm md:text-base font-semibold truncate">
              {book.title}
            </h2>
            <p className="text-xs text-[#57534E] truncate">
              {book.author} ·{' '}
              {hasFullAccess
                ? 'Akses Penuh Peminjaman'
                : `Mode Pratinjau (Halaman 1–${Math.min(previewLimit, numPages)})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Theme switch */}
          <div className="hidden sm:flex items-center gap-1 p-1 bg-[#F3EFE7] rounded-md">
            <button
              type="button"
              onClick={() => setTheme('warm')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                theme === 'warm' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
              }`}
            >
              Hangat
            </button>
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                theme === 'light' ? 'bg-white text-[#1C1917] shadow-xs' : 'text-[#57534E]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 inline mr-1" />
              Terang
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                theme === 'dark' ? 'bg-[#1C1917] text-white shadow-xs' : 'text-[#57534E]'
              }`}
            >
              <Moon className="w-3.5 h-3.5 inline mr-1" />
              Malam
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center border border-[#E6E0D4] rounded-md bg-white">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.75, Number((s - 0.15).toFixed(2))))}
              className="p-2 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              aria-label="Perkecil halaman"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-[#1C1917]">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2.2, Number((s + 0.15).toFixed(2))))}
              className="p-2 text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              aria-label="Perbesar halaman"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            <span>Tutup</span>
          </button>
        </div>
      </header>

      {/* Main Document Canvas Viewport */}
      <div className={`flex-1 overflow-auto p-4 md:p-8 flex justify-center ${surfaceStyles[theme]}`}>
        {loadingDoc ? (
          <div className="self-center text-center space-y-3">
            <div className="w-10 h-10 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Memuat lembar dokumen PDF...</p>
          </div>
        ) : error ? (
          <div className="self-center max-w-md bg-white border border-[#FECACA] text-[#1C1917] p-6 rounded-lg text-center space-y-3">
            <p className="font-serif text-lg font-semibold text-[#B91C1C]">
              Dokumen Tidak Dapat Dibuka
            </p>
            <p className="text-sm text-[#57534E]">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-[#1C1917] text-white rounded-md cursor-pointer"
            >
              Kembali
            </button>
          </div>
        ) : isLockedPage ? (
          <div className="self-center max-w-lg w-full bg-white text-[#1C1917] border border-[#E6E0D4] rounded-lg p-8 text-center space-y-4 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-[#F3EFE7] border border-[#E6E0D4] flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5 text-[#1E3A8A]" />
            </div>
            <h3 className="font-serif text-2xl font-semibold">
              Batas Pratinjau Tercapai
            </h3>
            <p className="text-sm text-[#57534E] leading-relaxed">
              Anda sedang membaca pratinjau halaman 1–{previewLimit}. Pinjam buku{' '}
              <span className="font-semibold text-[#1C1917]">{book.title}</span> untuk
              membuka seluruh {numPages} halaman dokumen PDF secara daring.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                className="px-4 py-2 text-sm font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] rounded-md transition-colors cursor-pointer"
              >
                Kembali ke Halaman 1
              </button>
              <button
                type="button"
                disabled={borrowing || book.availableCopies <= 0}
                onClick={handleBorrowClick}
                className="px-5 py-2 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              >
                {borrowing
                  ? 'Memproses Pinjaman...'
                  : book.availableCopies <= 0
                    ? 'Stok Salinan Habis'
                    : 'Pinjam & Baca Penuh'}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            <div
              className={`border border-[#D6CEBE] shadow-md transition-opacity duration-150 ${
                renderingPage ? 'opacity-80' : 'opacity-100'
              } ${theme === 'dark' ? 'invert hue-rotate-180' : ''}`}
            >
              <canvas ref={canvasRef} className="block bg-white max-w-full h-auto" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Pagination Bar */}
      <footer className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 bg-[#FFFFFF] border-t border-[#E6E0D4] text-[#1C1917]">
        <div className="text-xs text-[#57534E] hidden sm:block tabular-nums">
          {loan && loan.status === 'borrowed'
            ? `Kemajuan baca tersimpan · Halaman ${currentPage} dari ${numPages}`
            : `Halaman ${currentPage} dari ${numPages}`}
        </div>

        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          <button
            type="button"
            disabled={currentPage <= 1 || loadingDoc}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#D6CEBE] rounded-md bg-white hover:bg-[#F3EFE7] disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums">
            <input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!Number.isNaN(val)) {
                  setCurrentPage(Math.min(numPages, Math.max(1, val)));
                }
              }}
              aria-label="Nomor halaman"
              className="w-12 px-1.5 py-1 text-center border border-[#D6CEBE] rounded bg-[#FBF9F5]"
            />
            <span className="text-[#57534E]">/ {numPages}</span>
          </div>

          <button
            type="button"
            disabled={currentPage >= numPages || loadingDoc}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#D6CEBE] rounded-md bg-white hover:bg-[#F3EFE7] disabled:opacity-40 cursor-pointer"
          >
            <span>Berikutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
