import { useState, type FormEvent } from 'react';
import { X, UserCheck, ArrowRight } from 'lucide-react';
import type { AuthSession } from '../types';
import { loginDemoReader, loginMemberApi, registerMemberApi } from '../api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (session: AuthSession) => void;
}

export function AuthModal({ isOpen, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleDemoLogin() {
    setError(null);
    setLoading(true);
    try {
      const session = await loginDemoReader();
      onAuthenticated(session);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk akun demo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session =
        mode === 'register'
          ? await registerMemberApi(name, email, password)
          : await loginMemberApi(email, password);
      onAuthenticated(session);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Proses autentikasi gagal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E6E0D4] rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E0D4] bg-[#FBF9F5]">
          <h2 id="auth-modal-title" className="font-serif text-xl font-semibold text-[#1C1917]">
            {mode === 'login' ? 'Masuk Anggota Perpustakaan' : 'Daftar Anggota Baru'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#57534E] hover:text-[#1C1917] rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-[#1E3A8A]"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-4 bg-[#F3EFE7] border border-[#E6E0D4] rounded-md space-y-3">
            <div className="text-sm text-[#1C1917] font-medium">
              Akses Cepat Pembaca Demo
            </div>
            <p className="text-xs text-[#57534E] leading-relaxed">
              Masuk sebagai <span className="font-semibold text-[#1C1917]">Rani Pratama</span>{' '}
              untuk langsung menguji peminjaman aktif, pembaca PDF daring, dan notifikasi
              keterlambatan pengembalian.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={handleDemoLogin}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1E3A8A] hover:bg-[#172D6B] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Masuk sebagai Rani Pratama</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#78716C]">
            <div className="h-px flex-1 bg-[#E6E0D4]" />
            <span>atau gunakan akun anggota</span>
            <div className="h-px flex-1 bg-[#E6E0D4]" />
          </div>

          <div className="flex gap-1 p-1 bg-[#F3EFE7] rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#57534E] hover:text-[#1C1917]'
              }`}
            >
              Daftar Baru
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@domain.id"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1C1917] mb-1.5">
                Kata Sandi
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3 py-2 text-sm bg-white border border-[#D6CEBE] rounded-md focus:outline-none focus:border-[#1E3A8A]"
              />
            </div>

            {error && (
              <p className="text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#1C1917] bg-[#F3EFE7] hover:bg-[#E6E0D4] border border-[#D6CEBE] rounded-md transition-colors disabled:opacity-60 cursor-pointer"
            >
              <span>{mode === 'login' ? 'Masuk ke Perpustakaan' : 'Buat Akun Anggota'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
