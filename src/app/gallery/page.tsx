'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Images, Search, Filter, FolderOpen, RefreshCw, Trash2, 
  RotateCcw, Eye, Plus, CheckCircle2, AlertTriangle, 
  Calendar, User, Layers, ArrowUpDown, Sparkles, Loader2,
  FolderArchive, Building2, ExternalLink
} from 'lucide-react';
import { offlineDb } from '@/lib/offlineDb';
import GalleryModal from '@/components/GalleryModal';

interface SurveyGalleryItem {
  id: string;
  projectName: string;
  customerName: string;
  salesPersonName?: string;
  salesPersonId?: number;
  status: string;
  surveyDate?: string;
  createdAt: string;
  updatedAt: string;
  folderUrl?: string;
  imagesFolderUrl?: string;
  existingImages: any[];
  roomsData: any[];
  totalPhotosCount: number;
  previewThumbnails: string[];
}

export default function CentralGalleryPage() {
  const [surveys, setSurveys] = useState<SurveyGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  
  // Selected project for GalleryModal
  const [selectedGallerySurvey, setSelectedGallerySurvey] = useState<any | null>(null);

  // Notification Toast state
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4500);
  };

  // 1. Fetch current user session
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const isAdmin = currentUser ? ['Admin', 'OfficeAdmin', 'Approval'].includes(currentUser.role) : false;

  // 2. Load all surveys including deleted ones for Gallery
  const loadGalleryData = async () => {
    setLoading(true);
    try {
      let serverSurveys: any[] = [];
      if (navigator.onLine) {
        try {
          const res = await fetch('/api/surveys?includeDeleted=true');
          if (res.ok) {
            serverSurveys = await res.json();
          }
        } catch (err) {
          console.warn('Could not fetch from server, loading offline DB:', err);
        }
      }

      // Load local Dexie drafts to merge
      const localDrafts = await offlineDb.draftSurveys.toArray();

      // Merge and aggregate photo counts & preview thumbnails
      const map = new Map<string, any>();

      // Server data
      serverSurveys.forEach(s => map.set(s.id, s));

      // Local drafts
      localDrafts.forEach(d => {
        if (!map.has(d.id)) {
          map.set(d.id, d);
        } else {
          // If local draft is newer, merge
          const existing = map.get(d.id);
          if (new Date(d.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            map.set(d.id, { ...existing, ...d });
          }
        }
      });

      const processed: SurveyGalleryItem[] = Array.from(map.values()).map(item => {
        const existingImgs = Array.isArray(item.existingImages) ? item.existingImages : [];
        const rooms = Array.isArray(item.roomsData) ? item.roomsData : [];

        const allPhotos: string[] = [];
        
        existingImgs.forEach((img: any) => {
          const url = img.annotatedImage || img.originalImage;
          if (url) allPhotos.push(url);
        });

        rooms.forEach((r: any) => {
          if (r && Array.isArray(r.images)) {
            r.images.forEach((img: any) => {
              const url = img.annotatedImage || img.originalImage;
              if (url) allPhotos.push(url);
            });
          }
        });

        return {
          ...item,
          existingImages: existingImgs,
          roomsData: rooms,
          totalPhotosCount: allPhotos.length,
          previewThumbnails: allPhotos.slice(0, 4),
        };
      });

      // Sort by updatedAt desc
      processed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSurveys(processed);
    } catch (err) {
      console.error('Error loading gallery data:', err);
      showToast('error', 'ไม่สามารถโหลดข้อมูลคลังรูปภาพได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGalleryData();
  }, []);

  // 3. Filtered Surveys
  const filteredSurveys = useMemo(() => {
    return surveys.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        s.projectName.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.salesPersonName && s.salesPersonName.toLowerCase().includes(q));

      if (!matchQuery) return false;

      if (statusFilter === 'active') return s.status !== 'deleted';
      if (statusFilter === 'deleted') return s.status === 'deleted';
      return true;
    });
  }, [surveys, searchQuery, statusFilter]);

  // Total summary counts
  const totalActiveProjects = surveys.filter(s => s.status !== 'deleted').length;
  const totalDeletedProjects = surveys.filter(s => s.status === 'deleted').length;
  const totalPhotosSystem = surveys.reduce((acc, s) => acc + s.totalPhotosCount, 0);

  // 4. Restore a deleted project (Admin action)
  const handleRestoreProject = async (survey: SurveyGalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`คุณต้องการกู้คืนโครงการ "${survey.projectName}" กลับไปแสดงผลในแดชบอร์ดหลักใช่หรือไม่?`)) return;

    try {
      const res = await fetch('/api/surveys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: survey.id, action: 'restore' })
      });

      if (res.ok) {
        // Also update local Dexie
        try {
          const draft = await offlineDb.draftSurveys.get(survey.id);
          if (draft) {
            draft.status = 'synced';
            draft.updatedAt = new Date().toISOString();
            await offlineDb.draftSurveys.put(draft);
          }
        } catch (dbErr) {
          console.warn('Dexie update error:', dbErr);
        }

        showToast('success', `กู้คืนโครงการ "${survey.projectName}" สำเร็จแล้ว! โครงการจะกลับไปแสดงในแดชบอร์ด`);
        loadGalleryData();
      } else {
        showToast('error', 'ไม่สามารถกู้คืนโครงการได้ โปรดลองอีกครั้ง');
      }
    } catch (err: any) {
      showToast('error', 'เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // 5. Smart Cleanup of Unused Images
  const handleSmartCleanup = async () => {
    if (!confirm('ต้องการเริ่มระบบสแกนและตรวจสอบรูปภาพที่ไม่ได้ใช้งาน/ตกค้างในระบบใช่หรือไม่?')) return;

    try {
      setLoading(true);
      // Scan and clean local orphan drafts
      const allDrafts = await offlineDb.draftSurveys.toArray();
      let cleanedCount = 0;

      for (const d of allDrafts) {
        if (!d.projectName && !d.customerName && (!d.existingImages || d.existingImages.length === 0)) {
          await offlineDb.draftSurveys.delete(d.id);
          cleanedCount++;
        }
      }

      showToast('success', `สแกนเรียบร้อย! ระบบสะอาดสมบูรณ์ (ตรวจพบและเคลียร์แบบร่างว่าง ${cleanedCount} รายการ)`);
      loadGalleryData();
    } catch (err: any) {
      showToast('error', 'การสแกนล้างระบบขัดข้อง: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 md:p-8">
      {/* Toast Alert */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-slideUp ${
          toastMsg.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' :
          toastMsg.type === 'error' ? 'bg-rose-600 text-white border-rose-500' :
          'bg-slate-800 text-white border-slate-700'
        }`}>
          {toastMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-xs font-semibold">{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-200 shrink-0">
              <Images className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                คลังรูปภาพหน้างาน
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold border border-violet-100">
                  {totalPhotosSystem} รูปภาพ
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                ศูนย์รวมภาพถ่ายการสำรวจหน้างานทั้งหมด จัดระเบียบแยกตามโครงการ พร้อมเปิดดูและจัดการได้ทุกที่ทุกเวลา
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://drive.google.com/drive/folders/133P6jxYlZ0ixXPhuYwFQ8tjbNCATEnFT"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95"
              title="เปิดโฟลเดอร์รูปภาพรวมทั้งหมดใน Google Drive"
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span>Google Drive รวม</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            <button
              type="button"
              onClick={handleSmartCleanup}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95"
              title="สแกนตรวจสอบและล้างรูปภาพ/แคชขยะที่ไม่ใช้งาน"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>สแกนล้างรูปขยะ</span>
            </button>

            <button
              type="button"
              onClick={loadGalleryData}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหาชื่อโครงการ, ชื่อลูกค้า, หรือผู้สำรวจ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-250 focus:border-violet-500 rounded-xl text-xs font-medium focus:outline-hidden transition shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'all'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({surveys.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'active'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🟢 โครงการเปิดอยู่ ({totalActiveProjects})
            </button>
            <button
              onClick={() => setStatusFilter('deleted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === 'deleted'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🗑️ โครงการที่ลบแล้ว ({totalDeletedProjects})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mb-3" />
          <p className="text-sm font-semibold text-slate-700">กำลังจัดเตรียมคลังรูปภาพหน้างาน...</p>
          <p className="text-xs text-slate-400 mt-1">กำลังรวบรวมรูปภาพจากทุกโครงการ</p>
        </div>
      ) : filteredSurveys.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <Images className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-700">ไม่พบโครงการหรือรูปภาพที่ค้นหา</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            {searchQuery ? `ไม่พบผลลัพธ์สำหรับคำค้น "${searchQuery}"` : 'ยังไม่มีโครงการหรือรูปภาพในหมวดหมู่นี้'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-violet-50 text-violet-700 rounded-xl text-xs font-semibold hover:bg-violet-100 transition"
            >
              ล้างการค้นหา
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredSurveys.map((survey) => {
            const isDeleted = survey.status === 'deleted';
            return (
              <div
                key={survey.id}
                onClick={() => setSelectedGallerySurvey(survey)}
                className={`group bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col overflow-hidden ${
                  isDeleted ? 'border-rose-200/80 bg-rose-50/20' : 'border-slate-200/80 hover:border-violet-300'
                }`}
              >
                {/* Thumbnail Stack Preview Box */}
                <div className="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  {survey.previewThumbnails.length === 0 ? (
                    <div className="text-center p-4 text-slate-500 flex flex-col items-center">
                      <Images className="w-8 h-8 mb-1 text-slate-600" />
                      <span className="text-[11px]">ยังไม่มีรูปภาพในงานนี้</span>
                    </div>
                  ) : survey.previewThumbnails.length === 1 ? (
                    <img
                      src={survey.previewThumbnails[0]}
                      alt={survey.projectName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full grid grid-cols-2 gap-0.5">
                      {survey.previewThumbnails.slice(0, 4).map((thumb, tIdx) => (
                        <div key={tIdx} className="w-full h-full overflow-hidden bg-slate-800">
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                    {/* Status Badge */}
                    {isDeleted ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-600/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                        <FolderArchive className="w-2.5 h-2.5" />
                        โครงการถูกลบแล้ว
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium shadow-xs">
                        {survey.surveyDate ? `สำรวจ: ${survey.surveyDate}` : 'โครงการเปิดอยู่'}
                      </span>
                    )}

                    {/* Photo Count Badge */}
                    <span className="px-2 py-0.5 rounded-md bg-violet-600/90 backdrop-blur-xs text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                      <Images className="w-2.5 h-2.5" />
                      {survey.totalPhotosCount} รูป
                    </span>
                  </div>

                  {/* Hover Overlay Icon */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-3.5 py-1.5 bg-white/95 rounded-xl text-slate-800 text-xs font-bold shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Eye className="w-3.5 h-3.5 text-violet-600" />
                      เปิดดูคลังรูปภาพ
                    </span>
                  </div>
                </div>

                {/* Card Body Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-violet-600 transition-colors" title={survey.projectName}>
                      {survey.projectName || 'ไม่ได้ระบุชื่อโครงการ'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5" title={survey.customerName}>
                      ลูกค้า: <span className="text-slate-700">{survey.customerName || '-'}</span>
                    </p>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 truncate">
                      {survey.salesPersonName ? `ผู้สำรวจ: ${survey.salesPersonName}` : 'SWS Team'}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Admin Restore Button for Deleted Projects */}
                      {isDeleted && isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleRestoreProject(survey, e)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-xs active:scale-95"
                          title="กู้คืนโครงการนี้กลับไปแสดงในแดชบอร์ด"
                        >
                          <RotateCcw className="w-3 h-3" />
                          กู้คืนงาน
                        </button>
                      )}

                      {/* Open Gallery Button */}
                      <button
                        type="button"
                        onClick={() => setSelectedGallerySurvey(survey)}
                        className="p-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-semibold transition"
                        title="เปิดดูคลังรูปภาพโครงการนี้"
                      >
                        <Images className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Gallery Modal */}
      {selectedGallerySurvey && (
        <GalleryModal
          survey={selectedGallerySurvey}
          isOpen={!!selectedGallerySurvey}
          onClose={() => setSelectedGallerySurvey(null)}
          onSurveyUpdated={(updated) => {
            setSurveys(prev => prev.map(s => s.id === updated.id ? {
              ...s,
              ...updated,
              totalPhotosCount: (updated.existingImages?.length || 0) + (updated.roomsData?.reduce((a: number, r: any) => a + (r.images?.length || 0), 0) || 0)
            } : s));
            setSelectedGallerySurvey(updated);
          }}
        />
      )}
    </div>
  );
}
