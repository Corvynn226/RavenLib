import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { createServer as createViteServer } from 'vite';
import {
  addBook,
  claimAdminPasscode,
  COVERS_DIR,
  createLoan,
  deleteBook,
  extendLoan,
  findUserByEmail,
  getAdminStatus,
  getBookById,
  getDemoReader,
  initLibraryStore,
  listAllLoans,
  listBooks,
  listUserLoans,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerMember,
  returnLoan,
  sendAdminOverdueReminders,
  signAuthToken,
  simulateLoanOverdue,
  sweepOverdueNotifications,
  UPLOADS_DIR,
  updateReadingProgress,
  userHasActiveLoan,
  verifyAdminPasscode,
  verifyAuthToken,
  verifyPassword,
} from './server/store.ts';
import type { TokenPayload } from './server/store.ts';

interface AuthedRequest extends Request {
  auth?: TokenPayload;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi tidak valid atau telah berakhir.' });
    return;
  }
  req.auth = payload;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Akses admin membutuhkan autentikasi.' });
    return;
  }
  const payload = verifyAuthToken(token);
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Hanya pengelola admin yang dapat melakukan tindakan ini.' });
    return;
  }
  req.auth = payload;
  next();
}

function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

function hasImageMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 4) return false;
  if (mime === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
    files: 2,
  },
});

async function startServer(): Promise<void> {
  await initLibraryStore();

  // Periodic background sweep for overdue loans every 60s
  setInterval(() => {
    try {
      sweepOverdueNotifications();
    } catch {
      // Ignore periodic sweep error
    }
  }, 60_000);

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // --- Auth Routes ---
  app.post('/api/auth/demo-reader', (_req: Request, res: Response) => {
    const demo = getDemoReader();
    if (!demo) {
      res.status(404).json({ error: 'Akun demo tidak tersedia.' });
      return;
    }
    const token = signAuthToken({
      userId: demo.id,
      name: demo.name,
      email: demo.email,
      role: 'member',
    });
    res.json({
      token,
      user: {
        id: demo.id,
        name: demo.name,
        email: demo.email,
        role: 'member',
      },
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      name.trim().length < 2 ||
      !email.includes('@') ||
      password.length < 6
    ) {
      res.status(400).json({
        error: 'Masukkan nama lengkap, email valid, dan kata sandi minimal 6 karakter.',
      });
      return;
    }

    const user = registerMember(name, email, password);
    if (!user) {
      res.status(409).json({ error: 'Email sudah terdaftar. Silakan masuk.' });
      return;
    }

    const token = signAuthToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: 'member',
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'member',
      },
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const user = findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Email atau kata sandi salah.' });
      return;
    }

    const token = signAuthToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: 'member',
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'member',
      },
    });
  });

  // --- Admin Auth Routes ---
  app.get('/api/admin/status', (_req: Request, res: Response) => {
    res.json(getAdminStatus());
  });

  app.post('/api/admin/claim', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({
        error: 'Kata sandi admin minimal 6 karakter.',
      });
      return;
    }

    const claimed = claimAdminPasscode(password);
    if (!claimed) {
      res.status(409).json({
        error: 'Akses admin sudah dikonfigurasi. Silakan masuk dengan kata sandi admin.',
      });
      return;
    }

    const token = signAuthToken({
      userId: 'admin-pustaka',
      name: 'Kepala Perpustakaan',
      email: 'admin@pustaka.id',
      role: 'admin',
    });

    res.status(201).json({
      token,
      user: {
        id: 'admin-pustaka',
        name: 'Kepala Perpustakaan',
        email: 'admin@pustaka.id',
        role: 'admin',
      },
    });
  });

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const { password } = req.body as { password?: string };
    if (typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'Kata sandi admin wajib diisi.' });
      return;
    }

    if (!verifyAdminPasscode(password)) {
      res.status(401).json({ error: 'Kata sandi admin tidak sesuai.' });
      return;
    }

    const token = signAuthToken({
      userId: 'admin-pustaka',
      name: 'Kepala Perpustakaan',
      email: 'admin@pustaka.id',
      role: 'admin',
    });

    res.json({
      token,
      user: {
        id: 'admin-pustaka',
        name: 'Kepala Perpustakaan',
        email: 'admin@pustaka.id',
        role: 'admin',
      },
    });
  });

  // --- Catalog & PDF Serving Routes ---
  app.get('/api/books', (_req: Request, res: Response) => {
    res.json({ books: listBooks() });
  });

  app.get('/api/books/:id/pdf', (req: AuthedRequest, res: Response) => {
    const book = getBookById(req.params.id);
    if (!book) {
      res.status(404).json({ error: 'Buku tidak ditemukan.' });
      return;
    }

    const token = getBearerToken(req);
    const auth = token ? verifyAuthToken(token) : null;
    const isAdmin = auth?.role === 'admin';
    const hasLoan = auth ? userHasActiveLoan(auth.userId, book.id) : false;

    // Allow full PDF access for active borrowers & admins; allow preview bytes for catalog inspection
    if (!isAdmin && !hasLoan && req.query.preview !== '1') {
      res.status(403).json({
        error: 'Pinjam buku ini terlebih dahulu untuk membaca seluruh halaman.',
      });
      return;
    }

    const safeFilename = path.basename(book.pdfFilename);
    const resolvedPath = path.resolve(UPLOADS_DIR, safeFilename);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
      res.status(400).json({ error: 'Lokasi berkas tidak valid.' });
      return;
    }
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Berkas PDF tidak ditemukan di server.' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(resolvedPath);
  });

  app.get('/api/covers/:filename', (req: Request, res: Response) => {
    const safeFilename = path.basename(req.params.filename);
    const resolvedPath = path.resolve(COVERS_DIR, safeFilename);
    if (!resolvedPath.startsWith(COVERS_DIR + path.sep)) {
      res.status(400).json({ error: 'Lokasi berkas tidak valid.' });
      return;
    }
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: 'Sampul tidak ditemukan.' });
      return;
    }
    res.sendFile(resolvedPath);
  });

  // --- Member Loans & Notifications ---
  app.get('/api/loans', requireAuth, (req: AuthedRequest, res: Response) => {
    const loans = listUserLoans(req.auth!.userId);
    res.json({ loans });
  });

  app.post('/api/loans', requireAuth, (req: AuthedRequest, res: Response) => {
    const { bookId, durationDays } = req.body as {
      bookId?: string;
      durationDays?: number;
    };
    if (typeof bookId !== 'string' || !bookId) {
      res.status(400).json({ error: 'ID buku wajib disertakan.' });
      return;
    }

    const result = createLoan(
      req.auth!.userId,
      req.auth!.name,
      req.auth!.email,
      bookId,
      Number(durationDays || 7)
    );
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ loan: result.loan });
  });

  app.post('/api/loans/:id/return', requireAuth, (req: AuthedRequest, res: Response) => {
    const result = returnLoan(
      req.params.id,
      req.auth!.userId,
      req.auth!.role === 'admin'
    );
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ loan: result.loan });
  });

  app.post('/api/loans/:id/extend', requireAuth, (req: AuthedRequest, res: Response) => {
    const result = extendLoan(req.params.id, req.auth!.userId);
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ loan: result.loan });
  });

  app.patch('/api/loans/:id/progress', requireAuth, (req: AuthedRequest, res: Response) => {
    const { lastPageRead } = req.body as { lastPageRead?: number };
    const result = updateReadingProgress(
      req.params.id,
      req.auth!.userId,
      Number(lastPageRead || 1)
    );
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ loan: result.loan });
  });

  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res: Response) => {
    const notifications = listUserNotifications(req.auth!.userId);
    res.json({ notifications });
  });

  app.post(
    '/api/notifications/:id/read',
    requireAuth,
    (req: AuthedRequest, res: Response) => {
      const ok = markNotificationRead(req.params.id, req.auth!.userId);
      if (!ok) {
        res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
        return;
      }
      res.json({ ok: true });
    }
  );

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res: Response) => {
    markAllNotificationsRead(req.auth!.userId);
    res.json({ ok: true });
  });

  // --- Admin Dashboard Routes ---
  app.post(
    '/api/admin/books',
    requireAdmin,
    upload.fields([
      { name: 'pdf', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ]),
    async (req: AuthedRequest, res: Response) => {
      try {
        const files = req.files as
          | { pdf?: Express.Multer.File[]; cover?: Express.Multer.File[] }
          | undefined;
        const pdfFile = files?.pdf?.[0];
        if (!pdfFile) {
          res.status(400).json({ error: 'Berkas PDF buku wajib diunggah.' });
          return;
        }
        if (
          pdfFile.mimetype !== 'application/pdf' ||
          !hasPdfMagicBytes(pdfFile.buffer)
        ) {
          res.status(400).json({
            error: 'Format berkas tidak valid. Pastikan file merupakan PDF asli.',
          });
          return;
        }

        const {
          title,
          author,
          category,
          year,
          isbn,
          description,
          totalCopies,
          language,
        } = req.body as Record<string, string | undefined>;

        if (!title?.trim() || !author?.trim() || !category?.trim()) {
          res.status(400).json({
            error: 'Judul buku, nama penulis, dan kategori wajib diisi.',
          });
          return;
        }

        // Parse real page count from uploaded PDF
        let detectedPages = 1;
        try {
          const parsedPdf = await PDFDocument.load(pdfFile.buffer, {
            ignoreEncryption: true,
          });
          detectedPages = Math.max(1, parsedPdf.getPageCount());
        } catch {
          res.status(400).json({
            error: 'Berkas PDF rusak atau terenkripsi sehingga tidak dapat dibaca aplikasi.',
          });
          return;
        }

        const bookId = `book-${crypto.randomUUID().slice(0, 8)}`;
        const pdfFilename = `${bookId}-${Date.now()}.pdf`;
        const pdfTargetPath = path.resolve(UPLOADS_DIR, pdfFilename);
        if (!pdfTargetPath.startsWith(UPLOADS_DIR + path.sep)) {
          res.status(400).json({ error: 'Nama berkas tidak valid.' });
          return;
        }
        fs.writeFileSync(pdfTargetPath, pdfFile.buffer);

        let coverUrl: string | null = null;
        const coverFile = files?.cover?.[0];
        if (coverFile) {
          const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
          if (
            !allowedMimes.includes(coverFile.mimetype) ||
            !hasImageMagicBytes(coverFile.buffer, coverFile.mimetype)
          ) {
            res.status(400).json({
              error: 'Gambar sampul harus berformat JPG, PNG, atau WEBP.',
            });
            return;
          }
          const ext =
            coverFile.mimetype === 'image/png'
              ? 'png'
              : coverFile.mimetype === 'image/webp'
                ? 'webp'
                : 'jpg';
          const coverFilename = `cover-${bookId}-${Date.now()}.${ext}`;
          const coverTargetPath = path.resolve(COVERS_DIR, coverFilename);
          if (coverTargetPath.startsWith(COVERS_DIR + path.sep)) {
            fs.writeFileSync(coverTargetPath, coverFile.buffer);
            coverUrl = `/api/covers/${coverFilename}`;
          }
        }

        const copies = Math.min(50, Math.max(1, parseInt(totalCopies || '3', 10) || 3));
        const parsedYear =
          parseInt(year || '', 10) || new Date().getFullYear();

        const newBook = addBook({
          id: bookId,
          title: title.trim(),
          author: author.trim(),
          category: category.trim(),
          year: parsedYear,
          isbn: isbn?.trim() || `978-602-${Math.floor(100000 + Math.random() * 899999)}`,
          pages: detectedPages,
          language: language?.trim() || 'Indonesia',
          description:
            description?.trim() ||
            `Koleksi digital resmi Pustaka Aksara oleh ${author.trim()}.`,
          coverUrl,
          pdfFilename,
          pdfSizeBytes: pdfFile.size,
          totalCopies: copies,
          availableCopies: copies,
          createdAt: new Date().toISOString(),
        });

        res.status(201).json({ book: newBook });
      } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Gagal memproses unggahan PDF.' });
      }
    }
  );

  app.delete('/api/admin/books/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
    const result = deleteBook(req.params.id);
    if (!result.deleted) {
      res.status(400).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/loans', requireAdmin, (_req: AuthedRequest, res: Response) => {
    res.json({ loans: listAllLoans() });
  });

  app.post(
    '/api/admin/notifications/remind-overdue',
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const { loanId } = (req.body || {}) as { loanId?: string };
      const result = sendAdminOverdueReminders(loanId);
      res.json(result);
    }
  );

  app.post(
    '/api/admin/loans/:id/simulate-overdue',
    requireAdmin,
    (req: AuthedRequest, res: Response) => {
      const result = simulateLoanOverdue(req.params.id);
      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ loan: result.loan });
    }
  );

  // --- Vite / Static Frontend Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pustaka Aksara server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Pustaka Aksara server:', err);
  process.exit(1);
});
