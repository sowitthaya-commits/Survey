'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { offlineDb, type DraftSurvey, type RoomData, type RoomImage, type InputPortItem } from '@/lib/offlineDb';
import { syncMasterDataCache } from '@/lib/offlineSyncHelper';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { uploadSurveyBase64Images } from '@/lib/uploadHelper';
import ImageAnnotation from '@/components/ImageAnnotation';
import { 
  ArrowLeft, ArrowRight, Save, Image as ImageIcon, Sparkles, Check, 
  Wifi, WifiOff, AlertTriangle, Trash2, Edit3, Loader2, CheckCircle, X,
  Layers, Volume2, Monitor, Settings, Info, MapPin, Eye, Plus, Copy, Camera, Network, Download,
  HelpCircle, CheckCircle2, XCircle
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface SalesPersonOpt {
  id: number;
  name: string;
}

interface DisplayModelOpt {
  id: number;
  modelName: string;
  brand: string;
}

interface BrandSelectorProps {
  value: string;
  setValue: (v: string) => void;
  brandOptions: string[];
}

function BrandSelector({ value, setValue, brandOptions }: BrandSelectorProps) {
  const isCustom = value && !brandOptions.includes(value) && value !== 'อื่นๆ';
  const selectVal = isCustom ? 'อื่นๆ' : value;
  const [customText, setCustomText] = useState(isCustom ? value : '');

  useEffect(() => {
    if (isCustom) {
      setCustomText(value);
    }
  }, [value, isCustom]);

  return (
    <div className="space-y-1 w-full">
      <select
        value={selectVal}
        onChange={(e) => {
          const val = e.target.value;
          if (val === 'อื่นๆ') {
            setValue(customText || 'ระบุแบรนด์');
          } else {
            setValue(val);
          }
        }}
        className="w-full px-2 py-1.5 border border-slate-205 bg-white rounded text-xs font-semibold"
      >
        <option value="">เลือกแบรนด์</option>
        {brandOptions.filter(b => b !== 'อื่นๆ').map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
        <option value="อื่นๆ">อื่นๆ</option>
      </select>
      {selectVal === 'อื่นๆ' && (
        <input
          type="text"
          value={customText}
          onChange={(e) => {
            const text = e.target.value;
            setCustomText(text);
            setValue(text);
          }}
          placeholder="ระบุชื่อยี่ห้อ..."
          className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-55"
        />
      )}
    </div>
  );
}

function SurveyWizardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id');

  const { isOnline, syncError, syncPendingSurveys } = useOfflineSync();

  const [surveyId, setSurveyId] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // Master Data & DB Cache options
  const [salesPersons, setSalesPersons] = useState<SalesPersonOpt[]>([]);
  const [displayModels, setDisplayModels] = useState<DisplayModelOpt[]>([]);
  const [dbOptions, setDbOptions] = useState<{ id: number; category: string; value: string }[]>([]);

  // Leaflet map state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationLat, setLocationLat] = useState<number>(13.7563); // BKK defaults
  const [locationLng, setLocationLng] = useState<number>(100.5018);

  // --- Step 1: Project Info & Existing Customer Systems ---
  const [projectName, setProjectName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [salesPersonId, setSalesPersonId] = useState<number | undefined>(undefined);
  const [salesPersonName, setSalesPersonName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [quotationDeadline, setQuotationDeadline] = useState('');
  const [budget, setBudget] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [surveyDate, setSurveyDate] = useState('');
  
  // Existing equipment photos
  const [existingImages, setExistingImages] = useState<RoomImage[]>([]);

  // --- Multi-Room / Multi-Display List ---
  const [rooms, setRooms] = useState<RoomData[]>([
    {
      id: uuidv4(),
      name: 'ห้อง/จุดติดตั้งที่ 1',
      images: [],
      inputPorts: [
        { id: uuidv4(), portType: 'HDMI', portQty: '' as any },
        { id: uuidv4(), portType: 'LAN', portQty: '' as any }
      ],
      visualOthersEnabled: {
        interactive: false,
        projector: false,
        sideDisplay: false,
        ptzCamera: false,
        signage: false
      }
    }
  ]);
  const [activeRoomIndex, setActiveRoomIndex] = useState<number>(0);

  // Image annotation modal state
  const [annotatingRoomIndex, setAnnotatingRoomIndex] = useState<number | null>(null);
  const [annotatingImageId, setAnnotatingImageId] = useState<string | null>(null);
  const [annotatingImageSrc, setAnnotatingImageSrc] = useState<string | null>(null);

  // Helper to extract options dynamically from dbOptions cache, falling back to defaults
  const getOptionsForCategory = (category: string, defaultList: string[], includeOther: boolean = true) => {
    const filtered = dbOptions.filter(o => o.category === category).map(o => o.value);
    const list = filtered.length > 0 ? filtered : defaultList;
    return includeOther ? [...list, 'อื่นๆ'] : list;
  };

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if ((window as any).L) {
      setMapLoaded(true);
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setMapLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Initialize Map Picker ONLY when mounting step 1
  useEffect(() => {
    if (!mapLoaded || currentStep !== 1 || typeof window === 'undefined') return;
    const L = (window as any).L;
    if (!L) return;

    const mapContainer = document.getElementById('map-picker');
    if (!mapContainer) return;

    if ((mapContainer as any)._leaflet_id) {
      const existingMap = (mapContainer as any)._mapInstance;
      const existingMarker = (mapContainer as any)._markerInstance;
      if (existingMap && existingMarker) {
        existingMap.invalidateSize();
      }
      return;
    }

    // Set map viewpoint based on current state (loads edited coordinate correctly)
    const map = L.map('map-picker').setView([locationLat, locationLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const marker = L.marker([locationLat, locationLng], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setLocationLat(pos.lat);
      setLocationLng(pos.lng);
    });

    map.on('click', (e: any) => {
      const pos = e.latlng;
      marker.setLatLng(pos);
      setLocationLat(pos.lat);
      setLocationLng(pos.lng);
    });

    (mapContainer as any)._mapInstance = map;
    (mapContainer as any)._markerInstance = marker;
  }, [mapLoaded, currentStep, loading]);

  // Synchronize Leaflet map and marker position when coordinates change (e.g. after draft loads)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mapContainer = document.getElementById('map-picker');
    if (!mapContainer) return;
    const existingMap = (mapContainer as any)._mapInstance;
    const existingMarker = (mapContainer as any)._markerInstance;
    if (existingMap && existingMarker) {
      const currentLatLng = existingMarker.getLatLng();
      if (currentLatLng.lat !== locationLat || currentLatLng.lng !== locationLng) {
        existingMap.setView([locationLat, locationLng], existingMap.getZoom());
        existingMarker.setLatLng([locationLat, locationLng]);
      }
    }
  }, [locationLat, locationLng]);

  // Load master data on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (navigator.onLine) {
      syncMasterDataCache().then(() => loadMasterData());
    } else {
      loadMasterData();
    }

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user) {
          setCurrentUser(data.user);
          if (!editId) {
            setSalesPersonName(data.user.name);
          }
        }
      })
      .catch(err => console.error('Failed to load session user:', err));
  }, []);

  // Load survey data for Edit or generate new UUID
  useEffect(() => {
    if (editId) {
      setSurveyId(editId);
      loadExistingSurvey(editId);
    } else {
      setSurveyId(uuidv4());
      setLoading(false);
      setSurveyDate(new Date().toISOString().substring(0, 10));
      setRequestDate(new Date().toISOString().substring(0, 10));
      setQuotationDeadline(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10));
    }
  }, [editId]);

  const loadMasterData = async () => {
    try {
      const sales = await offlineDb.salesPersonsCache.toArray();
      const displays = await offlineDb.displayModelsCache.toArray();
      const options = await offlineDb.dropdownOptionsCache.toArray();
      setSalesPersons(sales);
      setDisplayModels(displays);
      setDbOptions(options);
    } catch (e) {
      console.error('Error loading master data:', e);
    }
  };

  const loadExistingSurvey = async (id: string) => {
    setLoading(true);
    try {
      let data: any = null;

      if (navigator.onLine) {
        const res = await fetch(`/api/surveys`);
        if (res.ok) {
          const allSurveys = await res.json();
          data = allSurveys.find((s: any) => s.id === id);
        }
      }

      if (!data) {
        data = await offlineDb.draftSurveys.get(id);
      }

      if (data) {
        setProjectName(data.projectName || '');
        setCustomerName(data.customerName || '');
        setSalesPersonId(data.salesPersonId);
        setSalesPersonName(data.salesPersonName || '');
        setContactName(data.contactName || '');
        setContactPhone(data.contactPhone || '');
        setSurveyDate(data.surveyDate || '');
        setRequestDate(data.requestDate || '');
        
        // Retain saved database coordinates properly
        setLocationLat(data.locationLat || 13.7563);
        setLocationLng(data.locationLng || 100.5018);
        
        setLocationAddress(data.locationAddress || '');
        setQuotationDeadline(data.quotationDeadline || '');
        setBudget(data.budget || '');
        
        setExistingImages(data.existingImages || []);

        if (data.roomsData && Array.isArray(data.roomsData) && data.roomsData.length > 0) {
          setRooms(data.roomsData);
        }
      } else {
        showPopup('error', 'ไม่พบข้อมูล', 'ไม่พบข้อมูลแบบสำรวจที่ต้องการแก้ไข', () => {
          router.push('/');
        });
      }
    } catch (error) {
      console.error('Error loading existing survey:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentGPSLocation = () => {
    if (!navigator.geolocation) {
      showPopup('warning', 'ไม่รองรับ GPS', 'เบราว์เซอร์นี้ไม่รองรับการดึงตำแหน่ง Geolocation');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(pos.coords.latitude);
        setLocationLng(pos.coords.longitude);
        const mapContainer = document.getElementById('map-picker');
        if (mapContainer && (mapContainer as any)._mapInstance && (mapContainer as any)._markerInstance) {
          const map = (mapContainer as any)._mapInstance;
          const marker = (mapContainer as any)._markerInstance;
          map.setView([pos.coords.latitude, pos.coords.longitude], 15);
          marker.setLatLng([pos.coords.latitude, pos.coords.longitude]);
        }
      },
      (err) => {
        showPopup('error', 'ดึง GPS ล้มเหลว', 'ไม่สามารถดึงตำแหน่ง GPS ได้: ' + err.message);
      }
    );
  };

  // --- Multi-Room Tabs Control ---
  const addRoomTab = () => {
    const newRoom: RoomData = {
      id: uuidv4(),
      name: `ห้อง/จุดติดตั้งที่ ${rooms.length + 1}`,
      images: [],
      inputPorts: [
        { id: uuidv4(), portType: 'HDMI', portQty: '' as any },
        { id: uuidv4(), portType: 'LAN', portQty: '' as any }
      ],
      visualOthersEnabled: {
        interactive: false,
        projector: false,
        sideDisplay: false,
        ptzCamera: false,
        signage: false
      }
    };
    setRooms([...rooms, newRoom]);
    setActiveRoomIndex(rooms.length);
  };

  const deleteRoomTab = (indexToDelete: number) => {
    if (rooms.length <= 1) {
      showPopup('warning', 'ไม่สามารถลบได้', 'ต้องมีห้อง/จุดติดตั้งอย่างน้อย 1 จุด');
      return;
    }
    showPopup(
      'confirm',
      'ยืนยันการลบ',
      `ยืนยันที่จะลบข้อมูล "${rooms[indexToDelete].name}" ทั้งหมดใช่หรือไม่?`,
      () => {
        const updated = rooms.filter((_, i) => i !== indexToDelete);
        setRooms(updated);
        setActiveRoomIndex(0);
      }
    );
  };

  const updateRoomField = (roomIndex: number, field: keyof RoomData, value: any) => {
    setRooms(prev => {
      const copy = [...prev];
      copy[roomIndex] = {
        ...copy[roomIndex],
        [field]: value
      };
      return copy;
    });
  };

  const updateVisualOthersEnabled = (roomIndex: number, key: string, val: boolean) => {
    setRooms(prev => {
      const copy = [...prev];
      const current = copy[roomIndex].visualOthersEnabled || {};
      copy[roomIndex] = {
        ...copy[roomIndex],
        visualOthersEnabled: {
          ...current,
          [key]: val
        }
      };
      return copy;
    });
  };

  // --- Input Ports Array Controls ---
  const addInputPort = (roomIndex: number) => {
    setRooms(prev => {
      const copy = [...prev];
      const ports = copy[roomIndex].inputPorts || [];
      copy[roomIndex] = {
        ...copy[roomIndex],
        inputPorts: [...ports, { id: uuidv4(), portType: '', portQty: 1 }]
      };
      return copy;
    });
  };

  const updateInputPort = (roomIndex: number, portId: string, field: keyof InputPortItem, value: any) => {
    setRooms(prev => {
      const copy = [...prev];
      const ports = (copy[roomIndex].inputPorts || []).map(p => {
        if (p.id === portId) {
          return { ...p, [field]: value };
        }
        return p;
      });
      copy[roomIndex] = {
        ...copy[roomIndex],
        inputPorts: ports
      };
      return copy;
    });
  };

  const deleteInputPort = (roomIndex: number, portId: string) => {
    setRooms(prev => {
      const copy = [...prev];
      copy[roomIndex] = {
        ...copy[roomIndex],
        inputPorts: (copy[roomIndex].inputPorts || []).filter(p => p.id !== portId)
      };
      return copy;
    });
  };

  // --- Multiple Image Upload & Annotate ---
  const handleMultipleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, roomIndex: number, step: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const compressLocal = (base64: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxWidth = 1200;
          const maxHeight = 900;
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
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            resolve(base64);
          }
        };
        img.onerror = () => resolve(base64);
      });
    };

    const newImages: RoomImage[] = [];
    const promises = Array.from(files).map(file => {
      return new Promise<void>((resolvePromise) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const rawBase64 = reader.result as string;
            const base64Str = await compressLocal(rawBase64);
            newImages.push({
              id: uuidv4(),
              step,
              originalImage: base64Str,
              annotatedImage: base64Str,
              description: '',
              createdAt: new Date().toISOString()
            });
          } catch (err) {
            console.error('File compression error:', err);
          } finally {
            resolvePromise();
          }
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises).then(() => {
      if (roomIndex === -1) {
        setExistingImages(prev => [...prev, ...newImages]);
      } else {
        setRooms(prev => {
          const copy = [...prev];
          const images = copy[roomIndex].images || [];
          copy[roomIndex] = {
            ...copy[roomIndex],
            images: [...images, ...newImages]
          };
          return copy;
        });
      }
    });
  };

  const deleteRoomImage = (roomIndex: number, imageId: string) => {
    showPopup(
      'confirm',
      'ยืนยันการลบรูปภาพ',
      'ต้องการลบรูปภาพนี้ใช่หรือไม่?',
      () => {
        if (roomIndex === -1) {
          setExistingImages(prev => prev.filter(img => img.id !== imageId));
        } else {
          setRooms(prev => {
            const copy = [...prev];
            const images = copy[roomIndex].images || [];
            copy[roomIndex] = {
              ...copy[roomIndex],
              images: images.filter(img => img.id !== imageId)
            };
            return copy;
          });
        }
      }
    );
  };

  const handleImageDescChange = (roomIndex: number, imageId: string, desc: string) => {
    if (roomIndex === -1) {
      setExistingImages(prev => prev.map(img => {
        if (img.id === imageId) {
          return { ...img, description: desc };
        }
        return img;
      }));
    } else {
      setRooms(prev => {
        const copy = [...prev];
        const images = (copy[roomIndex].images || []).map(img => {
          if (img.id === imageId) {
            return { ...img, description: desc };
          }
          return img;
        });
        copy[roomIndex] = {
          ...copy[roomIndex],
          images
        };
        return copy;
      });
    }
  };

  const startAnnotation = (roomIndex: number, img: RoomImage) => {
    setAnnotatingRoomIndex(roomIndex);
    setAnnotatingImageId(img.id);
    setAnnotatingImageSrc(img.originalImage);
  };

  const saveAnnotationResult = (annotatedImageSrc: string) => {
    if (annotatingRoomIndex === null || annotatingImageId === null) return;

    if (annotatingRoomIndex === -1) {
      setExistingImages(prev => prev.map(img => {
        if (img.id === annotatingImageId) {
          return { ...img, annotatedImage: annotatedImageSrc };
        }
        return img;
      }));
    } else {
      setRooms(prev => {
        const copy = [...prev];
        const images = (copy[annotatingRoomIndex].images || []).map(img => {
          if (img.id === annotatingImageId) {
            return { ...img, annotatedImage: annotatedImageSrc };
          }
          return img;
        });
        copy[annotatingRoomIndex] = {
          ...copy[annotatingRoomIndex],
          images
        };
        return copy;
      });
    }

    setAnnotatingRoomIndex(null);
    setAnnotatingImageId(null);
    setAnnotatingImageSrc(null);
  };

  // Enforce numbers-only 10-digit phone format
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 10) {
      setContactPhone(val);
    }
  };

  // --- Save / Submit logic ---
  const saveToLocalDraft = async (status: 'draft' | 'pending_sync' = 'draft') => {
    const draft: DraftSurvey = {
      id: surveyId,
      projectName,
      customerName,
      salesPersonId,
      salesPersonName: salesPersonName || currentUser?.name || '',
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requestDate,
      locationLat,
      locationLng,
      locationAddress,
      quotationDeadline,
      budget,
      existingImages,
      contactName,
      contactPhone,
      surveyDate,
      roomsData: rooms
    };

    try {
      await offlineDb.draftSurveys.put(draft);
      console.log('Saved draft and nested roomsData locally.');
    } catch (e) {
      console.error('Failed to save local draft:', e);
    }
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!projectName.trim() || !customerName.trim()) {
        showPopup('warning', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อโปรเจกต์และชื่อลูกค้าก่อนไปขั้นตอนถัดไป');
        return;
      }
    }
    saveToLocalDraft('draft');
    setCurrentStep(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Save directly to the local IndexedDB cache as pending_sync
      await saveToLocalDraft('pending_sync');
      
      showPopup(
        'success',
        'บันทึกแบบสำรวจสำเร็จ',
        'บันทึกข้อมูลแบบสำรวจสำเร็จ! ระบบกำลังดำเนินการอัปโหลดรูปภาพและสร้างรายงานบน Google Drive ในเบื้องหลังของหน้าแดชบอร์ดโดยอัตโนมัติ',
        () => {
          router.push('/');
        }
      );
    } catch (error) {
      console.error('Error submitting survey:', error);
      showPopup('error', 'ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกข้อมูลแบบสำรวจลงในเครื่อง');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-[#4f46e5]" />
      </div>
    );
  }

  // Render Tabs for room switching
  const renderRoomTabs = () => (
    <div className="flex flex-wrap border-b border-slate-200 mb-6 bg-slate-50 p-1.5 rounded-xl gap-1">
      {rooms.map((room, idx) => (
        <div key={room.id} className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              saveToLocalDraft('draft');
              setActiveRoomIndex(idx);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeRoomIndex === idx 
                ? 'bg-white text-[#4f46e5] shadow-xs border border-slate-200' 
                : 'text-slate-650 hover:bg-slate-200'
            }`}
          >
            {room.name || `จุดที่ ${idx + 1}`}
          </button>
          {rooms.length > 1 && (
            <button
              type="button"
              onClick={() => deleteRoomTab(idx)}
              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-655 rounded-lg"
              title="ลบจุดติดตั้งนี้"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addRoomTab}
        className="px-3.5 py-2 text-xs font-bold bg-[#4f46e5]/10 text-[#4f46e5] rounded-lg hover:bg-[#4f46e5]/20 flex items-center gap-1 transition"
      >
        <Plus className="w-3.5 h-3.5" />
        เพิ่มห้อง/จุดติดตั้ง
      </button>
    </div>
  );

  const currentRoom = rooms[activeRoomIndex] || rooms[0];

  // Draw list of all annotated images for drawing conversion/viewer
  const allDrawings: { id: string; roomName: string; step: number; annotatedImage: string; description: string }[] = [];
  existingImages.forEach(img => {
    allDrawings.push({ id: img.id, roomName: 'อาคาร / หน้าห้อง', step: 1, annotatedImage: img.annotatedImage, description: img.description || '' });
  });
  rooms.forEach(room => {
    (room.images || []).forEach(img => {
      allDrawings.push({ id: img.id, roomName: room.name || '', step: img.step, annotatedImage: img.annotatedImage, description: img.description || '' });
    });
  });

  return (
    <div className="pb-20 animate-fade-in">
      {/* Stepper progress (6 Steps) */}
      <div className="max-w-4xl mx-auto">
        
        {/* Sync Failure Error Banner */}
        {syncError && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-rose-800 text-xs uppercase tracking-wider">ระบบแจ้งเตือนการส่งซิงค์ข้อมูลล้มเหลว (Sync Warning)</h4>
              <p className="text-xs text-rose-600 mt-1 font-semibold">{syncError}</p>
            </div>
            <button
              type="button"
              onClick={syncPendingSurveys}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
            >
              ลองซิงค์ใหม่
            </button>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-4 right-4 h-0.5 bg-slate-200 top-1/2 -translate-y-1/2 z-0" />
            <div 
              className="absolute left-4 h-0.5 bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] top-1/2 -translate-y-1/2 z-0 transition-all duration-300" 
              style={{ width: `${((currentStep - 1) / 5) * 100}%` }}
            />
            
            {[
              { step: 1, label: 'ข้อมูลทั่วไป' },
              { step: 2, label: 'ขนาด & ติดตั้ง' },
              { step: 3, label: 'ภาพ (Visual)' },
              { step: 4, label: 'เสียง (Audio)' },
              { step: 5, label: 'ควบคุม&เครือข่าย' },
              { step: 6, label: 'สรุปส่งงาน' }
            ].map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => {
                  if (s.step < currentStep || (s.step > currentStep && projectName.trim() && customerName.trim())) {
                    saveToLocalDraft('draft');
                    setCurrentStep(s.step);
                  }
                }}
                className="z-10 flex flex-col items-center focus:outline-none"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition ${
                  currentStep === s.step 
                    ? 'bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] text-white ring-4 ring-[#4f46e5]/20' 
                    : currentStep > s.step 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-white border-2 border-slate-300 text-slate-500 hover:border-slate-400'
                }`}>
                  {currentStep > s.step ? <Check className="w-4 h-4 stroke-[3]" /> : s.step}
                </div>
                <span className="hidden sm:inline text-[11px] font-semibold mt-2 text-slate-500">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Wizard step panels */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
          
          {/* STEP 1: Project Info & Location Address & Building Photos */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  ขั้นตอนที่ 1: ข้อมูลโครงการ & แผนที่ปักหมุด
                </h2>
                <p className="text-xs text-slate-500 mt-1">กรอกข้อมูลผู้ติดต่อ รายละเอียดโปรเจกต์ และปักหมุดตำแหน่งพิกัดหน้างาน</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                    ชื่อโปรเจกต์ (Project Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="เช่น ปรับปรุงห้องบอร์ดบริหารชั้น 8"
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] text-sm font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">
                    ชื่อลูกค้า/หน่วยงาน (Customer Name) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="เช่น บริษัท เอบีซี จำกัด"
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl focus:outline-none focus:ring-2 text-sm font-semibold"
                    required
                  />
                </div>



                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">วันที่แจ้งขอสเปค</label>
                  <input
                    type="date"
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">เสนอราคาลูกค้าภายใน (Deadline)</label>
                  <input
                    type="date"
                    value={quotationDeadline}
                    onChange={(e) => setQuotationDeadline(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">งบประมาณโครงการประมาณการ (บาท)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="เช่น 500000"
                      className="w-full pl-3.5 pr-12 py-2.5 border border-slate-250 rounded-xl text-sm font-bold text-slate-900"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">บาท</span>
                  </div>
                </div>
              </div>

              {/* Map Location Picker */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="block text-xs font-bold text-slate-700 uppercase">ปักหมุดตำแหน่งหน้างานบนแผนที่</span>
                  <button
                    type="button"
                    onClick={getCurrentGPSLocation}
                    className="px-3 py-1.5 bg-[#4f46e5]/10 hover:bg-[#4f46e5]/20 text-[#4f46e5] text-xs font-bold rounded-lg flex items-center gap-1 transition"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    ดึงพิกัดจาก GPS เครื่อง
                  </button>
                </div>
                
                <div 
                  id="map-picker" 
                  className="w-full border border-slate-350 rounded-xl overflow-hidden shadow-xs relative z-0" 
                  style={{ height: '260px' }}
                />
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Latitude</label>
                    <input 
                      type="number" 
                      value={locationLat} 
                      readOnly 
                      className="w-full bg-slate-55 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-slate-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Longitude</label>
                    <input 
                      type="number" 
                      value={locationLng} 
                      readOnly 
                      className="w-full bg-slate-55 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-slate-500" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">รายละเอียดสถานที่เพิ่มเติม (ที่อยู่/อาคาร/ชั้น)</label>
                  <input
                    type="text"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    placeholder="เช่น อาคาร A ชั้น 3 ห้องริมทางเดินด้านซ้าย..."
                    className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Building/Entrance Photos */}
              <div className="pt-6 border-t border-slate-100 bg-[#4f46e5]/10/40 p-5 rounded-2xl space-y-4">
                {renderMultipleImagesSection(1, "รูปอาคาร / รูปหน้าห้อง", "อัปโหลดหรือถ่ายรูปภายนอกอาคาร ทางเข้า หรือหน้าห้อง เพื่อการเข้าสำรวจหรือส่งของ")}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">ชื่อผู้ประสานงานหน้างาน</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="คุณจิราภรณ์ (IT)"
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">เบอร์โทรติดต่อ (10 หลัก)</label>
                  <input
                    type="text"
                    value={contactPhone}
                    onChange={handlePhoneChange}
                    placeholder="เช่น 0812345678"
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm font-semibold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">วันที่สำรวจหน้างาน</label>
                  <input
                    type="date"
                    value={surveyDate}
                    onChange={(e) => setSurveyDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Room Dimensions & Site Survey (Tabbed) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-500" />
                  ขั้นตอนที่ 2: มิติห้อง & ข้อมูลติดตั้งโครงสร้าง (แบ่งตามจุด)
                </h2>
                <p className="text-xs text-slate-500 mt-1">ตั้งค่าชื่อห้อง และระบุขนาดแผงจอ LED แร็ค และเพลทรับส่งแยกเป็นรายแท็บ</p>
              </div>

              {renderRoomTabs()}

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">ชื่อห้อง / จุดติดตั้งที่สำรวจ</label>
                    <input
                      type="text"
                      value={currentRoom.name}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'name', e.target.value)}
                      placeholder="เช่น ห้องประชุมหลักชั้น 5, จุดแสดงสินค้า"
                      className="w-full px-3 py-2 border border-slate-255 rounded-lg text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">กว้าง (เมตร)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentRoom.roomWidth || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'roomWidth', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="เช่น 6.0"
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">ลึก/ยาว (เมตร)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentRoom.roomLength || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'roomLength', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="เช่น 10.0"
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">สูง (เมตร)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentRoom.roomHeight || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'roomHeight', e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="เช่น 3.0"
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">ชั้น (Floor)</label>
                    <input
                      type="text"
                      value={currentRoom.floor || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'floor', e.target.value)}
                      placeholder="เช่น ชั้น 8"
                      className="w-full px-3 py-2 border border-slate-250 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* Structure details */}
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-[#4338ca]">การจัดวางโครงสร้างและผู้เตรียม</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">ลักษณะการติดตั้ง</label>
                      <select
                        value={currentRoom.installationType || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'installationType', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('installation_type', ['ติดผนัง', 'ตั้งจากพื้น', 'แขวนจากเพดาน'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">พื้นผิวติดตั้งผนัง</label>
                      <select
                        value={currentRoom.surfaceType || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'surfaceType', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('surface_type', ['ผนังปูน', 'ผนังเบา', 'ผนัง built-in'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">ผู้จัดเตรียมโครงสร้างยึดจอหลัก</label>
                      <select
                        value={currentRoom.structureResponsibility || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'structureResponsibility', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('responsibility', ['SWS จัดเตรียม', 'ลูกค้าจัดเตรียม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">ผู้รับผิดชอบการเดินสายไฟ/สัญญาณ</label>
                      <select
                        value={currentRoom.cablingResponsibility || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'cablingResponsibility', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('responsibility', ['SWS จัดเตรียม', 'ลูกค้าจัดเตรียม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">ผู้รับผิดชอบระบบเมนไฟฟ้า</label>
                      <select
                        value={currentRoom.mainPowerResponsibility || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'mainPowerResponsibility', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('responsibility', ['SWS จัดเตรียม', 'ลูกค้าจัดเตรียม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">ระยะจอไปห้องควบคุม (ม.)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={currentRoom.distanceToControlRoom || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'distanceToControlRoom', e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="เช่น 15"
                        className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Rack & Plate Section */}
                <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider text-blue-800">ตู้แร็ค (Rack) & เต้ารับสาย (Wall Plate)</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-650 mb-1">ตำแหน่งวางตู้แร็ค</label>
                      <select
                        value={currentRoom.rackLocation || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'rackLocation', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('rack_location', ['ห้องควบคุม', 'ภายในห้องประชุม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-650 mb-1">ผู้รับผิดชอบตู้ Rack</label>
                      <select
                        value={currentRoom.rackResponsibility || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'rackResponsibility', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('responsibility', ['SWS จัดเตรียม', 'ลูกค้าจัดเตรียม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-650 mb-1">ผู้รับผิดชอบจุดจ่ายไฟแร็ค</label>
                      <select
                        value={currentRoom.rackPowerSource || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'rackPowerSource', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('responsibility', ['SWS จัดเตรียม', 'ลูกค้าจัดเตรียม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs text-slate-650 mb-1">ลักษณะการเดินสาย Wall plate</label>
                      <select
                        value={currentRoom.wallPlateWiring || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'wallPlateWiring', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('wall_plate_wiring', ['เดินราง', 'เดินฝัง'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-650 mb-1">ประเภท Wall Plate</label>
                      <select
                        value={currentRoom.wallPlateType || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'wallPlateType', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('wall_plate_type', ['HDMI Wall Plate', 'LAN Wall Plate - Extender', 'LAN Wall Plate - HDBaseT'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gallery Multi images */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                {renderMultipleImagesSection(2, "รูปภาพโครงสร้างห้องจุดที่จะติดตั้ง (อัปโหลดได้หลายภาพ)")}
              </div>
            </div>
          )}

          {/* STEP 3: Visual System (Tabbed) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-blue-500" />
                  ขั้นตอนที่ 3: ระบบภาพ (Visual System)
                </h2>
                <p className="text-sm text-slate-500 mt-1">รายละเอียดสเปคจอหลัก LED และแอปพลิเคชันจอภาพเสริมในแต่ละห้อง</p>
              </div>

              {renderRoomTabs()}

              <div className="space-y-6">
                <div className="border border-slate-150 rounded-xl p-4 bg-[#4f46e5]/10/10 space-y-4">
                  <span className="block text-xs font-bold text-blue-900 uppercase">จอหลัก (LED Display Specs) สำหรับ {currentRoom.name}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">ขนาดกว้าง (เมตร)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRoom.ledWidth || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'ledWidth', e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="เช่น 3.5"
                        className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">ขนาดสูง (เมตร)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRoom.ledHeight || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'ledHeight', e.target.value ? parseFloat(e.target.value) : undefined)}
                        placeholder="เช่น 2.0"
                        className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Pixel Pitch (mm)</label>
                      <input
                        type="text"
                        value={currentRoom.ledPixelPitch || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'ledPixelPitch', e.target.value)}
                        placeholder="เช่น P1.86"
                        className="w-full px-3 py-1.5 border border-slate-250 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">รูปทรงจอ</label>
                      <select
                        value={currentRoom.ledType || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'ledType', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือกรูปทรง --</option>
                        {getOptionsForCategory('led_type', ['Flat', 'Flat curve', 'Real curve'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">เทคโนโลยี</label>
                      <select
                        value={currentRoom.ledSubstrate || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'ledSubstrate', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือกเทคโนโลยี --</option>
                        {getOptionsForCategory('led_substrate', ['SMD', 'GOB', 'COB'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-655 mb-1">ลักษณะการใช้งาน</label>
                      <select
                        value={
                          !currentRoom.ledApplication
                            ? ''
                            : getOptionsForCategory('led_application', ['ห้องประชุม', 'โฆษณา'], false).includes(currentRoom.ledApplication)
                            ? currentRoom.ledApplication
                            : 'อื่นๆ'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'อื่นๆ') {
                            updateRoomField(activeRoomIndex, 'ledApplication', 'อื่นๆ (โปรดระบุ)');
                          } else {
                            updateRoomField(activeRoomIndex, 'ledApplication', val);
                          }
                        }}
                        className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือกการใช้งาน --</option>
                        {getOptionsForCategory('led_application', ['ห้องประชุม', 'โฆษณา'], true).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>

                      {currentRoom.ledApplication &&
                        !getOptionsForCategory('led_application', ['ห้องประชุม', 'โฆษณา'], false).includes(currentRoom.ledApplication) && (
                          <input
                            type="text"
                            value={
                              currentRoom.ledApplication.startsWith('อื่นๆ')
                                ? currentRoom.ledApplication.replace(/^อื่นๆ\s*\(โปรดระบุ\)\s*|^อื่นๆ\s*-?\s*/, '')
                                : currentRoom.ledApplication
                            }
                            onChange={(e) =>
                              updateRoomField(
                                activeRoomIndex,
                                'ledApplication',
                                e.target.value ? `อื่นๆ - ${e.target.value}` : 'อื่นๆ (โปรดระบุ)'
                              )
                            }
                            placeholder="ระบุลักษณะการใช้งานอื่นๆ..."
                            className="w-full mt-1.5 px-3 py-1.5 border border-slate-250 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 bg-white"
                          />
                        )}
                    </div>
                  </div>
                </div>

                {/* Checkbox Reveals for Visual Others */}
                <div className="space-y-4">
                  <span className="block text-xs font-bold text-slate-700 uppercase">ระบบภาพเสริมย่อยอื่นๆ (ติ๊กเลือกเพื่อแสดงข้อมูลที่จะกรอก)</span>
                  
                  <div className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {[
                      { key: 'interactive', label: 'Interactive Board' },
                      { key: 'projector', label: 'Projector' },
                      { key: 'sideDisplay', label: 'จอด้านข้าง/กลางห้องเสริม' },
                      { key: 'ptzCamera', label: 'กล้อง PTZ Camera' },
                      { key: 'signage', label: 'ป้ายประชาสัมพันธ์ (Digital Signage)' }
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!currentRoom.visualOthersEnabled?.[item.key as keyof typeof currentRoom.visualOthersEnabled]}
                          onChange={(e) => updateVisualOthersEnabled(activeRoomIndex, item.key, e.target.checked)}
                          className="w-4 h-4 text-[#4f46e5] rounded"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>

                  {/* Interactive Board Fields */}
                  {currentRoom.visualOthersEnabled?.interactive && (
                    <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-xs">
                      <span className="block text-xs font-bold text-slate-800">กระดาน Interactive Board</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={currentRoom.interactiveSize || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'interactiveSize', e.target.value)}
                          placeholder="ขนาดหน้าจอ (นิ้ว)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="number"
                          value={currentRoom.interactiveQty || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'interactiveQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="จำนวน (เครื่อง)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <BrandSelector
                          value={currentRoom.interactiveBrand || ''}
                          setValue={(v) => updateRoomField(activeRoomIndex, 'interactiveBrand', v)}
                          brandOptions={getOptionsForCategory('interactive_brand', ['Horion', 'Dahua'])}
                        />
                      </div>
                    </div>
                  )}

                  {/* Projector Fields */}
                  {currentRoom.visualOthersEnabled?.projector && (
                    <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-xs">
                      <span className="block text-xs font-bold text-slate-800">เครื่องฉายโปรเจคเตอร์ (Projector)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={currentRoom.projectorLumen || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'projectorLumen', e.target.value)}
                          placeholder="ความสว่าง (Lumens)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="number"
                          value={currentRoom.projectorQty || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'projectorQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="จำนวน (เครื่อง)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <BrandSelector
                          value={currentRoom.projectorBrand || ''}
                          setValue={(v) => updateRoomField(activeRoomIndex, 'projectorBrand', v)}
                          brandOptions={getOptionsForCategory('projector_brand', ['Epson', 'Panasonic', 'Any'])}
                        />
                      </div>
                    </div>
                  )}

                  {/* Side Displays Fields */}
                  {currentRoom.visualOthersEnabled?.sideDisplay && (
                    <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-xs">
                      <span className="block text-xs font-bold text-slate-800">ต้องการจอด้านข้าง / จอกลางห้องเสริม</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <select
                          value={currentRoom.sideDisplayType || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'sideDisplayType', e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 bg-white rounded text-xs"
                        >
                          <option value="">ประเภทจอ</option>
                          {getOptionsForCategory('side_display_type', ['จอ LED', 'จอ TV'], false).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={currentRoom.sideDisplayQty || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'sideDisplayQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="จำนวน (จอ)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <select
                          value={currentRoom.sideDisplayDiffImage || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'sideDisplayDiffImage', e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 bg-white rounded text-xs"
                        >
                          <option value="">รูปแบบภาพแสดงผล</option>
                          {getOptionsForCategory('side_display_diff_image', ['ต้องการภาพต่างกับจอหลัก', 'ภาพเหมือนจอหลัก'], false).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* PTZ Camera Fields */}
                  {currentRoom.visualOthersEnabled?.ptzCamera && (
                    <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-xs">
                      <span className="block text-xs font-bold text-slate-800">กล้องวิดีโอ (PTZ Camera)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="number"
                          value={currentRoom.ptzQty || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'ptzQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="จำนวน (กล้อง)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <select
                          value={currentRoom.ptzTracking || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'ptzTracking', e.target.value)}
                          className="px-3 py-1.5 border border-slate-200 bg-white rounded text-xs font-semibold"
                        >
                          <option value="">ระบบ Tracking</option>
                          {getOptionsForCategory('ptz_tracking', ['ต้องการระบบ Tracking', 'ไม่ต้องการระบบ Tracking'], false).map(opt => (
                            <option key={opt} value={opt === 'ต้องการระบบ Tracking' ? 'ต้องการระบบ Auto-Tracking' : 'ไม่ต้องการ'}>{opt}</option>
                          ))}
                        </select>
                        <BrandSelector
                          value={currentRoom.ptzBrand || ''}
                          setValue={(v) => updateRoomField(activeRoomIndex, 'ptzBrand', v)}
                          brandOptions={getOptionsForCategory('ptz_brand', ['Sony', 'Canon', 'Aver', 'Telycam'])}
                        />
                      </div>
                    </div>
                  )}

                  {/* Digital Signage Fields */}
                  {currentRoom.visualOthersEnabled?.signage && (
                    <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 shadow-xs">
                      <span className="block text-xs font-bold text-slate-800">ป้ายโฆษณาประชาสัมพันธ์ (Digital Signage)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={currentRoom.signageSize || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'signageSize', e.target.value)}
                          placeholder="ขนาด (นิ้ว)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="number"
                          value={currentRoom.signageQty || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'signageQty', e.target.value ? parseInt(e.target.value) : undefined)}
                          placeholder="จำนวน (เครื่อง)"
                          className="px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                        <BrandSelector
                          value={currentRoom.signageBrand || ''}
                          setValue={(v) => updateRoomField(activeRoomIndex, 'signageBrand', v)}
                          brandOptions={getOptionsForCategory('signage_brand', ['LG', 'Samsung', 'Any'])}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Input Ports Addition */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-3">
                    <span className="block text-xs font-bold text-slate-700 uppercase">พอร์ตเชื่อมต่อส่งสัญญาณเข้าจอหลัก (Input Ports)</span>
                    <button
                      type="button"
                      onClick={() => addInputPort(activeRoomIndex)}
                      className="px-3 py-1.5 bg-[#4f46e5]/10 text-blue-650 hover:bg-[#4f46e5]/20 text-xs font-bold rounded-lg flex items-center gap-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + เพิ่มชนิดพอร์ตใหม่
                    </button>
                  </div>

                  {(currentRoom.inputPorts || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">ยังไม่มีการเพิ่มพอร์ตส่งข้อมูลในห้องนี้</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(currentRoom.inputPorts || []).map((port) => (
                        <div key={port.id} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                          <input
                            type="text"
                            value={port.portType}
                            onChange={(e) => updateInputPort(activeRoomIndex, port.id, 'portType', e.target.value)}
                            placeholder="ระบุพอร์ต (เช่น USB-C, DP)"
                            className="flex-1 px-2.5 py-1 border border-slate-200 rounded bg-white text-xs"
                          />
                          <input
                            type="number"
                            value={port.portQty}
                            onChange={(e) => updateInputPort(activeRoomIndex, port.id, 'portQty', e.target.value ? parseInt(e.target.value) : 0)}
                            placeholder="จำนวน"
                            className="w-16 px-2.5 py-1 border border-slate-200 rounded bg-white text-xs text-center font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => deleteInputPort(activeRoomIndex, port.id)}
                            className="p-1.5 text-slate-400 hover:text-red-655 hover:bg-red-50 rounded"
                            title="ลบพอร์ตนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">หมายเหตุของระบบภาพเพิ่มเติม</label>
                  <textarea
                    value={currentRoom.visualNote || ''}
                    onChange={(e) => updateRoomField(activeRoomIndex, 'visualNote', e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติมของระบบภาพ..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-250 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Gallery Multi images */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                {renderMultipleImagesSection(3, "รูปภาพจุดติดตั้งจอหลักและทิศทางสาย (อัปโหลดได้หลายรูป)")}
              </div>
            </div>
          )}

          {/* STEP 4: Audio System (Tabbed) */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-blue-500" />
                  ขั้นตอนที่ 4: ระบบเสียง (Audio System)
                </h2>
                <p className="text-sm text-slate-500 mt-1">ตั้งค่ารูปแบบไมค์ประชุมและแบรนด์เครื่องเสียงแยกเฉพาะแต่ละจุด</p>
              </div>

              {renderRoomTabs()}

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Wired Mic */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-2">
                    <span className="block text-xs font-bold text-slate-700">1) ไมค์สาย (Wired Mic)</span>
                    <input
                      type="number"
                      value={currentRoom.micWiredQty || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'micWiredQty', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="จำนวน (ตัว)"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                    />
                    <BrandSelector
                      value={currentRoom.micWiredBrand || ''}
                      setValue={(v) => updateRoomField(activeRoomIndex, 'micWiredBrand', v)}
                      brandOptions={getOptionsForCategory('mic_brand', ['Soundvision', 'TOA', 'Sennheiser', 'Audio-Technica', 'Shure', 'JTS'])}
                    />
                  </div>

                  {/* Wireless Mics */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-2">
                    <span className="block text-xs font-bold text-slate-700">2) ไมค์ถือไร้สาย (Handheld Wireless)</span>
                    <input
                      type="number"
                      value={currentRoom.micWirelessHandQty || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'micWirelessHandQty', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="จำนวน (ตัว)"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                    />
                    <BrandSelector
                      value={currentRoom.micWirelessHandBrand || ''}
                      setValue={(v) => updateRoomField(activeRoomIndex, 'micWirelessHandBrand', v)}
                      brandOptions={getOptionsForCategory('mic_brand', ['Soundvision', 'TOA', 'Sennheiser', 'Audio-Technica', 'Shure', 'JTS'])}
                    />
                  </div>

                  {/* Wireless Lapel Mics */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-2">
                    <span className="block text-xs font-bold text-slate-700">3) ไมค์หนีบปกเสื้อ (Lavalier Mic)</span>
                    <input
                      type="number"
                      value={currentRoom.micWirelessLapelQty || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'micWirelessLapelQty', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="จำนวน (ตัว)"
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                    />
                    <BrandSelector
                      value={currentRoom.micWirelessLapelBrand || ''}
                      setValue={(v) => updateRoomField(activeRoomIndex, 'micWirelessLapelBrand', v)}
                      brandOptions={getOptionsForCategory('mic_brand', ['Soundvision', 'TOA', 'Sennheiser', 'Audio-Technica', 'Shure', 'JTS'])}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Speaker */}
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 space-y-3">
                    <span className="block text-xs font-bold text-slate-700">ระบบลำโพง (Speakers)</span>
                    <select
                      value={currentRoom.speakerType || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'speakerType', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                    >
                      <option value="">-- เลือกรูปแบบลำโพง --</option>
                      {getOptionsForCategory('speaker_type', ['ตู้ลำโพงหน้า', 'ลำโพงติดเพดาน', 'ลำโพงคู่หน้า+ลำโพงเพดาน'], false).map(opt => (
                        <option key={opt} value={opt}>{opt === 'ตู้ลำโพงหน้า' ? 'ตู้ลำโพงหน้า (Front speakers)' : opt === 'ลำโพงติดเพดาน' ? 'ลำโพงติดเพดาน (Ceiling speakers)' : opt === 'ลำโพงคู่หน้า+ลำโพงเพดาน' ? 'ลำโพงคู่หน้า + ลำโพงเพดาน (ห้องลึก > 15 เมตร)' : opt}</option>
                      ))}
                    </select>
                    <BrandSelector
                      value={currentRoom.speakerBrand || ''}
                      setValue={(v) => updateRoomField(activeRoomIndex, 'speakerBrand', v)}
                      brandOptions={getOptionsForCategory('speaker_brand', ['TOA', 'Yamaha', 'Bose', 'QSC', 'EV'])}
                    />
                  </div>

                  {/* All-in-one Video Conf */}
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/30 space-y-3">
                    <span className="block text-xs font-bold text-slate-700">ชุดประชุมทางไกล All-in-one Video Conference</span>
                    <input
                      type="number"
                      value={currentRoom.allInOneQty || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'allInOneQty', e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="จำนวน (ชุด)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-550 mb-0.5">ระบบเชื่อมต่อ</label>
                        <select
                          value={currentRoom.allInOneWirelessType || ''}
                          onChange={(e) => updateRoomField(activeRoomIndex, 'allInOneWirelessType', e.target.value)}
                          className="w-full px-2 py-1 border border-slate-200 bg-white rounded text-xs font-semibold"
                        >
                          <option value="">เลือก</option>
                          {getOptionsForCategory('byod_type', ['BYOD', 'BYOM'], false).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-550 mb-0.5">ยี่ห้อระบบหลัก</label>
                        <BrandSelector
                          value={currentRoom.allInOneBrand || ''}
                          setValue={(v) => updateRoomField(activeRoomIndex, 'allInOneBrand', v)}
                          brandOptions={getOptionsForCategory('vdo_brand', ['AVer', 'Logitech'])}
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={currentRoom.vdoConferencePlatform || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'vdoConferencePlatform', e.target.value)}
                      placeholder="ระบุ VDO Platform (MS Teams, Zoom)"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>

                {/* Tabletop mic conference */}
                <div className="border border-slate-150 rounded-xl p-4 bg-[#4f46e5]/10/5 space-y-3">
                  <span className="block text-xs font-bold text-slate-800">ชุดประชุมไมค์ตั้งโต๊ะ (Tabletop Conference Mics)</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">ไมค์ประธาน (Chairman Mic) จำนวน</label>
                      <input
                        type="number"
                        value={currentRoom.tabletopChairmanQty || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'tabletopChairmanQty', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="เช่น 1"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">ไมค์ผู้ร่วมประชุม (Delegate Mic) จำนวน</label>
                      <input
                        type="number"
                        value={currentRoom.tabletopDelegateQty || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'tabletopDelegateQty', e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="เช่น 12"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">ประเภทการเชื่อมต่อไมค์</label>
                      <select
                        value={currentRoom.tabletopType || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'tabletopType', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือกระบบเชื่อมต่อ --</option>
                        {getOptionsForCategory('tabletop_type', ['แบบมีสาย', 'แบบไร้สาย'], false).map(opt => (
                          <option key={opt} value={opt}>{opt === 'แบบมีสาย' ? 'มีสาย (Wired)' : opt === 'แบบไร้สาย' ? 'ไร้สาย (Wireless)' : opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">ยี่ห้อระบบชุดประชุม</label>
                      <BrandSelector
                        value={currentRoom.tabletopBrand || ''}
                        setValue={(v) => updateRoomField(activeRoomIndex, 'tabletopBrand', v)}
                        brandOptions={getOptionsForCategory('tabletop_brand', ['TOA', 'Televic', 'Soundvision', 'Bosch', 'Vissonic'])}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-655 mb-1">ฟีเจอร์เด่นพิเศษ (โหวต, หน้าจอสัมผัส, แปลภาษา)</label>
                    <input
                      type="text"
                      value={currentRoom.tabletopSpecialFeatures || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'tabletopSpecialFeatures', e.target.value)}
                      placeholder="เช่น ต้องการระบบบันทึกเสียงในตัว"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-550 mb-1">หมายเหตุของระบบเสียงเพิ่มเติม</label>
                  <textarea
                    value={currentRoom.audioNote || ''}
                    onChange={(e) => updateRoomField(activeRoomIndex, 'audioNote', e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติมของระบบเสียง..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-255 rounded-xl text-xs"
                  />
                </div>
              </div>

              {/* Gallery Multi images */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                {renderMultipleImagesSection(4, "รูปภาพจุดติดตั้งกล้อง/จุดกระจายลำโพง (Audio Photo)")}
              </div>
            </div>
          )}

          {/* STEP 5: Smart Control & Network */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-500" />
                  ขั้นตอนที่ 5: ระบบควบคุมกลางและเครือข่าย (Smart Control & Network)
                </h2>
                <p className="text-sm text-slate-500 mt-1">บันทึกความต้องการควบคุมภาพ เสียง ออโตเมชัน และระบบไอทีเครือข่ายในแต่ละจุด</p>
              </div>

              {renderRoomTabs()}

              <div className="space-y-6">
                
                {/* Automation Control Section */}
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <span className="block text-xs font-bold text-blue-800 uppercase tracking-wider">ระบบควบคุมกลาง (Smart Control System)</span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-655 mb-1">ระบบที่ควบคุมกลาง</label>
                      <select
                        value={currentRoom.controlType || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'controlType', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('control_type', ['ภาพ', 'ภาพ+เสียง'], false).map(opt => (
                          <option key={opt} value={opt}>{opt === 'ภาพ' ? 'ภาพอย่างเดียว (Video Control)' : opt === 'ภาพ+เสียง' ? 'ภาพ + เสียง (AV Control)' : opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-655 mb-1">ช่องทางสั่งการระบบ</label>
                      <select
                        value={currentRoom.controlInterface || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'controlInterface', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('control_interface', ['ควบคุมผ่านปุ่มกด', 'ควบคุมผ่าน Touch Pad', 'ควบคุมผ่าน iPad'], false).map(opt => (
                          <option key={opt} value={opt}>{opt === 'ควบคุมผ่านปุ่มกด' ? 'ควบคุมผ่านปุ่มกด (Keypad)' : opt === 'ควบคุมผ่าน Touch Pad' ? 'ควบคุมผ่าน Touch Pad' : opt === 'ควบคุมผ่าน iPad' ? 'ควบคุมผ่าน iPad' : opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-655 mb-1">การจัดเตรียม iPad</label>
                      <select
                        value={currentRoom.controlIpadStatus || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'controlIpadStatus', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('control_ipad', ['ลูกค้ามี iPad อยู่แล้ว', 'ลูกค้าต้องการ iPad เพิ่ม'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-655 mb-1">หมายเหตุเพิ่มเติมระบบควบคุมกลาง</label>
                    <input
                      type="text"
                      value={currentRoom.controlNote || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'controlNote', e.target.value)}
                      placeholder="เช่น ต้องการควบคุมม่านและไฟด้วย iPad"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>

                {/* IT Network Infrastructure Section */}
                <div className="border border-slate-150 rounded-xl p-4 bg-slate-50/50 space-y-4">
                  <span className="block text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
                    <Network className="w-4.5 h-4.5" />
                    ระบบไอทีเครือข่ายอินเทอร์เน็ต (Network Infrastructure)
                  </span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-655 mb-1">การเชื่อมต่อเครือข่าย</label>
                      <select
                        value={currentRoom.networkInterface || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'networkInterface', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('network_interface', ['LAN (สายแลน)', 'Wi-Fi (ไร้สาย)', 'LAN & Wi-Fi', 'ไม่ต้องเชื่อมต่อเครือข่าย'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-655 mb-1">ลักษณะการเชื่อมต่อ</label>
                      <select
                        value={currentRoom.networkIPRequirement || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'networkIPRequirement', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('network_ip', ['เชื่อมต่อ internet', 'ไม่เชื่อมต่อ internet'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-655 mb-1">การจัดเตรียมเครือข่าย</label>
                      <select
                        value={currentRoom.networkResponsibility || ''}
                        onChange={(e) => updateRoomField(activeRoomIndex, 'networkResponsibility', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold"
                      >
                        <option value="">-- เลือก --</option>
                        {getOptionsForCategory('network_responsibility', ['Switch', 'Access point', 'Switch/Access point'], false).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-655 mb-1">หมายเหตุ/ข้อมูลเครือข่ายเพิ่มเติม</label>
                    <input
                      type="text"
                      value={currentRoom.networkNote || ''}
                      onChange={(e) => updateRoomField(activeRoomIndex, 'networkNote', e.target.value)}
                      placeholder="เช่น ต้องการ VLAN วงสำหรับกล้องแยก, แจ้งจำนวนไอพีที่ระบบต้องการใช้..."
                      className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>

              </div>

              {/* Gallery Multi images */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                {renderMultipleImagesSection(5, "รูปภาพจุดวางชุดควบคุม/แผงสวิตช์ไฟฟ้า (Control Detail Photo)")}
              </div>
            </div>
          )}

          {/* STEP 6: Final Review & Submit */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ขั้นตอนที่ 6: สรุปภาพรวมและส่งข้อมูลแบบสำรวจ
                </h2>
                <p className="text-sm text-slate-500 mt-1">กรุณาตรวจสอบข้อมูลโครงการและสเปคของอุปกรณ์ในทุกๆ จุดที่สำรวจก่อนบันทึกเข้าระบบหลัก</p>
              </div>

              <div className="bg-slate-55 border border-slate-200 rounded-2xl p-6 space-y-6 text-sm shadow-2xs">
                
                {/* Project general summary */}
                <div className="border-b border-slate-200 pb-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-slate-700">
                  <div className="flex justify-between md:justify-start gap-4">
                    <span className="text-slate-400 w-24">ชื่อโครงการ:</span>
                    <span className="font-bold text-slate-900">{projectName || '-'}</span>
                  </div>
                  <div className="flex justify-between md:justify-start gap-4">
                    <span className="text-slate-400 w-24">ชื่อลูกค้า:</span>
                    <span className="font-bold text-slate-900">{customerName || '-'}</span>
                  </div>
                  <div className="flex justify-between md:justify-start gap-4">
                    <span className="text-slate-400 w-24">งบประมาณ:</span>
                    <span className="font-bold text-[#4338ca]">{budget ? `${Number(budget).toLocaleString()} บาท` : '-'}</span>
                  </div>
                  <div className="flex justify-between md:justify-start gap-4">
                    <span className="text-slate-400 w-24">ผู้ทำแบบสำรวจ:</span>
                    <span className="font-semibold text-slate-900">
                      {salesPersons.find(sp => sp.id === salesPersonId)?.name || '-'}
                    </span>
                  </div>
                  {locationAddress && (
                    <div className="md:col-span-2 flex justify-between md:justify-start gap-4">
                      <span className="text-slate-400 w-24 text-left">ที่อยู่ปักหมุด:</span>
                      <span className="font-medium text-slate-800">
                        {locationAddress} (พิกัด: {locationLat.toFixed(5)}, {locationLng.toFixed(5)})
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between md:justify-start gap-4">
                    <span className="text-slate-400 w-24">ผู้ประสานงาน:</span>
                    <span className="font-semibold text-slate-900">{contactName || '-'} (เบอร์: {contactPhone || '-'})</span>
                  </div>
                  <div className="flex justify-between md:justify-start gap-4">
                    <span className="text-slate-400 w-24">วันเข้าสำรวจ:</span>
                    <span className="font-semibold text-slate-900">{surveyDate || '-'}</span>
                  </div>
                </div>

                {/* Project-wide customer photos count */}
                <div className="bg-[#4f46e5]/10/40 p-4 rounded-xl space-y-2 border border-[#4f46e5]/20">
                  <h4 className="font-bold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-4 h-4" /> รูปภาพอาคารและหน้าห้องที่สำรวจ
                  </h4>
                  <p className="text-xs text-slate-700">
                    แนบรูปอาคาร/หน้าห้องแล้วทั้งหมด <strong>{existingImages.length} ภาพ</strong>
                  </p>
                </div>

                {/* Rooms Specs Summary List */}
                <div className="space-y-6">
                  <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">รายละเอียดข้อมูลอุปกรณ์และโครงสร้างรายห้อง ({rooms.length} จุด)</h4>
                  
                  {rooms.map((room, index) => (
                    <div key={room.id} className="border border-slate-200 bg-white rounded-xl p-5 space-y-4 shadow-3xs">
                      
                      {/* Room Header */}
                      <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-xs text-slate-850 flex justify-between items-center border border-slate-150">
                        <span>{index + 1}. {room.name}</span>
                        <span className="text-slate-550 font-semibold">{room.roomType || 'ไม่ได้ระบุชนิดห้อง'} (ชั้น {room.floor || '-'})</span>
                      </div>

                      {/* 1. Dimensions & Structure */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">1. มิติห้อง & ข้อมูลติดตั้งโครงสร้าง</span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                          <p><span className="text-slate-400">ขนาด กxลxส:</span> <span className="font-bold">{room.roomWidth || '-'} x {room.roomLength || '-'} x {room.roomHeight || '-'} ม.</span></p>
                          <p><span className="text-slate-400">ลักษณะติดตั้ง:</span> <span className="font-medium">{room.installationType || '-'}</span></p>
                          <p><span className="text-slate-400">พื้นผิวผนัง:</span> <span className="font-medium">{room.surfaceType || '-'}</span></p>
                          <p><span className="text-slate-400">ระยะสายจอ-คุม:</span> <span className="font-medium">{room.distanceToControlRoom ? `${room.distanceToControlRoom} ม.` : '-'}</span></p>
                          
                          <p className="sm:col-span-2"><span className="text-slate-400">ผู้เตรียมโครงสร้าง:</span> <span className="font-semibold">{room.structureResponsibility || '-'}</span></p>
                          <p><span className="text-slate-400">ผู้เดินสาย:</span> <span className="font-semibold">{room.cablingResponsibility || '-'}</span></p>
                          <p><span className="text-slate-400">ผู้เตรียมไฟเมน:</span> <span className="font-semibold">{room.mainPowerResponsibility || '-'}</span></p>
                        </div>
                      </div>

                      {/* 2. IT Rack & Wall Plate details */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-blue-850 uppercase tracking-wider block">2. ตู้แร็คระบบ (IT Rack) & Wall Plate</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                          <p><span className="text-slate-400">ตำแหน่งแร็ค:</span> <span className="font-medium">{room.rackLocation || '-'}</span></p>
                          <p><span className="text-slate-400">ผู้รับผิดชอบแร็ค:</span> <span className="font-semibold">{room.rackResponsibility || '-'}</span></p>
                          <p><span className="text-slate-400">จุดจ่ายไฟแร็ค:</span> <span className="font-semibold">{room.rackPowerSource || '-'}</span></p>
                          
                          <p><span className="text-slate-400">รูปแบบ Wall Plate:</span> <span className="font-medium">{room.wallPlateType || '-'}</span></p>
                          <p className="sm:col-span-2"><span className="text-slate-400">การเดินสายเพลท:</span> <span className="font-medium">{room.wallPlateWiring || '-'}</span></p>
                        </div>
                      </div>

                      {/* 3. Visual System Details */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <span className="text-[11px] font-bold text-blue-900 uppercase block">3. รายละเอียดระบบภาพ (Visual System)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50/40 p-3 rounded-lg border border-slate-100">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 text-[11px]">จอหลัก LED Display</span>
                            <p className="pl-2"><span className="text-slate-400">ขนาด:</span> <span className="font-medium">{room.ledWidth && room.ledHeight ? `${room.ledWidth} x ${room.ledHeight} เมตร` : 'ไม่มี'}</span></p>
                            <p className="pl-2"><span className="text-slate-400">ยี่ห้อ:</span> <span className="font-bold">{room.ledModelName || '-'}</span></p>
                            <p className="pl-2"><span className="text-slate-400">Pitch/รูปทรง:</span> <span className="font-medium">{room.ledPixelPitch || '-'} ({room.ledType || '-'} {room.ledSubstrate || '-'})</span></p>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 text-[11px]">พอร์ตนำเข้าข้อมูล (Input Ports)</span>
                            <div className="pl-2 flex flex-wrap gap-1">
                              {(room.inputPorts || []).length > 0 ? (
                                (room.inputPorts || []).map(p => (
                                  <span key={p.id} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                    {p.portType} x {p.portQty}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-450 italic">ไม่มีข้อมูลการกรอกพอร์ต</span>
                              )}
                            </div>
                          </div>

                          {/* Visual Others summary list */}
                          {room.visualOthersEnabled && (
                            <div className="sm:col-span-2 space-y-1 bg-white p-2 rounded border border-slate-150">
                              <span className="font-semibold text-slate-700 text-[10px]">ระบบภาพย่อยเสริม:</span>
                              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                {room.visualOthersEnabled.interactive && (
                                  <li>กระดานอัจฉริยะ Interactive Board: ขนาด {room.interactiveSize || '-'} นิ้ว x {room.interactiveQty || 0} เครื่อง (ยี่ห้อ: {room.interactiveBrand || '-'})</li>
                                )}
                                {room.visualOthersEnabled.projector && (
                                  <li>เครื่องฉายโปรเจคเตอร์: {room.projectorLumen || '-'} lumens x {room.projectorQty || 0} เครื่อง (ยี่ห้อ: {room.projectorBrand || '-'})</li>
                                )}
                                {room.visualOthersEnabled.sideDisplay && (
                                  <li>จอด้านข้าง/เสริม: {room.sideDisplayType || '-'} x {room.sideDisplayQty || 0} จอ (แสดงผล: {room.sideDisplayDiffImage || '-'})</li>
                                )}
                                {room.visualOthersEnabled.ptzCamera && (
                                  <li>กล้อง PTZ Camera: จำนวน {room.ptzQty || 0} ตัว (ยี่ห้อ: {room.ptzBrand || '-'} | Auto-Tracking: {room.ptzTracking || '-'})</li>
                                )}
                                {room.visualOthersEnabled.signage && (
                                  <li>ป้าย Digital Signage: ขนาด {room.signageSize || '-'} นิ้ว x {room.signageQty || 0} เครื่อง (ยี่ห้อ: {room.signageBrand || '-'})</li>
                                )}
                              </ul>
                            </div>
                          )}

                          {room.visualNote && <p className="sm:col-span-2 text-slate-500 italic"><span className="font-bold text-slate-600">หมายเหตุภาพ:</span> {room.visualNote}</p>}
                        </div>
                      </div>

                      {/* 4. Audio System Details */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <span className="text-[11px] font-bold text-indigo-900 uppercase block">4. รายละเอียดระบบเสียง (Audio System)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-55/30 p-3 rounded-lg border border-slate-100">
                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 text-[11px]">ไมโครโฟนไร้สาย & สาย</span>
                            <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                              {room.micWiredQty ? <li>ไมค์สาย: {room.micWiredQty} ตัว ({room.micWiredBrand})</li> : null}
                              {room.micWirelessHandQty ? <li>ไมค์ไร้สายถือ: {room.micWirelessHandQty} ตัว ({room.micWirelessHandBrand})</li> : null}
                              {room.micWirelessLapelQty ? <li>ไมค์หนีบปกเสื้อ: {room.micWirelessLapelQty} ตัว ({room.micWirelessLapelBrand})</li> : null}
                              {!room.micWiredQty && !room.micWirelessHandQty && !room.micWirelessLapelQty ? <li className="text-slate-450">ไม่ได้ติดตั้งไมโครโฟนสแตนเลส/ถือ</li> : null}
                            </ul>
                          </div>

                          <div className="space-y-1">
                            <span className="font-bold text-slate-800 text-[11px]">ระบบลำโพงหลัก (Speakers)</span>
                            <p className="pl-2"><span className="text-slate-400">รูปแบบ:</span> <span className="font-bold">{room.speakerType || '-'}</span></p>
                            <p className="pl-2"><span className="text-slate-400">ยี่ห้อ:</span> <span className="font-semibold">{room.speakerBrand || '-'}</span></p>
                          </div>

                          <div className="space-y-1 bg-white p-2 rounded border border-slate-150">
                            <span className="font-bold text-slate-800 text-[10px]">ชุดประชุมทางไกล Video Conference</span>
                            <p className="text-[11px]"><span className="text-slate-400">จำนวน:</span> <span className="font-medium">{room.allInOneQty ? `${room.allInOneQty} ชุด` : 'ไม่ได้ใช้'}</span></p>
                            {room.allInOneQty ? (
                              <>
                                <p className="text-[11px]"><span className="text-slate-400">ชนิดแชร์ระบบ:</span> <span className="font-medium">{room.allInOneWirelessType || '-'} (ยี่ห้อ: {room.allInOneBrand || '-'})</span></p>
                                <p className="text-[11px]"><span className="text-slate-400">VDO Platform:</span> <span className="font-medium text-[#4338ca]">{room.vdoConferencePlatform || '-'}</span></p>
                              </>
                            ) : null}
                          </div>

                          <div className="space-y-1 bg-white p-2 rounded border border-slate-150">
                            <span className="font-bold text-slate-800 text-[10px]">ชุดไมค์ประชุมตั้งโต๊ะ (Tabletop Mics)</span>
                            <p className="text-[11px]"><span className="text-slate-400">ไมค์ประธาน:</span> <span className="font-medium">{room.tabletopChairmanQty || 0} ตัว</span> | <span className="text-slate-400">ผู้ร่วม:</span> <span className="font-medium">{room.tabletopDelegateQty || 0} ตัว</span></p>
                            <p className="text-[11px]"><span className="text-slate-400">การเชื่อมต่อ/ยี่ห้อ:</span> <span className="font-medium">{room.tabletopType || '-'} ({room.tabletopBrand || '-'})</span></p>
                            {room.tabletopSpecialFeatures && <p className="text-[10px] text-slate-500 font-medium">ฟีเจอร์: {room.tabletopSpecialFeatures}</p>}
                          </div>

                          {room.audioNote && <p className="sm:col-span-2 text-slate-500 italic"><span className="font-bold text-slate-600">หมายเหตุเสียง:</span> {room.audioNote}</p>}
                        </div>
                      </div>

                      {/* 5. Control & IT Network Details */}
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <span className="text-[11px] font-bold text-emerald-800 uppercase block">5. ระบบควบคุมกลาง & เครือข่ายไอที (Smart Control & Network)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-emerald-50/10 p-3 rounded-lg border border-slate-100">
                          <div className="space-y-1">
                            <span className="font-bold text-emerald-900 text-[11px]">ระบบควบคุมออโตเมชัน</span>
                            <p className="pl-2"><span className="text-slate-400">คุมระบบ:</span> <span className="font-medium">{room.controlType || '-'}</span></p>
                            <p className="pl-2"><span className="text-slate-400">ช่องทาง:</span> <span className="font-medium">{room.controlInterface || '-'} (iPad: {room.controlIpadStatus || '-'})</span></p>
                            {room.controlNote && <p className="pl-2 text-slate-500 italic">โน้ต: {room.controlNote}</p>}
                          </div>
                          
                          <div className="space-y-1 bg-white p-2 rounded border border-emerald-100">
                            <span className="font-bold text-emerald-900 text-[10px] flex items-center gap-1">
                              <Network className="w-3.5 h-3.5" /> ระบบ IT Network
                            </span>
                            <p className="text-[11px]"><span className="text-slate-400">การเชื่อมต่อเน็ต:</span> <span className="font-bold text-slate-900">{room.networkInterface || '-'}</span></p>
                            <p className="text-[11px]"><span className="text-slate-400">ลักษณะการเชื่อมต่อ:</span> <span className="font-semibold text-slate-800">{room.networkIPRequirement || '-'}</span></p>
                            <p className="text-[11px]"><span className="text-slate-400">การจัดเตรียมเครือข่าย:</span> <span className="font-medium">{room.networkResponsibility || '-'}</span></p>
                            {room.networkNote && <p className="text-[10px] text-slate-500 italic mt-0.5">รายละเอียด: {room.networkNote}</p>}
                          </div>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

                {/* drawings gallery with download for drawing viewer */}
                {allDrawings.length > 0 && (
                  <div className="pt-4 border-t border-slate-200">
                    <h4 className="font-bold text-slate-950 text-sm mb-3">คลังรูปวาดและเส้นบอกระยะโครงการ (Drawing & Annotation Gallery)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {allDrawings.map((draw, idx) => (
                        <div key={draw.id} className="border border-slate-200 bg-white rounded-xl p-3.5 flex flex-col justify-between shadow-3xs">
                          <div>
                            <div className="relative w-full h-36 border border-slate-200 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={formatDriveEmbedUrl(draw.annotatedImage)} alt={`Drawing gallery thumbnail ${idx}`} className="object-cover w-full h-full" />
                            </div>
                            <div className="mt-2 text-xs">
                              <p className="font-bold text-blue-900">{draw.roomName} <span className="text-slate-400 font-normal">| ขั้นตอนที่ {draw.step}</span></p>
                              {draw.description && <p className="text-slate-500 mt-0.5">{draw.description}</p>}
                            </div>
                          </div>
                          <a
                            href={draw.annotatedImage}
                            download={`sws_drawing_${draw.roomName.replace(/\s+/g, '_')}_step${draw.step}_${idx}.png`}
                            className="w-full mt-3 bg-[#4f46e5]/10 text-blue-650 hover:bg-[#4f46e5]/20 text-xs font-bold py-2 rounded-lg text-center flex items-center justify-center gap-1 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            ดาวน์โหลดรูปวาดระยะ
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 transition text-sm shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                ขั้นตอนก่อนหน้า
              </button>
            ) : (
              <Link
                href="/"
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-semibold flex items-center gap-1.5 transition text-sm"
              >
                ยกเลิก
              </Link>
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={nextStep}
                className="px-5 py-2.5 bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:bg-gradient-to-r from-[#4338ca] to-[#6d28d9] text-white rounded-xl font-semibold flex items-center gap-1.5 transition text-sm shadow-sm"
              >
                ขั้นตอนต่อไป
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl font-bold flex items-center gap-2 transition text-sm shadow-md"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    กำลังเซฟข้อมูล...
                  </>
                ) : (
                  <>
                    <Save className="w-4.5 h-4.5" />
                    {isOnline ? 'บันทึกสรุป & สร้างรายงาน Docs' : 'บันทึกสรุป (ออฟไลน์)'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Modal overlay for Image Annotation */}
      {annotatingRoomIndex !== null && annotatingImageId !== null && annotatingImageSrc && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
          <div className="w-full max-w-5xl h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="shrink-0 bg-slate-100 px-5 py-3 flex items-center justify-between border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm md:text-base">
                วาดเขียนบอกระยะลงบนรูปภาพ ({annotatingRoomIndex === -1 ? 'อาคาร / หน้าห้อง' : rooms[annotatingRoomIndex].name})
              </h3>
              <button 
                type="button"
                onClick={() => { setAnnotatingRoomIndex(null); setAnnotatingImageId(null); setAnnotatingImageSrc(null); }}
                className="text-slate-500 hover:text-slate-800 text-sm font-semibold p-1 hover:bg-slate-200 rounded-lg transition"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
              <ImageAnnotation 
                imageSrc={annotatingImageSrc}
                onSave={saveAnnotationResult}
                onCancel={() => { setAnnotatingRoomIndex(null); setAnnotatingImageId(null); setAnnotatingImageSrc(null); }}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Custom beautiful popup modal overlay */}
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
    </div>
  );

  // Gallery Multiple Images Section Helper (Fixed step parameter mismatch)
  function renderMultipleImagesSection(step: number, title: string, description?: string) {
    const isExisting = step === 1;
    const roomIdx = isExisting ? -1 : activeRoomIndex;
    const imagesList = isExisting ? existingImages : ((rooms[roomIdx] || {}).images || []).filter(img => Number(img.step) === Number(step));

    return (
      <div className="space-y-4">
        {/* Compact header with action buttons on the right */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100 mb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              {title}
            </h3>
            {description && (
              <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{description}</p>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Upload Button */}
            <div className="relative px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleMultipleImageUpload(e, roomIdx, step)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Download className="w-3.5 h-3.5" />
              อัปโหลดรูปภาพ
            </div>

            {/* Take Photo Button */}
            <div className="relative px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer shadow-2xs">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleMultipleImageUpload(e, roomIdx, step)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <Camera className="w-3.5 h-3.5" />
              ถ่ายภาพ
            </div>
          </div>
        </div>

        {imagesList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {imagesList.map((img) => (
              <div key={img.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs">
                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={formatDriveEmbedUrl(img.annotatedImage)}
                    alt="Site Survey Gallery item"
                    className="object-cover w-full h-full"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">คำบรรยายประกอบภาพ</label>
                  <input
                    type="text"
                    value={img.description || ''}
                    onChange={(e) => handleImageDescChange(roomIdx, img.id, e.target.value)}
                    placeholder="เช่น มุมมองทางเข้าด้านหน้า, ตำแหน่งติดแร็คไอที..."
                    className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded focus:outline-none bg-white"
                  />
                </div>

                <div className="flex justify-between items-center gap-2 pt-1 border-t border-slate-150">
                  <button
                    type="button"
                    onClick={() => startAnnotation(roomIdx, img)}
                    className="px-2.5 py-1.5 border border-slate-250 rounded-lg text-[11px] font-bold hover:bg-slate-100 text-blue-650 flex items-center gap-1 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    วาดเส้นบอกระยะ/หมุนภาพ
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRoomImage(roomIdx, img.id)}
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-red-650 rounded-lg transition"
                    title="ลบรูปภาพนี้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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

export default function SurveyWizardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5]" />
      </div>
    }>
      <SurveyWizardForm />
    </Suspense>
  );
}
