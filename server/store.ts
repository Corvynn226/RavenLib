import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AdminStatus,
  Book,
  LibraryNotification,
  Loan,
  UserRole,
} from '../src/types.ts';
import { generateSeedPdfIfMissing, SEED_BOOK_SPECS } from './seedPdfs.ts';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'member';
  createdAt: string;
}

export interface StoredLoan {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  userEmail: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: 'borrowed' | 'returned';
  lastPageRead: number;
  extendedCount: number;
}

interface LibraryDatabase {
  adminPasscodeHash: string | null;
  users: StoredUser[];
  books: Book[];
  loans: StoredLoan[];
  notifications: LibraryNotification[];
}

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const COVERS_DIR = path.join(DATA_DIR, 'covers');
const DB_PATH = path.join(DATA_DIR, 'library-db.json');

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export const DAILY_FINE_IDR = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function verifyEnvPasscode(input: string, envPasscode: string): boolean {
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(envPasscode).digest();
  return crypto.timingSafeEqual(a, b);
}

export interface TokenPayload {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  exp: number;
}

export function signAuthToken(payload: Omit<TokenPayload, 'exp'>): string {
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 7 * DAY_MS,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDbAtomic(db: LibraryDatabase): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

function readDb(): LibraryDatabase {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw) as LibraryDatabase;
}

export async function initLibraryStore(): Promise<void> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(COVERS_DIR, { recursive: true });

  const seedPdfSizes: Record<string, number> = {};
  for (const spec of SEED_BOOK_SPECS) {
    seedPdfSizes[spec.id] = await generateSeedPdfIfMissing(UPLOADS_DIR, spec);
  }

  if (fs.existsSync(DB_PATH)) {
    sweepOverdueNotifications();
    return;
  }

  const now = Date.now();
  const demoUserId = 'user-rani-pratama';

  const books: Book[] = SEED_BOOK_SPECS.map((spec, index) => ({
    id: spec.id,
    title: spec.title,
    author: spec.author,
    category: spec.category,
    year: spec.year,
    isbn: spec.isbn,
    pages: spec.pages,
    language: spec.language,
    description: spec.description,
    coverUrl: spec.coverUrl,
    pdfFilename: spec.filename,
    pdfSizeBytes: seedPdfSizes[spec.id] || 18000,
    totalCopies: spec.totalCopies,
    availableCopies: spec.availableCopies,
    createdAt: new Date(now - (14 - index) * DAY_MS).toISOString(),
  }));

  const demoUser: StoredUser = {
    id: demoUserId,
    name: 'Rani Pratama',
    email: 'rani@pustaka.id',
    passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')),
    role: 'member',
    createdAt: new Date(now - 30 * DAY_MS).toISOString(),
  };

  const loans: StoredLoan[] = [
    {
      id: 'loan-seed-overdue-1',
      bookId: 'book-sejarah-rempah',
      userId: demoUserId,
      userName: demoUser.name,
      userEmail: demoUser.email,
      borrowedAt: new Date(now - 10 * DAY_MS).toISOString(),
      dueAt: new Date(now - 3 * DAY_MS).toISOString(),
      returnedAt: null,
      status: 'borrowed',
      lastPageRead: 2,
      extendedCount: 0,
    },
    {
      id: 'loan-seed-duesoon-2',
      bookId: 'book-ekologi-maritim',
      userId: demoUserId,
      userName: demoUser.name,
      userEmail: demoUser.email,
      borrowedAt: new Date(now - 6 * DAY_MS).toISOString(),
      dueAt: new Date(now + 14 * 60 * 60 * 1000).toISOString(),
      returnedAt: null,
      status: 'borrowed',
      lastPageRead: 1,
      extendedCount: 0,
    },
  ];

  const db: LibraryDatabase = {
    adminPasscodeHash: null,
    users: [demoUser],
    books,
    loans,
    notifications: [],
  };

  writeDbAtomic(db);
  sweepOverdueNotifications();
}

export function computeLoanMetrics(
  loan: StoredLoan,
  book?: Book
): Loan {
  const now = Date.now();
  const dueMs = new Date(loan.dueAt).getTime();
  let isOverdue = false;
  let daysOverdue = 0;

  if (loan.status === 'borrowed' && now > dueMs) {
    isOverdue = true;
    daysOverdue = Math.max(1, Math.ceil((now - dueMs) / DAY_MS));
  }

  return {
    ...loan,
    isOverdue,
    daysOverdue,
    estimatedFineIdr: daysOverdue * DAILY_FINE_IDR,
    book,
  };
}

export function sweepOverdueNotifications(): void {
  const db = readDb();
  const now = Date.now();
  let changed = false;

  for (const loan of db.loans) {
    if (loan.status !== 'borrowed') continue;
    const book = db.books.find((b) => b.id === loan.bookId);
    const bookTitle = book ? book.title : 'Buku Perpustakaan';
    const dueMs = new Date(loan.dueAt).getTime();

    if (now > dueMs) {
      const daysOverdue = Math.max(1, Math.ceil((now - dueMs) / DAY_MS));
      const fine = daysOverdue * DAILY_FINE_IDR;
      const existingUnreadOverdue = db.notifications.find(
        (n) =>
          n.loanId === loan.id &&
          n.type === 'overdue' &&
          n.daysOverdue === daysOverdue
      );

      if (!existingUnreadOverdue) {
        db.notifications.unshift({
          id: `notif-${crypto.randomUUID()}`,
          userId: loan.userId,
          loanId: loan.id,
          bookId: loan.bookId,
          bookTitle,
          type: 'overdue',
          title: `Terlambat ${daysOverdue} hari: Segera kembalikan buku`,
          message: `Peminjaman "${bookTitle}" telah melewati batas waktu ${daysOverdue} hari. Perkiraan denda keterlambatan: Rp ${fine.toLocaleString('id-ID')}. Harap segera kembalikan melalui menu Rak Pinjaman.`,
          daysOverdue,
          read: false,
          createdAt: new Date().toISOString(),
        });
        changed = true;
      }
    } else if (dueMs - now <= DAY_MS) {
      const hoursLeft = Math.max(1, Math.ceil((dueMs - now) / (60 * 60 * 1000)));
      const existingDueSoon = db.notifications.find(
        (n) => n.loanId === loan.id && n.type === 'due_soon'
      );
      if (!existingDueSoon) {
        db.notifications.unshift({
          id: `notif-${crypto.randomUUID()}`,
          userId: loan.userId,
          loanId: loan.id,
          bookId: loan.bookId,
          bookTitle,
          type: 'due_soon',
          title: `Pengingat jatuh tempo dalam ${hoursLeft} jam`,
          message: `Batas pengembalian buku "${bookTitle}" tinggal ${hoursLeft} jam lagi. Anda dapat mengembalikan atau memperpanjang masa pinjam.`,
          daysOverdue: 0,
          read: false,
          createdAt: new Date().toISOString(),
        });
        changed = true;
      }
    }
  }

  if (changed) {
    writeDbAtomic(db);
  }
}

export function getAdminStatus(): AdminStatus {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    return { mode: 'env', configured: true };
  }
  const db = readDb();
  if (db.adminPasscodeHash) {
    return { mode: 'claimed', configured: true };
  }
  return { mode: 'unclaimed', configured: false };
}

export function claimAdminPasscode(password: string): boolean {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) return false;
  const db = readDb();
  if (db.adminPasscodeHash) return false;

  db.adminPasscodeHash = hashPassword(password);
  writeDbAtomic(db);
  return true;
}

export function verifyAdminPasscode(password: string): boolean {
  const envPasscode = process.env.ADMIN_PASSCODE?.trim();
  if (envPasscode) {
    return verifyEnvPasscode(password, envPasscode);
  }
  const db = readDb();
  if (!db.adminPasscodeHash) return false;
  return verifyPassword(password, db.adminPasscodeHash);
}

export function getDemoReader(): StoredUser | null {
  const db = readDb();
  return db.users.find((u) => u.email === 'rani@pustaka.id') || null;
}

export function findUserByEmail(email: string): StoredUser | null {
  const db = readDb();
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export function registerMember(
  name: string,
  email: string,
  password: string
): StoredUser | null {
  const db = readDb();
  const normalized = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
    return null;
  }

  const user: StoredUser = {
    id: `user-${crypto.randomUUID()}`,
    name: name.trim(),
    email: normalized,
    passwordHash: hashPassword(password),
    role: 'member',
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  writeDbAtomic(db);
  return user;
}

export function listBooks(): Book[] {
  const db = readDb();
  return db.books;
}

export function getBookById(bookId: string): Book | null {
  const db = readDb();
  return db.books.find((b) => b.id === bookId) || null;
}

export function addBook(book: Book): Book {
  const db = readDb();
  db.books.unshift(book);
  writeDbAtomic(db);
  return book;
}

export function deleteBook(bookId: string): { deleted: boolean; reason?: string } {
  const db = readDb();
  const activeBorrow = db.loans.some(
    (l) => l.bookId === bookId && l.status === 'borrowed'
  );
  if (activeBorrow) {
    return {
      deleted: false,
      reason: 'Buku tidak dapat dihapus karena masih ada salinan yang sedang dipinjam.',
    };
  }

  const book = db.books.find((b) => b.id === bookId);
  if (!book) {
    return { deleted: false, reason: 'Buku tidak ditemukan.' };
  }

  db.books = db.books.filter((b) => b.id !== bookId);
  writeDbAtomic(db);

  // Clean up uploaded PDF safely if confined inside UPLOADS_DIR
  const safePdfName = path.basename(book.pdfFilename);
  const resolvedPdf = path.resolve(UPLOADS_DIR, safePdfName);
  if (
    resolvedPdf.startsWith(UPLOADS_DIR + path.sep) &&
    fs.existsSync(resolvedPdf)
  ) {
    fs.unlinkSync(resolvedPdf);
  }

  return { deleted: true };
}

export function listUserLoans(userId: string): Loan[] {
  sweepOverdueNotifications();
  const db = readDb();
  return db.loans
    .filter((l) => l.userId === userId)
    .sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime())
    .map((loan) => {
      const book = db.books.find((b) => b.id === loan.bookId);
      return computeLoanMetrics(loan, book);
    });
}

export function listAllLoans(): Loan[] {
  sweepOverdueNotifications();
  const db = readDb();
  return db.loans
    .slice()
    .sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime())
    .map((loan) => {
      const book = db.books.find((b) => b.id === loan.bookId);
      return computeLoanMetrics(loan, book);
    });
}

export function userHasActiveLoan(userId: string, bookId: string): boolean {
  const db = readDb();
  return db.loans.some(
    (l) => l.userId === userId && l.bookId === bookId && l.status === 'borrowed'
  );
}

export function createLoan(
  userId: string,
  userName: string,
  userEmail: string,
  bookId: string,
  durationDays: number
): { loan?: Loan; error?: string } {
  const db = readDb();
  const book = db.books.find((b) => b.id === bookId);
  if (!book) return { error: 'Buku tidak ditemukan.' };
  if (book.availableCopies <= 0) {
    return { error: 'Semua salinan buku sedang dipinjam.' };
  }

  const alreadyBorrowed = db.loans.some(
    (l) => l.userId === userId && l.bookId === bookId && l.status === 'borrowed'
  );
  if (alreadyBorrowed) {
    return { error: 'Anda sudah meminjam buku ini.' };
  }

  const activeCount = db.loans.filter(
    (l) => l.userId === userId && l.status === 'borrowed'
  ).length;
  if (activeCount >= 5) {
    return { error: 'Batas maksimal 5 buku aktif telah tercapai.' };
  }

  const safeDays = [3, 7, 14].includes(durationDays) ? durationDays : 7;
  const now = Date.now();
  const dueAt = new Date(now + safeDays * DAY_MS).toISOString();

  book.availableCopies -= 1;

  const storedLoan: StoredLoan = {
    id: `loan-${crypto.randomUUID()}`,
    bookId: book.id,
    userId,
    userName,
    userEmail,
    borrowedAt: new Date(now).toISOString(),
    dueAt,
    returnedAt: null,
    status: 'borrowed',
    lastPageRead: 1,
    extendedCount: 0,
  };

  db.loans.unshift(storedLoan);
  db.notifications.unshift({
    id: `notif-${crypto.randomUUID()}`,
    userId,
    loanId: storedLoan.id,
    bookId: book.id,
    bookTitle: book.title,
    type: 'borrow_confirmed',
    title: 'Peminjaman berhasil dikonfirmasi',
    message: `Buku "${book.title}" telah ditambahkan ke Rak Pinjaman selama ${safeDays} hari. Batas pengembalian: ${new Date(dueAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    daysOverdue: 0,
    read: false,
    createdAt: new Date(now).toISOString(),
  });

  writeDbAtomic(db);
  return { loan: computeLoanMetrics(storedLoan, book) };
}

export function returnLoan(
  loanId: string,
  userId: string,
  isAdmin: boolean
): { loan?: Loan; error?: string } {
  const db = readDb();
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) return { error: 'Data peminjaman tidak ditemukan.' };
  if (!isAdmin && loan.userId !== userId) {
    return { error: 'Anda tidak memiliki akses ke peminjaman ini.' };
  }
  if (loan.status === 'returned') {
    return { error: 'Buku ini sudah dikembalikan sebelumnya.' };
  }

  loan.status = 'returned';
  loan.returnedAt = new Date().toISOString();

  const book = db.books.find((b) => b.id === loan.bookId);
  if (book) {
    book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
  }

  db.notifications.unshift({
    id: `notif-${crypto.randomUUID()}`,
    userId: loan.userId,
    loanId: loan.id,
    bookId: loan.bookId,
    bookTitle: book?.title || 'Buku Perpustakaan',
    type: 'return_confirmed',
    title: 'Pengembalian buku tercatat',
    message: `Terima kasih, buku "${book?.title || 'Buku Perpustakaan'}" telah berhasil dikembalikan ke koleksi perpustakaan.`,
    daysOverdue: 0,
    read: false,
    createdAt: new Date().toISOString(),
  });

  writeDbAtomic(db);
  return { loan: computeLoanMetrics(loan, book) };
}

export function extendLoan(
  loanId: string,
  userId: string
): { loan?: Loan; error?: string } {
  const db = readDb();
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) return { error: 'Data peminjaman tidak ditemukan.' };
  if (loan.userId !== userId) {
    return { error: 'Anda tidak memiliki akses ke peminjaman ini.' };
  }
  if (loan.status !== 'borrowed') {
    return { error: 'Buku sudah dikembalikan.' };
  }
  if (new Date(loan.dueAt).getTime() < Date.now()) {
    return {
      error:
        'Peminjaman yang sudah terlambat tidak dapat diperpanjang. Harap kembalikan buku terlebih dahulu.',
    };
  }
  if (loan.extendedCount >= 1) {
    return { error: 'Perpanjangan hanya dapat dilakukan maksimal 1 kali per peminjaman.' };
  }

  const newDueMs = new Date(loan.dueAt).getTime() + 3 * DAY_MS;
  loan.dueAt = new Date(newDueMs).toISOString();
  loan.extendedCount += 1;

  const book = db.books.find((b) => b.id === loan.bookId);
  writeDbAtomic(db);
  return { loan: computeLoanMetrics(loan, book) };
}

export function updateReadingProgress(
  loanId: string,
  userId: string,
  pageNumber: number
): { loan?: Loan; error?: string } {
  const db = readDb();
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) return { error: 'Peminjaman tidak ditemukan.' };
  if (loan.userId !== userId) {
    return { error: 'Anda tidak memiliki akses ke peminjaman ini.' };
  }
  loan.lastPageRead = Math.max(1, Math.floor(pageNumber));
  const book = db.books.find((b) => b.id === loan.bookId);
  writeDbAtomic(db);
  return { loan: computeLoanMetrics(loan, book) };
}

export function listUserNotifications(userId: string): LibraryNotification[] {
  sweepOverdueNotifications();
  const db = readDb();
  return db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markNotificationRead(
  notificationId: string,
  userId: string
): boolean {
  const db = readDb();
  const notif = db.notifications.find(
    (n) => n.id === notificationId && n.userId === userId
  );
  if (!notif) return false;
  notif.read = true;
  writeDbAtomic(db);
  return true;
}

export function markAllNotificationsRead(userId: string): void {
  const db = readDb();
  for (const notif of db.notifications) {
    if (notif.userId === userId) {
      notif.read = true;
    }
  }
  writeDbAtomic(db);
}

export function sendAdminOverdueReminders(targetLoanId?: string): {
  sentCount: number;
} {
  sweepOverdueNotifications();
  const db = readDb();
  const now = Date.now();
  let sentCount = 0;

  for (const loan of db.loans) {
    if (loan.status !== 'borrowed') continue;
    if (targetLoanId && loan.id !== targetLoanId) continue;

    const dueMs = new Date(loan.dueAt).getTime();
    if (dueMs >= now && !targetLoanId) continue;

    const daysOverdue =
      dueMs < now ? Math.max(1, Math.ceil((now - dueMs) / DAY_MS)) : 0;
    const book = db.books.find((b) => b.id === loan.bookId);
    const bookTitle = book ? book.title : 'Buku Perpustakaan';

    db.notifications.unshift({
      id: `notif-${crypto.randomUUID()}`,
      userId: loan.userId,
      loanId: loan.id,
      bookId: loan.bookId,
      bookTitle,
      type: 'admin_reminder',
      title:
        daysOverdue > 0
          ? `Peringatan Admin: Terlambat ${daysOverdue} hari`
          : `Pengingat Admin: Jadwal Pengembalian Buku`,
      message:
        daysOverdue > 0
          ? `Pengelola Pustaka Aksara mengingatkan bahwa buku "${bookTitle}" telah terlambat ${daysOverdue} hari (estimasi denda Rp ${(daysOverdue * DAILY_FINE_IDR).toLocaleString('id-ID')}). Mohon segera kembalikan.`
          : `Pengelola Pustaka Aksara mengingatkan agar buku "${bookTitle}" dikembalikan sesuai jadwal jatuh tempo.`,
      daysOverdue,
      read: false,
      createdAt: new Date(now).toISOString(),
    });
    sentCount += 1;
  }

  if (sentCount > 0) {
    writeDbAtomic(db);
  }
  return { sentCount };
}

export function simulateLoanOverdue(loanId: string): {
  loan?: Loan;
  error?: string;
} {
  const db = readDb();
  const loan = db.loans.find((l) => l.id === loanId);
  if (!loan) return { error: 'Data peminjaman tidak ditemukan.' };
  if (loan.status !== 'borrowed') {
    return { error: 'Hanya peminjaman aktif yang dapat disimulasikan terlambat.' };
  }

  loan.dueAt = new Date(Date.now() - 2 * DAY_MS).toISOString();
  writeDbAtomic(db);
  sweepOverdueNotifications();

  const updatedDb = readDb();
  const updatedLoan = updatedDb.loans.find((l) => l.id === loanId)!;
  const book = updatedDb.books.find((b) => b.id === updatedLoan.bookId);
  return { loan: computeLoanMetrics(updatedLoan, book) };
}
