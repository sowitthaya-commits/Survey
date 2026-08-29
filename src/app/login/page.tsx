'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, KeyRound, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [regForm, setRegForm] = useState({
    username: '',
    password: '',
    name: '',
    position: ''
  });

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ลงทะเบียนล้มเหลว');
      }

      setSuccessMessage('ลงทะเบียนสำเร็จ! กรุณาเข้าสู่ระบบด้วยบัญชีใหม่ของคุณ');
      setAuthMode('login');
      setUsername(regForm.username);
      setPassword('');
      setRegForm({ username: '', password: '', name: '', position: '' });
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen items-center justify-center p-4 font-sans select-none"
      style={{
        background: 'radial-gradient(circle at center, #1e1b4b 0%, #020617 100%)'
      }}
    >
      <div 
        className="w-full max-w-md p-8 md:p-10 rounded-3xl border shadow-2xl transition-all duration-300"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.08)'
        }}
      >
        {/* Title / Logo */}
        <div className="text-center mb-8">
          <h2 
            className="text-3xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            style={{
              fontFamily: "'Outfit', sans-serif"
            }}
          >
            SWS Survey System
          </h2>
          <p className="text-slate-400 text-xs md:text-sm">
            ระบบจัดเก็บแบบสำรวจความต้องการอุปกรณ์ภาพและเสียงหน้างาน
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5 text-rose-300 text-xs md:text-sm mb-5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Notification */}
        {successMessage && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 text-emerald-300 text-xs md:text-sm mb-5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {authMode === 'login' ? (
          /* Login Form */
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="ป้อน Username ของคุณ"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="ป้อนรหัสผ่านของคุณ"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
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

            <div className="text-center mt-6 text-xs text-slate-400">
              ยังไม่มีบัญชีใช้งานในระบบ?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition"
              >
                สร้างบัญชีใช้งาน
              </button>
            </div>
          </form>
        ) : (
          /* Register Form */
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="ตัวอักษรภาษาอังกฤษหรือตัวเลข"
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="รหัสผ่านเข้าสู่ระบบ"
                  value={regForm.password}
                  onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">ชื่อ - นามสกุล</label>
              <input
                type="text"
                required
                placeholder="ป้อนชื่อและนามสกุลจริงของคุณ"
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 block">ตำแหน่งงาน (Position)</label>
              <select
                required
                value={regForm.position}
                onChange={(e) => setRegForm({ ...regForm, position: e.target.value })}
                className="w-full px-4 py-3 bg-slate-950/80 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 text-sm transition"
              >
                <option value="" className="bg-slate-900 text-slate-400">-- เลือกตำแหน่งงาน --</option>
                <option value="Imagine" className="bg-slate-900 text-white">Imagine</option>
                <option value="Accounting" className="bg-slate-900 text-white">Accounting</option>
                <option value="Business Deveropment" className="bg-slate-900 text-white">Business Deveropment</option>
                <option value="Engineering" className="bg-slate-900 text-white">Engineering</option>
                <option value="Sales Support" className="bg-slate-900 text-white">Sales Support</option>
                <option value="JPC&Edgecore" className="bg-slate-900 text-white">JPC&Edgecore</option>
                <option value="Marketing" className="bg-slate-900 text-white">Marketing</option>
                <option value="Planning" className="bg-slate-900 text-white">Planning</option>
                <option value="Sales" className="bg-slate-900 text-white">Sales</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังสร้างบัญชี...
                </>
              ) : (
                <>
                  ลงทะเบียนผู้ใช้ใหม่
                </>
              )}
            </button>

            <div className="text-center mt-6 text-xs text-slate-400">
              มีบัญชีใช้งานอยู่แล้ว?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold transition"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
