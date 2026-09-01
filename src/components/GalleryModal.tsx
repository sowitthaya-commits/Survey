'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Images, FolderOpen, Upload, ChevronLeft, ChevronRight, 
  Download, Eye, Edit3, Image as ImageIcon, Loader2, CheckCircle2, 
  Layers, Tag, ZoomIn, ZoomOut, RotateCw, Plus, Trash2
} from 'lucide-react';
import { offlineDb, type RoomImage } from '@/lib/offlineDb';

interface GalleryModalProps {
  survey: any;
  isOpen: boolean;
  onClose: () => void;
  onSurveyUpdated?: (updatedSurvey: any) => void;
}

interface FlattenedImage {
  id: string;
  category: string; // 'building' | 'room' | 'additional'
  categoryName: string; // e.g. 'อาคาร / หน้างาน', 'ห้องประชุม 1'
  stepTitle?: string; // e.g. 'สภาพห้อง', 'ระบบภาพ', 'ระบบเสียง', 'ระบบควบคุม'
  originalUrl: string;
  annotatedUrl?: string;
  description?: string;
  createdAt?: string;
  rawImageObj: RoomImage;
  roomIndex?: number;
}

// Client-side canvas compression helper to prevent 413 payload limits
function compressImageForGallery(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function GalleryModal({ survey, isOpen, onClose, onSurveyUpdated }: GalleryModalProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showAnnotated, setShowAnnotated] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Extract and flatten all images across building, rooms, and general attachments
  const allImages: FlattenedImage[] = React.useMemo(() => {
    if (!survey) return [];
    const list: FlattenedImage[] = [];

    // 1. Existing / Building images
    if (Array.isArray(survey.existingImages)) {
      survey.existingImages.forEach((img: RoomImage, idx: number) => {
        const orig = img.originalImage || img.annotatedImage;
        if (orig) {
          list.push({
            id: img.id || `building_${idx}`,
            category: 'building',
            categoryName: 'อาคาร / หน้างาน',
            stepTitle: 'สภาพแวดล้อมหน้างาน',
            originalUrl: orig,
            annotatedUrl: img.annotatedImage && img.annotatedImage !== orig ? img.annotatedImage : undefined,
            description: img.description || '',
            createdAt: img.createdAt,
            rawImageObj: img,
          });
        }
      });
    }

    // 2. Rooms images
    if (Array.isArray(survey.roomsData)) {
      survey.roomsData.forEach((room: any, rIdx: number) => {
        const rName = room.name || `ห้อง ${rIdx + 1}`;
        if (Array.isArray(room.images)) {
          room.images.forEach((img: RoomImage, imgIdx: number) => {
            const orig = img.originalImage || img.annotatedImage;
            if (orig) {
              let stepTitle = 'รูปภาพห้อง';
              if (img.step === 1) stepTitle = 'สภาพอาคาร/หน้าห้อง';
              else if (img.step === 2) stepTitle = 'ขนาดและสภาพห้อง';
              else if (img.step === 3) stepTitle = 'ระบบภาพ / จอแสดงผล';
              else if (img.step === 4) stepTitle = 'ระบบเสียง / ไมโครโฟน';
              else if (img.step === 5) stepTitle = 'ระบบควบคุมและเน็ตเวิร์ก';

              list.push({
                id: img.id || `room_${rIdx}_${imgIdx}`,
                category: `room_${rIdx}`,
                categoryName: rName,
                stepTitle: stepTitle,
                originalUrl: orig,
                annotatedUrl: img.annotatedImage && img.annotatedImage !== orig ? img.annotatedImage : undefined,
                description: img.description || '',
                createdAt: img.createdAt,
                rawImageObj: img,
                roomIndex: rIdx,
              });
            }
          });
        }
      });
    }

    return list;
  }, [survey]);

  // Extract unique category tabs
  const categoryTabs = React.useMemo(() => {
    const tabs = [{ id: 'all', label: 'ทั้งหมด', count: allImages.length }];
    
    // Building tab
    const buildingCount = allImages.filter(img => img.category === 'building').length;
    if (buildingCount > 0) {
      tabs.push({ id: 'building', label: 'อาคาร / หน้างาน', count: buildingCount });
    }

    // Room tabs
    if (Array.isArray(survey?.roomsData)) {
      survey.roomsData.forEach((room: any, rIdx: number) => {
        const rId = `room_${rIdx}`;
        const count = allImages.filter(img => img.category === rId).length;
        tabs.push({
          id: rId,
          label: room.name || `ห้อง ${rIdx + 1}`,
          count: count
        });
      });
    }

    return tabs;
  }, [allImages, survey]);

  // Filtered image list based on active tab
  const filteredImages = React.useMemo(() => {
    if (activeTab === 'all') return allImages;
    return allImages.filter(img => img.category === activeTab);
  }, [allImages, activeTab]);

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredImages]);

  const handleNextImage = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % filteredImages.length);
  };

  const handlePrevImage = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + filteredImages.length) % filteredImages.length);
  };

  // Google Drive folder URL for this specific project
  const googleDriveFolderUrl = React.useMemo(() => {
    if (survey?.folderUrl) return survey.folderUrl;
    if (survey?.imagesFolderUrl) return survey.imagesFolderUrl;
    // Direct link to SWS Survey Images root folder
    return 'https://drive.google.com/drive/folders/133P6jxYlZ0ixXPhuYwFQ8tjbNCATEnFT';
  }, [survey]);

  // Handle upload additional photos
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadSuccessMsg('');

    try {
      const fileArray = Array.from(files);
      const compressedList = await Promise.all(fileArray.map(f => compressImageForGallery(f)));

      const now = new Date().toISOString();
      const newRoomImages: RoomImage[] = compressedList.map((base64, i) => ({
        id: `gallery_upload_${Date.now()}_${i}`,
        step: 1,
        originalImage: base64,
        annotatedImage: base64,
        description: 'รูปภาพเพิ่มเติมจาก Gallery',
        createdAt: now,
      }));

      // Update existingImages array in survey
      const updatedExistingImages = [...(survey.existingImages || []), ...newRoomImages];
      const updatedSurvey = {
        ...survey,
        existingImages: updatedExistingImages,
        updatedAt: now,
      };

      // 1. Save to local Dexie IndexedDB
      try {
        await offlineDb.draftSurveys.put(updatedSurvey);
      } catch (dbErr) {
        console.warn('Could not save to Dexie:', dbErr);
      }

      // 2. Sync to Backend API if online
      if (navigator.onLine) {
        try {
          await fetch('/api/surveys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: survey.id,
              projectName: survey.projectName,
              customerName: survey.customerName,
              existingImages: updatedExistingImages,
              roomsData: survey.roomsData,
              status: survey.status,
              salesPersonId: survey.salesPersonId,
            })
          });
        } catch (apiErr) {
          console.warn('API sync failed, saved locally:', apiErr);
        }
      }

      if (onSurveyUpdated) {
        onSurveyUpdated(updatedSurvey);
      }

      setUploadSuccessMsg(`เพิ่มรูปภาพสำเร็จแล้ว ${newRoomImages.length} รูป`);
      setTimeout(() => setUploadSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle delete image
  const handleDeleteImage = async (img: FlattenedImage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`คุณต้องการลบรูปภาพนี้ (${img.stepTitle || img.categoryName}) ออกจากโครงการใช่หรือไม่?`)) return;

    try {
      const now = new Date().toISOString();
      let updatedExistingImages = [...(survey.existingImages || [])];
      let updatedRoomsData = Array.isArray(survey.roomsData) ? JSON.parse(JSON.stringify(survey.roomsData)) : [];

      if (img.category === 'building') {
        updatedExistingImages = updatedExistingImages.filter(item => item.id !== img.rawImageObj.id && item.originalImage !== img.originalUrl);
      } else if (img.category.startsWith('room_')) {
        const rIdx = img.roomIndex !== undefined ? img.roomIndex : parseInt(img.category.replace('room_', ''));
        if (updatedRoomsData[rIdx] && Array.isArray(updatedRoomsData[rIdx].images)) {
          updatedRoomsData[rIdx].images = updatedRoomsData[rIdx].images.filter(
            (item: RoomImage) => item.id !== img.rawImageObj.id && item.originalImage !== img.originalUrl
          );
        }
      }

      const updatedSurvey = {
        ...survey,
        existingImages: updatedExistingImages,
        roomsData: updatedRoomsData,
        updatedAt: now,
      };

      // 1. Delete from IndexedDB
      try {
        await offlineDb.draftSurveys.put(updatedSurvey);
      } catch (dbErr) {
        console.warn('Could not update Dexie on delete:', dbErr);
      }

      // 2. Delete from Google Drive if URL is online/cloud
      if (img.originalUrl && !img.originalUrl.startsWith('data:image')) {
        fetch('/api/surveys/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl: img.originalUrl })
        }).catch(err => console.warn('Drive cleanup failed for orig:', err));
      }
      if (img.annotatedUrl && !img.annotatedUrl.startsWith('data:image') && img.annotatedUrl !== img.originalUrl) {
        fetch('/api/surveys/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUrl: img.annotatedUrl })
        }).catch(err => console.warn('Drive cleanup failed for anno:', err));
      }

      // 3. Sync updated survey to backend
      if (navigator.onLine) {
        try {
          await fetch('/api/surveys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: survey.id,
              projectName: survey.projectName,
              customerName: survey.customerName,
              existingImages: updatedExistingImages,
              roomsData: updatedRoomsData,
              status: survey.status,
              salesPersonId: survey.salesPersonId,
            })
          });
        } catch (apiErr) {
          console.warn('API sync failed on delete:', apiErr);
        }
      }

      if (onSurveyUpdated) {
        onSurveyUpdated(updatedSurvey);
      }

      if (lightboxIndex !== null) {
        setLightboxIndex(null);
      }

      setUploadSuccessMsg('ลบรูปภาพออกจากโครงการเรียบร้อยแล้ว');
      setTimeout(() => setUploadSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบรูปภาพ: ' + (err.message || 'โปรดลองใหม่อีกครั้ง'));
    }
  };

  if (!isOpen || !survey) return null;

  const currentLightboxImg = lightboxIndex !== null ? filteredImages[lightboxIndex] : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 transition-all duration-300">
      <div className="bg-white rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp">
        
        {/* Header */}
        <div className="shrink-0 bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shadow-xs shrink-0">
              <Images className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-800 text-base md:text-lg truncate flex items-center gap-2">
                คลังภาพถ่ายหน้างาน (Photo Gallery)
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-semibold border border-violet-100">
                  {allImages.length} รูป
                </span>
              </h2>
              <p className="text-slate-500 text-xs truncate">
                โครงการ: <span className="font-semibold text-slate-700">{survey.projectName}</span> • ลูกค้า: <span className="font-semibold text-slate-700">{survey.customerName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Google Drive Link */}
            <a
              href={googleDriveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-250 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs active:scale-95"
              title="เปิดโฟลเดอร์รูปภาพใน Google Drive"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">เปิดโฟลเดอร์</span> Google Drive
            </a>

            {/* Upload More Photos */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm active:scale-95"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  กำลังเพิ่มรูป...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มรูปภาพ
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Upload Success Alert */}
        {uploadSuccessMsg && (
          <div className="bg-emerald-50 text-emerald-700 px-5 py-2 text-xs font-medium flex items-center gap-2 border-b border-emerald-100 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {uploadSuccessMsg}
          </div>
        )}

        {/* Category Tabs */}
        <div className="shrink-0 bg-white px-5 pt-3 pb-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-violet-800 text-violet-100' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Photo Grid Gallery Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredImages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-300">
                <ImageIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-700 mb-1">ยังไม่มีรูปภาพในหมวดหมู่นี้</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                คุณสามารถกดปุ่ม "เพิ่มรูปภาพ" ด้านบน เพื่อถ่ายภาพหรืออัปโหลดรูปภาพหน้างานเพิ่มเติมได้ตลอดเวลา
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                อัปโหลดรูปภาพใหม่
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
              {filteredImages.map((img, idx) => {
                const displayUrl = img.annotatedUrl || img.originalUrl;
                return (
                  <div
                    key={img.id}
                    onClick={() => {
                      setLightboxIndex(idx);
                      setShowAnnotated(!!img.annotatedUrl);
                    }}
                    className="group relative bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col"
                  >
                    {/* Image Aspect Box */}
                    <div className="aspect-4/3 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
                      <img
                        src={displayUrl}
                        alt={img.description || img.stepTitle || 'Survey image'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="p-2 bg-white/90 rounded-full text-slate-800 shadow-md transform translate-y-2 group-hover:translate-y-0 transition-transform">
                          <Eye className="w-4 h-4" />
                        </span>
                      </div>

                      {/* Delete Button on Hover */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteImage(img, e)}
                        className="absolute top-2 left-2 p-1.5 bg-slate-900/80 hover:bg-rose-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xs z-10"
                        title="ลบรูปภาพนี้ออกจากโครงการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Annotated Badge */}
                      {img.annotatedUrl && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-indigo-600/90 backdrop-blur-xs text-white text-[10px] font-bold rounded-md flex items-center gap-1 shadow-xs">
                          <Edit3 className="w-2.5 h-2.5" />
                          มาร์กจุด
                        </span>
                      )}

                      {/* Category Badge */}
                      <span className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-medium rounded-md truncate max-w-[80%]">
                        {img.categoryName}
                      </span>
                    </div>

                    {/* Metadata Subtitle */}
                    <div className="p-2 bg-white border-t border-slate-100 flex flex-col justify-between flex-1">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">
                        {img.stepTitle || img.categoryName}
                      </p>
                      {img.description ? (
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                          {img.description}
                        </p>
                      ) : (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {img.createdAt ? new Date(img.createdAt).toLocaleDateString('th-TH') : 'ภาพหน้างาน'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            แสดงผล <strong className="text-slate-700">{filteredImages.length}</strong> จากทั้งหมด {allImages.length} รูป
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl transition"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Lightbox Fullscreen Image Viewer */}
      {currentLightboxImg && lightboxIndex !== null && (
        <div className="fixed inset-0 z-60 bg-black/95 backdrop-blur-md flex flex-col select-none animate-fadeIn">
          
          {/* Lightbox Topbar */}
          <div className="px-4 py-3 flex items-center justify-between bg-black/40 text-white z-10 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-medium">
                {lightboxIndex + 1} / {filteredImages.length}
              </span>
              <span className="text-sm font-semibold truncate">
                {currentLightboxImg.categoryName} • {currentLightboxImg.stepTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Original vs Annotated if both exist */}
              {currentLightboxImg.annotatedUrl && (
                <button
                  type="button"
                  onClick={() => setShowAnnotated(!showAnnotated)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    showAnnotated 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {showAnnotated ? 'แสดงรูปที่วาดบอกระยะ' : 'แสดงรูปต้นฉบับ'}
                </button>
              )}

              {/* Direct Download Button */}
              <a
                href={showAnnotated && currentLightboxImg.annotatedUrl ? currentLightboxImg.annotatedUrl : currentLightboxImg.originalUrl}
                download={`survey_image_${currentLightboxImg.id}.jpg`}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                title="ดาวน์โหลดรูปภาพนี้"
              >
                <Download className="w-4 h-4" />
              </a>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => handleDeleteImage(currentLightboxImg)}
                className="p-2 bg-rose-600/80 hover:bg-rose-700 text-white rounded-lg transition"
                title="ลบรูปภาพนี้ออกจากโครงการ"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close Lightbox */}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                title="ปิดตัวดูภาพ (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image View */}
          <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden">
            {/* Previous Button */}
            {filteredImages.length > 1 && (
              <button
                type="button"
                onClick={handlePrevImage}
                className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-xs transition active:scale-95"
                title="รูปก่อนหน้า (ลูกศรซ้าย)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Main Image */}
            <img
              src={showAnnotated && currentLightboxImg.annotatedUrl ? currentLightboxImg.annotatedUrl : currentLightboxImg.originalUrl}
              alt={currentLightboxImg.description || 'Survey enlarged view'}
              className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-transform duration-200"
            />

            {/* Next Button */}
            {filteredImages.length > 1 && (
              <button
                type="button"
                onClick={handleNextImage}
                className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-xs transition active:scale-95"
                title="รูปถัดไป (ลูกศรขวา)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Lightbox Caption Footer */}
          <div className="px-4 py-2.5 bg-black/50 text-white/90 text-center text-xs border-t border-white/10">
            {currentLightboxImg.description ? (
              <p className="font-medium text-slate-200">{currentLightboxImg.description}</p>
            ) : (
              <p className="text-slate-400">
                {currentLightboxImg.categoryName} — {currentLightboxImg.stepTitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
