'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Plus,
  Database,
  LogOut,
  Pin,
  Loader2,
  Calendar,
  User,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info
} from 'lucide-react';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sidebar expand/collapse states matching workload app
  const [sidebarPinned, setSidebarPinned] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // Custom beautiful popup modal state
  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'confirm' | 'warning' | 'error' | 'info';
    onConfirm?: () => void;
    onCancel?: () => void;
  } | null>(null);

  const showPopup = (
    type: 'success' | 'confirm' | 'warning' | 'error' | 'info',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    setModalConfig({ show: true, type, title, message, onConfirm, onCancel });
  };
  
  useEffect(() => {
    // Read pinned setting from localStorage
    const savedPin = localStorage.getItem('survey_sidebarPinned');
    if (savedPin !== null) {
      setSidebarPinned(savedPin === 'true');
    }
  }, []);

  const toggleSidebarPin = () => {
    const nextState = !sidebarPinned;
    setSidebarPinned(nextState);
    localStorage.setItem('survey_sidebarPinned', String(nextState));
  };

  const isSidebarExpanded = sidebarPinned || sidebarHovered;
  const sidebarCollapsed = !isSidebarExpanded;

  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    // Check login session
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then(data => {
        if (data && data.user) {
          setCurrentUser(data.user);
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [pathname, router]);

  const handleLogout = async () => {
    showPopup(
      'confirm',
      'ออกจากระบบ',
      'คุณต้องการออกจากระบบใช่หรือไม่?',
      async () => {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
          setCurrentUser(null);
          router.push('/login');
          router.refresh();
        }
      }
    );
  };

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-10 h-10 animate-spin text-[#4f46e5] mb-2" />
        <span className="text-slate-500 font-medium text-sm">กำลังโหลดข้อมูลระบบสำรวจ...</span>
      </div>
    );
  }

  if (!currentUser) {
    return null; // Redirecting to login
  }

  const isAdmin = ['Admin', 'OfficeAdmin', 'Approval'].includes(currentUser.role);

  const navItems = [
    { href: '/', name: 'แดชบอร์ด', icon: LayoutDashboard },
    { href: '/survey/new', name: 'เพิ่มแบบสำรวจใหม่', icon: Plus },
    { href: '/master', name: 'ตั้งค่าข้อมูลหลัก', icon: Database, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const getPageTitle = () => {
    if (pathname === '/') return 'แดชบอร์ดแบบสำรวจ';
    if (pathname === '/survey/new' || pathname.startsWith('/survey/new')) return 'ทำรายการบันทึกแบบสำรวจ';
    if (pathname === '/master') return 'จัดการการตั้งค่าข้อมูลหลัก';
    return 'ระบบสำรวจหน้างาน';
  };

  const getTodayString = () => {
    return new Date().toLocaleDateString('th-TH', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''} no-print`}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        style={{
          width: sidebarCollapsed ? '75px' : '260px',
        }}
      >
        <div>
          <div className="sidebar-header" style={{ justifyContent: sidebarCollapsed ? 'center' : 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '6px',
                background: 'var(--primary-gradient)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#fff', fontSize: '1.1rem'
              }}>
                S
              </div>
              {!sidebarCollapsed && (
                <span className="sidebar-logo-text">Survey System</span>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={toggleSidebarPin}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title={sidebarPinned ? "ยกเลิกการหมุดเมนู (Auto Hide)" : "ปักหมุดเมนูค้างไว้"}
              >
                <Pin size={15} style={{ transform: 'rotate(45deg)', fill: sidebarPinned ? 'currentColor' : 'none', opacity: sidebarPinned ? 1 : 0.4 }} />
              </button>
            )}
          </div>

          <ul className="sidebar-menu">
            {filteredNavItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                    title={item.name}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!sidebarCollapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="user-profile-badge" style={{ 
            justifyContent: sidebarCollapsed ? 'center' : 'space-between', 
            flexDirection: sidebarCollapsed ? 'column' : 'row', 
            gap: '0.5rem' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <div className="user-avatar">
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              {!sidebarCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.position || currentUser.role}
                  </span>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="ออกจากระบบ"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 no-print" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main Wrapper */}
      <div className="main-wrapper">
        <header className="main-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {getPageTitle()}
            </h2>
          </div>
          <div className="text-slate-400 text-xs md:text-sm flex items-center gap-1.5">
            <Calendar size={14} className="text-[#4f46e5]" />
            <span>วันนี้: {getTodayString()}</span>
          </div>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>

      {/* Custom Popup Modal */}
      {modalConfig && modalConfig.show && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-scaleUp">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              modalConfig.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
              modalConfig.type === 'confirm' ? 'bg-indigo-50 text-indigo-600' :
              modalConfig.type === 'warning' ? 'bg-amber-50 text-amber-600' :
              modalConfig.type === 'error' ? 'bg-rose-50 text-rose-600' :
              'bg-blue-50 text-blue-600'
            }`}>
              {modalConfig.type === 'success' && <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />}
              {modalConfig.type === 'confirm' && <HelpCircle className="w-6 h-6 stroke-[2.5]" />}
              {modalConfig.type === 'warning' && <AlertTriangle className="w-6 h-6 stroke-[2.5]" />}
              {modalConfig.type === 'error' && <XCircle className="w-6 h-6 stroke-[2.5]" />}
              {modalConfig.type === 'info' && <Info className="w-6 h-6 stroke-[2.5]" />}
            </div>
            
            <div className="space-y-1">
              <h3 className="font-bold text-slate-800 text-base">{modalConfig.title}</h3>
              <p className="text-slate-500 text-xs md:text-sm leading-relaxed">{modalConfig.message}</p>
            </div>

            <div className="flex gap-2 w-full pt-2">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setModalConfig(null);
                      if (modalConfig.onCancel) modalConfig.onCancel();
                    }}
                    className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-650 text-xs font-semibold transition"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalConfig(null);
                      if (modalConfig.onConfirm) modalConfig.onConfirm();
                    }}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
                  >
                    ตกลง
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModalConfig(null);
                    if (modalConfig.onConfirm) modalConfig.onConfirm();
                  }}
                  className={`w-full py-2 px-4 text-white rounded-xl text-xs font-bold transition shadow-sm ${
                    modalConfig.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    modalConfig.type === 'error' ? 'bg-rose-600 hover:bg-rose-700' :
                    modalConfig.type === 'warning' ? 'bg-amber-505 hover:bg-amber-600' :
                    'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  ตกลง
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        /* Sidebar slide transitions and styles */
        .sidebar {
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .main-wrapper {
          min-height: 100vh;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        @media (min-width: 641px) {
          .sidebar.collapsed {
            width: 75px;
          }
          .sidebar:not(.collapsed) {
            width: 260px;
          }
        }

        @media (max-width: 640px) {
          .sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: -260px;
            width: 260px;
            height: 100vh;
            box-shadow: 10px 0 30px rgba(0, 0, 0, 0.3);
            transition: left 0.3s ease;
            z-index: 100;
          }

          .sidebar.mobile-open {
            left: 0;
          }
        }
      `}</style>
    </div>
  );
}
