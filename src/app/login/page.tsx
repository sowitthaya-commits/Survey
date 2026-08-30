'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เข้าสู่ระบบล้มเหลว');
      }

      setSuccessMessage('เข้าสู่ระบบสำเร็จ! กำลังนำทางไปยังหน้าหลัก...');
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 font-sans select-none bg-slate-50"
    >
      <div 
        className="w-full max-w-md p-8 md:p-10 rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        {/* Title / Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-2xl shadow-md shadow-indigo-200 mb-4">
            S
          </div>
          <h2 
            className="text-2xl font-extrabold tracking-tight text-slate-800 mb-1.5"
            style={{
              fontFamily: "'Outfit', sans-serif"
            }}
          >
            SWS Survey System
          </h2>
          <p className="text-slate-500 text-xs md:text-sm">
            ระบบจัดเก็บแบบสำรวจความต้องการอุปกรณ์ภาพและเสียงหน้างาน
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-rose-700 text-xs md:text-sm mb-5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-emerald-700 text-xs md:text-sm mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 block">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                disabled={loading}
                placeholder="ป้อน Username ของคุณ"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                disabled={loading}
                placeholder="ป้อนรหัสผ่านของคุณ"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm transition disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 hover:shadow-indigo-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
