'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { offlineDb, type DraftSurvey } from '@/lib/offlineDb';
import { syncMasterDataCache } from '@/lib/offlineSyncHelper';
import { 
  Plus, Search, FileText, Download, Edit2, Trash2, Database, 
  Wifi, WifiOff, RefreshCw, AlertCircle, FileSpreadsheet, Loader2, 
  CheckCircle2, Eye, Copy, X, MapPin, Monitor, Volume2, ShieldCheck, Image as ImageIcon, Images, Check, LogOut,
  HelpCircle, AlertTriangle, XCircle, Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import GalleryModal from '@/components/GalleryModal';

interface SurveyItem {
  id: string;
  projectName: string;
  customerName: string;
  salesPersonName?: string;
  salesPersonId?: number;
  status: 'draft' | 'pending_sync' | 'generating' | 'completed' | 'synced' | 'deleted';
  docUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  requestDate?: string;
  locationLat?: number;
  locationLng?: number;
  locationAddress?: string;
  quotationDeadline?: string;
  budget?: string;
  existingImages: any[];
  contactName?: string;
  contactPhone?: string;
  surveyDate?: string;
  roomsData: any[];
}

export default function Dashboard() {
  const router = useRouter();
  const { isOnline, pendingCount, syncing, syncError, syncPendingSurveys } = useOfflineSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterSynced, setMasterSynced] = useState(false);

  // Gallery Modal state
  const [gallerySurvey, setGallerySurvey] = useState<SurveyItem | null>(null);

  // Summary Modal state
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyItem | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

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
    loadAllSurveys();
    
    if (isOnline && !masterSynced) {
      syncMasterDataCache().then(() => setMasterSynced(true));
    }

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(err => console.error('Failed to load session:', err));
  }, [isOnline, pendingCount, syncing]);

  // Poll if any survey is generating in the background
  useEffect(() => {
    const hasGenerating = surveys.some(s => s.status === 'generating');
    if (hasGenerating && isOnline) {
      const interval = setInterval(() => {
        loadAllSurveys(true); // silent polling
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [surveys, isOnline]);

  const handleLogout = async () => {
    if (!confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) return;
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    if (res.ok) {
      router.push('/login');
      router.refresh();
    }
  };

  const loadAllSurveys = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let serverSurveys: SurveyItem[] = [];

      if (isOnline) {
        try {
          const response = await fetch('/api/surveys');
          if (response.ok) {
            serverSurveys = await response.json();
          }
        } catch (e) {
          console.error('Failed to fetch from SQLite server:', e);
        }
      }

      const localDrafts = await offlineDb.draftSurveys.toArray();
      const localSurveys: SurveyItem[] = localDrafts.map(d => ({
        id: d.id,
        projectName: d.projectName,
        customerName: d.customerName,
        salesPersonId: d.salesPersonId,
        salesPersonName: d.salesPersonName,
        status: d.status,
        docUrl: null,
        pdfUrl: null,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        requestDate: d.requestDate,
        locationLat: d.locationLat,
        locationLng: d.locationLng,
        locationAddress: d.locationAddress,
        quotationDeadline: d.quotationDeadline,
        budget: d.budget,
        existingImages: d.existingImages || [],
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        surveyDate: d.surveyDate,
        roomsData: d.roomsData || [],
      }));

      const mergedList = [...localSurveys];
      
      serverSurveys.forEach(serverSurvey => {
        const index = mergedList.findIndex(local => local.id === serverSurvey.id);
        if (index > -1) {
          mergedList[index] = serverSurvey;
        } else {
          mergedList.push(serverSurvey);
        }
      });

      mergedList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      setSurveys(mergedList);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const filteredSurveys = surveys.filter(s => 
    s.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id: string, status: string) => {
    showPopup(
      'confirm',
      'ยืนยันการลบข้อมูล',
      'คุณต้องการลบข้อมูลแบบสำรวจนี้ออกจากแดชบอร์ดใช่หรือไม่?\n(รูปภาพของโครงการจะยังคงถูกเก็บรักษาไว้ใน "คลังรูปภาพ" และผู้ดูแลระบบสามารถกู้คืนได้ตลอดเวลา)',
      async () => {
        try {
          if (status === 'draft' || status === 'pending_sync') {
            await offlineDb.draftSurveys.delete(id);
            showPopup('success', 'ลบสำเร็จ', 'ลบแบบร่างในเครื่องเรียบร้อยแล้ว');
          } else {
            if (!isOnline) {
              showPopup('error', 'ข้อผิดพลาด', 'คุณไม่สามารถลบข้อมูลบนเซิร์ฟเวอร์ได้ขณะออฟไลน์');
              return;
            }

            const res = await fetch(`/api/surveys?id=${id}`, {
              method: 'DELETE',
            });

            if (res.ok) {
              showPopup('success', 'ลบสำเร็จ', 'ลบโครงการออกจากแดชบอร์ดเรียบร้อยแล้ว (รูปภาพยังคงถูกเก็บรักษาไว้ในคลังรูปภาพ)');
            } else {
              showPopup('error', 'ข้อผิดพลาด', 'ไม่สามารถลบข้อมูลจากเซิร์ฟเวอร์ได้');
            }
          }
          loadAllSurveys();
        } catch (e) {
          console.error('Error deleting survey:', e);
        }
      }
    );
  };

  const handleClone = async (item: SurveyItem) => {
    showPopup(
      'confirm',
      'ยืนยันการโคลนแม่แบบ',
      `คุณต้องการคัดลอกแบบสำรวจโครงการ "${item.projectName}" เพื่อนำไปใช้เป็นแม่แบบสำหรับสร้างงานใหม่ใช่หรือไม่?`,
      async () => {
        try {
          const newUuid = uuidv4();
          const now = new Date().toISOString();

          const clonedRooms = (item.roomsData || []).map(room => {
            return {
              ...room,
              id: uuidv4(),
              images: [],
            };
          });

          const draft: DraftSurvey = {
            id: newUuid,
            projectName: '',
            customerName: '',
            salesPersonId: item.salesPersonId,
            status: 'draft',
            createdAt: now,
            updatedAt: now,
            locationLat: item.locationLat,
            locationLng: item.locationLng,
            locationAddress: item.locationAddress,
            existingImages: [],
            roomsData: clonedRooms,
          };

          await offlineDb.draftSurveys.put(draft);
          
          showPopup(
            'success',
            'คัดลอกแม่แบบสำเร็จ',
            'คัดลอกแม่แบบสำเร็จ! ระบบจะนำท่านไปยังฟอร์มกรอกข้อมูลลูกค้าโครงการใหม่',
            () => {
              router.push(`/survey/new?id=${newUuid}`);
            }
          );
        } catch (e) {
          console.error('Error cloning survey:', e);
          showPopup('error', 'ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโคลนข้อมูล');
        }
      }
    );
  };

  const triggerSync = async () => {
    if (!isOnline) {
      showPopup('warning', 'คำเตือน', 'ไม่สามารถซิงค์ได้เนื่องจากสัญญาณออฟไลน์');
      return;
    }
    await syncPendingSurveys();
    await loadAllSurveys();
  };

  return (
    <div className="pb-12 animate-fade-in">
      
      {/* Main Section */}
      <div className="max-w-6xl mx-auto">

        {/* Sync Failure Warning Banner */}
        {syncError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-pulse">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-rose-800 text-sm">การเชื่อมต่อเพื่ออัปโหลดล้มเหลว (Sync Error)</h3>
                <p className="text-xs text-rose-600 mt-1 font-semibold">
                  {syncError}
                </p>
              </div>
            </div>
            <button
              onClick={triggerSync}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              ลองซิงค์ใหม่อีกครั้ง
            </button>
          </div>
        )}

        {/* Unsynced Offline Banner */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-800 text-sm">พบข้อมูลค้างการอัปโหลดลงระบบ</h3>
                <p className="text-xs text-amber-600 mt-1">
                  มีแบบสำรวจ {pendingCount} รายการที่บันทึกไว้ขณะออฟไลน์และยังไม่ได้ส่งขึ้นคลาวด์/Google Drive
                </p>
              </div>
            </div>
            <button
              onClick={triggerSync}
              disabled={!isOnline || syncing}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
            >
              {syncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  กำลังซิงค์...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  ซิงค์ข้อมูลเดี๋ยวนี้
                </>
              )}
            </button>
          </div>
        )}

        {/* Dashboard Tools */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อโปรเจกต์ หรือชื่อลูกค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] text-sm"
            />
          </div>

          <Link
            href="/survey/new"
            className="bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:bg-gradient-to-r from-[#4338ca] to-[#6d28d9] text-white font-bold text-sm py-2 px-5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            เพิ่มแบบสำรวจใหม่
          </Link>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-lg">รายการแบบสำรวจหน้างานทั้งหมด</h2>
            <span className="text-xs text-slate-400 font-semibold">{filteredSurveys.length} รายการ</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5] mb-2" />
              <p className="text-sm">กำลังดึงข้อมูลแบบสำรวจ...</p>
            </div>
          ) : filteredSurveys.length === 0 ? (
            <div className="text-center py-20 px-4 text-slate-500">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">ไม่พบข้อมูลแบบสำรวจในระบบ</p>
              <p className="text-xs text-slate-400 mt-1">กดปุ่ม &quot;เพิ่มแบบสำรวจใหม่&quot; เพื่อกรอกแบบร่างหน้างาน</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50/50">
                    <th className="py-3.5 px-6 font-bold text-slate-600 uppercase tracking-wide text-xs">ชื่อโปรเจกต์ / โครงการ</th>
                    <th className="py-3.5 px-6 font-bold text-slate-600 uppercase tracking-wide text-xs">ลูกค้า / หน่วยงาน</th>
                    <th className="py-3.5 px-6 font-bold text-slate-600 uppercase tracking-wide text-xs">ผู้สำรวจ</th>
                    <th className="py-3.5 px-6 font-bold text-slate-600 uppercase tracking-wide text-xs">จำนวนห้อง</th>
                    <th className="py-3.5 px-6 font-bold text-slate-600 uppercase tracking-wide text-xs">สถานะ</th>
                    <th className="py-3.5 px-6 font-bold text-slate-600 uppercase tracking-wide text-xs text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSurveys.map((survey) => (
                    <tr key={survey.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-semibold text-slate-900 max-w-xs truncate" title={survey.projectName}>
                        {survey.projectName || <em className="text-slate-400 font-normal">ไม่มีชื่อโปรเจกต์ (แบบร่าง)</em>}
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-medium">
                        {survey.customerName || <em className="text-slate-400 font-normal">ไม่ได้ระบุลูกค้า</em>}
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-xs">
                        {survey.salesPersonName || '-'}
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-xs font-semibold">
                        {(survey.roomsData || []).length} ห้อง / จุด
                      </td>
                      <td className="py-4 px-6">
                        {renderStatusBadge(survey.status)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedSurvey(survey)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                            title="เรียกดูสรุปข้อมูลคร่าวๆ"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {(() => {
                            const isGenerating = survey.status === 'generating' || survey.status === 'pending_sync';
                            const isRealDoc = !isGenerating && !!(survey.docUrl && (survey.docUrl.includes('spreadsheets/d/') || survey.docUrl.includes('drive.google.com/')));
                            const isRealPdf = !isGenerating && !!(survey.pdfUrl && survey.pdfUrl.includes('drive.google.com/'));
                            
                            return (
                              <>
                                <a
                                  href={isRealDoc ? survey.docUrl! : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-2 rounded-lg transition-all ${
                                    isRealDoc 
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                  onClick={(e) => !isRealDoc && e.preventDefault()}
                                  title={isGenerating ? "กำลังอัปเดตเอกสารในเบื้องหลัง กรุณารอสักครู่..." : isRealDoc ? "ลิงก์ Google Sheets เอกสารสรุป" : "ยังไม่ได้สร้างสเปรดชีตสรุป (กรุณากดแก้ไขและกดบันทึกสร้างรายงาน)"}
                                >
                                  <FileText className="w-4 h-4" />
                                </a>

                                <a
                                  href={isRealPdf ? survey.pdfUrl! : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-2 rounded-lg transition-all ${
                                    isRealPdf 
                                      ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                  }`}
                                  onClick={(e) => !isRealPdf && e.preventDefault()}
                                  title={isGenerating ? "กำลังสร้าง PDF ในเบื้องหลัง กรุณารอสักครู่..." : isRealPdf ? "ดาวน์โหลดสรุปเป็น PDF" : "ยังไม่ได้สร้าง PDF รายงาน (กรุณากดแก้ไขและกดบันทึกสร้างรายงาน)"}
                                >
                                  <Download className="w-4 h-4" />
                                </a>

                                {/* Photo Gallery Button */}
                                <button
                                  type="button"
                                  onClick={() => setGallerySurvey(survey)}
                                  className="p-2 bg-violet-50 hover:bg-violet-100 text-violet-600 hover:text-violet-800 rounded-lg transition-all"
                                  title="คลังภาพถ่ายหน้างาน (Photo Gallery)"
                                >
                                  <Images className="w-4 h-4" />
                                </button>
                              </>
                            );
                          })()}

                          <button
                            onClick={() => handleClone(survey)}
                            className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 hover:text-purple-800 rounded-lg transition-all"
                            title="โคลน (Clone) คัดลอกไปทำเป็นงานใหม่"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <Link
                            href={`/survey/new?id=${survey.id}`}
                            className="p-2 bg-slate-55 hover:bg-slate-150 text-slate-600 hover:text-slate-900 rounded-lg transition-all border border-slate-100"
                            title="แก้ไขข้อมูลฟอร์ม"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleDelete(survey.id, survey.status)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-700 rounded-lg transition-all"
                            title="ลบแบบสำรวจนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary View Modal (Narrative report format as requested) */}
      {selectedSurvey && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="bg-slate-100 px-6 py-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#4f46e5]" />
                <h3 className="font-bold text-slate-900 text-base">รายงานสรุปข้อความแบบสำรวจความต้องการหน้างาน</h3>
              </div>
              <button 
                onClick={() => setSelectedSurvey(null)}
                className="text-slate-500 hover:text-slate-800 p-1 hover:bg-slate-200 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              {/* Copy Report Button */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200 gap-2">
                <span className="text-xs text-slate-500 font-medium">คุณสามารถคัดลอกสรุปข้อความรายงานนี้เพื่อแชร์ลงกลุ่ม LINE หรือส่งทางอีเมลได้ทันที</span>
                <button
                  type="button"
                  onClick={() => {
                    const textReport = generateTextSummary(selectedSurvey);
                    navigator.clipboard.writeText(textReport);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-center ${
                    copySuccess 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] text-white hover:bg-gradient-to-r from-[#4338ca] to-[#6d28d9]'
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      คัดลอกสำเร็จ!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      คัดลอกข้อความสรุปทั้งหมด
                    </>
                  )}
                </button>
              </div>

              {/* Text narrative container */}
              <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto max-h-[40vh] border border-slate-800 shadow-inner">
                <pre className="whitespace-pre-wrap">{generateTextSummary(selectedSurvey)}</pre>
              </div>

              {/* drawings gallery with download for drawing viewer */}
              {(() => {
                const modalDrawings: { id: string; roomName: string; step: number; annotatedImage: string; description: string }[] = [];
                (selectedSurvey.existingImages || []).forEach((img: any) => {
                  modalDrawings.push({ id: img.id, roomName: 'อาคาร / หน้าห้อง', step: 1, annotatedImage: img.annotatedImage, description: img.description });
                });
                (selectedSurvey.roomsData || []).forEach((room: any) => {
                  (room.images || []).forEach((img: any) => {
                    modalDrawings.push({ id: img.id, roomName: room.name, step: img.step, annotatedImage: img.annotatedImage, description: img.description });
                  });
                });

                return modalDrawings.length > 0 ? (
                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-900 text-sm">คลังรูปวาดและเส้นบอกระยะ ({modalDrawings.length} รูป)</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {modalDrawings.map((draw, idx) => (
                        <div key={draw.id} className="border border-slate-200 bg-slate-55 p-2.5 rounded-xl flex flex-col justify-between shadow-3xs">
                          <div>
                            <div className="relative w-full h-28 border border-slate-200 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={formatDriveEmbedUrl(draw.annotatedImage)} alt={`Drawing thumbnail ${idx}`} className="object-cover w-full h-full" />
                            </div>
                            <p className="font-bold text-blue-900 text-xs mt-1.5">{draw.roomName} <span className="text-slate-400 font-normal">| ขั้นที่ {draw.step}</span></p>
                            {draw.description && <p className="text-[11px] text-slate-500 mt-0.5">{draw.description}</p>}
                          </div>
                          <a
                            href={draw.annotatedImage}
                            download={`sws_drawing_${draw.roomName.replace(/\s+/g, '_')}_step${draw.step}_${idx}.png`}
                            className="w-full mt-2 bg-[#4f46e5]/10 text-blue-650 hover:bg-[#4f46e5]/20 text-[10px] font-bold py-1.5 rounded-lg text-center flex items-center justify-center gap-1 transition"
                          >
                            <Download className="w-3 h-3" />
                            ดาวน์โหลดรูปวาด
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            
            <div className="bg-slate-55 px-6 py-4 flex justify-end border-t border-slate-200">
              <button
                onClick={() => setSelectedSurvey(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Popup Modal */}
      {modalConfig && modalConfig.show && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-5 animate-scaleUp">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xs ${
              modalConfig.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
              modalConfig.type === 'confirm' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
              modalConfig.type === 'warning' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
              modalConfig.type === 'error' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
              'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              {modalConfig.type === 'success' && <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />}
              {modalConfig.type === 'confirm' && <HelpCircle className="w-7 h-7 stroke-[2.5]" />}
              {modalConfig.type === 'warning' && <AlertTriangle className="w-7 h-7 stroke-[2.5]" />}
              {modalConfig.type === 'error' && <XCircle className="w-7 h-7 stroke-[2.5]" />}
              {modalConfig.type === 'info' && <Info className="w-7 h-7 stroke-[2.5]" />}
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-800 text-base md:text-lg leading-tight">{modalConfig.title}</h3>
              <p className="text-slate-500 text-xs md:text-sm leading-relaxed px-1">{modalConfig.message}</p>
            </div>

            <div className="flex gap-2.5 w-full pt-3 border-t border-slate-100">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setModalConfig(null);
                      if (modalConfig.onCancel) modalConfig.onCancel();
                    }}
                    className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-650 text-xs font-semibold transition active:scale-95"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalConfig(null);
                      if (modalConfig.onConfirm) modalConfig.onConfirm();
                    }}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-sm active:scale-95"
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
                  className={`w-full py-2 px-4 text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95 ${
                    modalConfig.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    modalConfig.type === 'error' ? 'bg-rose-600 hover:bg-rose-700' :
                    modalConfig.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' :
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

      {/* Photo Gallery Modal */}
      {gallerySurvey && (
        <GalleryModal
          survey={gallerySurvey}
          isOpen={!!gallerySurvey}
          onClose={() => setGallerySurvey(null)}
          onSurveyUpdated={(updated) => {
            setSurveys(prev => prev.map(s => s.id === updated.id ? updated : s));
            setGallerySurvey(updated);
          }}
        />
      )}
    </div>
  );

  function renderStatusBadge(status: string) {
    switch (status) {
      case 'completed':
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-100">
            <CheckCircle2 className="w-3 h-3" />
            สร้างเอกสารสำเร็จ
          </span>
        );
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1 bg-[#4f46e5]/10 text-[#4338ca] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#4f46e5]/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            กำลังสร้าง Docs/PDF
          </span>
        );
      case 'pending_sync':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-100">
            <RefreshCw className="w-3 h-3 animate-pulse" />
            ค้างซิงค์ (ออฟไลน์)
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-105 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
            <FileText className="w-3 h-3" />
            แบบร่างในเครื่อง
          </span>
        );
    }
  }
}

const formatDriveEmbedUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('docs.google.com/uc?export=view&id=')) {
    const match = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  return url;
};

function generateTextSummary(survey: any) {
  let text = '';
  text += `==========================================\n`;
  text += `   รายงานสรุปแบบสำรวจความต้องการหน้างาน (SWS)\n`;
  text += `==========================================\n\n`;
  
  text += `[ข้อมูลโครงการทั่วไป]\n`;
  text += `- โครงการ: ${survey.projectName || '-'}\n`;
  text += `- ลูกค้า: ${survey.customerName || '-'}\n`;
  text += `- ผู้สำรวจ: ${survey.salesPersonName || '-'}\n`;
  text += `- งบประมาณโครงการประมาณการ: ${survey.budget ? Number(survey.budget).toLocaleString() + ' บาท' : '-'}\n`;
  text += `- วันที่แจ้งสเปค: ${survey.requestDate || '-'}\n`;
  text += `- วันที่สำรวจหน้างาน: ${survey.surveyDate || '-'}\n`;
  text += `- เสนอราคาภายใน: ${survey.quotationDeadline || '-'}\n`;
  text += `- ผู้ประสานงานหน้างาน: ${survey.contactName || '-'} (โทร: ${survey.contactPhone || '-'})\n`;
  if (survey.locationAddress) {
    text += `- สถานที่ปักหมุด: ${survey.locationAddress} (พิกัด Lat/Lng: ${survey.locationLat?.toFixed(5)}, ${survey.locationLng?.toFixed(5)})\n`;
  }
  text += `- รูปอาคาร/หน้าห้องที่แนบ: ${(survey.existingImages || []).length} รูป\n\n`;

  (survey.roomsData || []).forEach((room: any, idx: number) => {
    text += `[จุดที่ ${idx + 1}: ${room.name}]\n`;
    text += `- ชนิดห้อง: ${room.roomType || '-'} (ชั้น ${room.floor || '-'})\n`;
    text += `- มิติห้อง (กว้าง x ลึก x สูง): ${room.roomWidth || '-'} x ${room.roomLength || '-'} x ${room.roomHeight || '-'} เมตร\n`;
    text += `- การติดตั้งจอหลัก: รูปแบบการยึด ${room.installationType || '-'}, พื้นผิวผนัง ${room.surfaceType || '-'}, ผู้เตรียมโครงสร้าง ${room.structureResponsibility || '-'}\n`;
    text += `- ระบบสายและเมนไฟ: ระยะจอไปห้องควบคุม ${room.distanceToControlRoom || '-'} เมตร, ผู้เดินสายสัญญาณ ${room.cablingResponsibility || '-'}, ผู้เตรียมไฟเมน ${room.mainPowerResponsibility || '-'}\n`;
    text += `- ตู้แร็คระบบ: ตำแหน่งวาง ${room.rackLocation || '-'}, ผู้เตรียมตู้ ${room.rackResponsibility || '-'}, ผู้จ่ายไฟแร็ค ${room.rackPowerSource || '-'}\n`;
    text += `- Wall Plate: ชนิด ${room.wallPlateType || '-'}, การเดินสาย ${room.wallPlateWiring || '-'}, ตำแหน่ง ${room.wallPlateLocation || '-'}\n`;
    
    text += `- ระบบภาพ (Visual Systems):\n`;
    if (room.ledWidth && room.ledHeight) {
      text += `  * จอ LED หลัก: ขนาด ${room.ledWidth} x ${room.ledHeight} เมตร (Pixel Pitch: ${room.ledPixelPitch || '-'} | ยี่ห้อ: ${room.ledModelName || '-'} | ทรงจอ: ${room.ledType || '-'} | substrate: ${room.ledSubstrate || '-'} | ลักษณะงาน: ${room.ledApplication || '-'})\n`;
    } else {
      text += `  * จอ LED หลัก: ไม่ได้ระบุความต้องการ\n`;
    }
    const portsList = (room.inputPorts || []).map((p: any) => `${p.portType} x ${p.portQty}`).join(', ');
    text += `  * พอร์ตเชื่อมต่อจอหลัก: ${portsList || 'ไม่มีข้อมูล'}\n`;
    
    if (room.visualOthersEnabled) {
      if (room.visualOthersEnabled.interactive) {
        text += `  * Interactive Board: ขนาด ${room.interactiveSize || '-'} นิ้ว x ${room.interactiveQty || 0} เครื่อง (ยี่ห้อ: ${room.interactiveBrand || '-'})\n`;
      }
      if (room.visualOthersEnabled.projector) {
        text += `  * เครื่องฉาย Projector: ความสว่าง ${room.projectorLumen || '-'} lumens x ${room.projectorQty || 0} เครื่อง (ยี่ห้อ: ${room.projectorBrand || '-'})\n`;
      }
      if (room.visualOthersEnabled.sideDisplay) {
        text += `  * จอเสริมกลาง/ข้างห้อง: ประเภท ${room.sideDisplayType || '-'} x ${room.sideDisplayQty || 0} จอ (แสดงผล: ${room.sideDisplayDiffImage || '-'})\n`;
      }
      if (room.visualOthersEnabled.ptzCamera) {
        text += `  * กล้อง PTZ Camera: จำนวน ${room.ptzQty || 0} ตัว (ยี่ห้อ: ${room.ptzBrand || '-'} | Auto-Tracking: ${room.ptzTracking || '-'})\n`;
      }
      if (room.visualOthersEnabled.signage) {
        text += `  * ป้าย Digital Signage: ขนาด ${room.signageSize || '-'} นิ้ว x ${room.signageQty || 0} เครื่อง (ยี่ห้อ: ${room.signageBrand || '-'})\n`;
      }
    }
    if (room.visualNote) {
      text += `  * หมายเหตุภาพเพิ่มเติม: ${room.visualNote}\n`;
    }
    
    text += `- ระบบเสียง (Audio Systems):\n`;
    if (room.micWiredQty) text += `  * ไมค์สาย: ${room.micWiredQty} ตัว (ยี่ห้อ: ${room.micWiredBrand || '-'})\n`;
    if (room.micWirelessHandQty) text += `  * ไมค์ถือไร้สาย: ${room.micWirelessHandQty} ตัว (ยี่ห้อ: ${room.micWirelessHandBrand || '-'})\n`;
    if (room.micWirelessLapelQty) text += `  * ไมค์หนีบปกเสื้อ: ${room.micWirelessLapelQty} ตัว (ยี่ห้อ: ${room.micWirelessLapelBrand || '-'})\n`;
    text += `  * รูปแบบลำโพง: ${room.speakerType || '-'} (ยี่ห้อ: ${room.speakerBrand || '-'})\n`;
    if (room.allInOneQty) {
      text += `  * ชุด All-in-one Video Conference: ${room.allInOneQty} ชุด (แชร์แบบ: ${room.allInOneWirelessType || '-'} | ยี่ห้อ: ${room.allInOneBrand || '-'} | Platform: ${room.vdoConferencePlatform || '-'})\n`;
    }
    if (room.tabletopChairmanQty || room.tabletopDelegateQty) {
      text += `  * ชุดไมค์ประชุมตั้งโต๊ะ: Chairman ${room.tabletopChairmanQty || 0} ตัว / Delegate ${room.tabletopDelegateQty || 0} ตัว (ระบบ: ${room.tabletopType || '-'} | ยี่ห้อ: ${room.tabletopBrand || '-'} | ฟีเจอร์พิเศษ: ${room.tabletopSpecialFeatures || '-'})\n`;
    }
    if (room.audioNote) {
      text += `  * หมายเหตุเสียงเพิ่มเติม: ${room.audioNote}\n`;
    }

    text += `- ระบบควบคุมกลาง & เครือข่าย (Control & Network):\n`;
    text += `  * ระบบควบคุม: คุมระบบ ${room.controlType || '-'} (สั่งการผ่าน: ${room.controlInterface || '-'} | iPad: ${room.controlIpadStatus || '-'} | หมายเหตุ: ${room.controlNote || '-'})\n`;
    text += `  * IT Network: เชื่อมต่อด้วย ${room.networkInterface || '-'} (IP Allocation: ${room.networkIPRequirement || '-'} | ผู้รับผิดชอบเตรียมสายเน็ต: ${room.networkResponsibility || '-'} | หมายเหตุ: ${room.networkNote || '-'})\n`;
    text += `- แนบรูปภาพประกอบห้องนี้: ${(room.images || []).length} รูป\n\n`;
  });

  text += `==========================================\n`;
  text += `               สิ้นสุดรายงานสรุป\n`;
  text += `==========================================\n`;
  return text;
}
