'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  getSalesPersons, addSalesPerson, updateSalesPerson, deleteSalesPerson,
  getDisplayModels, addDisplayModel, updateDisplayModel, deleteDisplayModel,
  getDropdownOptions, addDropdownOption, deleteDropdownOption
} from '../actions/master';
import { Plus, Edit, Trash2, ArrowLeft, Loader2, Save, X, Settings2 } from 'lucide-react';

interface SalesPerson {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
}

interface DisplayModel {
  id: number;
  modelName: string;
  brand: string;
  specifications: string | null;
  createdAt: string;
}

interface DropdownOption {
  id: number;
  category: string;
  value: string;
}

const CATEGORY_MAP: Record<string, string> = {
  interactive_brand: 'แบรนด์ Interactive Board',
  projector_brand: 'แบรนด์ Projector',
  ptz_brand: 'แบรนด์กล้อง PTZ',
  signage_brand: 'แบรนด์ Digital Signage',
  mic_brand: 'แบรนด์ไมโครโฟน',
  speaker_brand: 'แบรนด์ลำโพง',
  tabletop_brand: 'แบรนด์ชุดไมค์ประชุม',
  vdo_brand: 'แบรนด์กล้อง All-in-one VDO Conf',
  installation_type: 'ลักษณะการติดตั้ง (Step 2)',
  surface_type: 'พื้นผิวติดตั้งผนัง (Step 2)',
  responsibility: 'ผู้จัดเตรียม/ผู้รับผิดชอบระบบ (Step 2/3/4/5)',
  rack_location: 'ตำแหน่งวางตู้แร็ค (Step 2)',
  wall_plate_wiring: 'ลักษณะการเดินสาย Wall plate (Step 2)',
  wall_plate_type: 'ประเภท Wall Plate (Step 2)',
  led_type: 'รูปทรงจอ LED (Step 3)',
  led_substrate: 'เทคโนโลยีเม็ด LED (Step 3)',
  led_application: 'ลักษณะการใช้งานจอ LED (Step 3)',
  side_display_type: 'ประเภทจอเสริม (Step 3)',
  side_display_diff_image: 'รูปแบบภาพแสดงผลจอเสริม (Step 3)',
  ptz_tracking: 'ระบบ PTZ Auto-Tracking (Step 3)',
  speaker_type: 'รูปแบบลำโพง (Step 4)',
  byod_type: 'ระบบไร้สาย BYOD/BYOM (Step 4)',
  tabletop_type: 'ประเภทการเชื่อมต่อไมค์ประชุม (Step 4)',
  control_type: 'ระบบควบคุมกลาง (Step 5)',
  control_interface: 'ช่องทางสั่งการระบบควบคุมกลาง (Step 5)',
  control_ipad: 'การจัดเตรียม iPad คอนโทรล (Step 5)',
  network_interface: 'การเชื่อมต่อเครือข่ายอินเทอร์เน็ต (Step 5)',
  network_ip: 'ลักษณะการเชื่อมต่ออินเทอร์เน็ต (Step 5)',
  network_responsibility: 'การจัดเตรียมอุปกรณ์เครือข่าย (Step 5)',
};

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'displays' | 'options'>('options');
  const [salesList, setSalesList] = useState<SalesPerson[]>([]);
  const [displayList, setDisplayList] = useState<DisplayModel[]>([]);
  const [optionsList, setOptionsList] = useState<DropdownOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states - Sales
  const [salesName, setSalesName] = useState('');
  const [salesEmail, setSalesEmail] = useState('');
  const [salesPhone, setSalesPhone] = useState('');
  const [editingSalesId, setEditingSalesId] = useState<number | null>(null);

  // Form states - Displays
  const [modelName, setModelName] = useState('');
  const [brand, setBrand] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [editingModelId, setEditingModelId] = useState<number | null>(null);

  // Form states - Options
  const [optionCategory, setOptionCategory] = useState('interactive_brand');
  const [optionValue, setOptionValue] = useState('');
  const [optionsPage, setOptionsPage] = useState(1);
  const itemsPerPage = 10;

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setOptionsPage(1);
  }, [optionCategory]);

  const loadData = async () => {
    setLoading(true);
    const sales = await getSalesPersons();
    const displays = await getDisplayModels();
    const options = await getDropdownOptions();
    setSalesList(sales as SalesPerson[]);
    setDisplayList(displays as DisplayModel[]);
    setOptionsList(options as DropdownOption[]);
    setLoading(false);
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesName.trim()) return;

    if (editingSalesId !== null) {
      const res = await updateSalesPerson(editingSalesId, {
        name: salesName,
        email: salesEmail,
        phone: salesPhone,
      });
      if (res.success) {
        showStatus('success', 'แก้ไขข้อมูลพนักงานขายเรียบร้อยแล้ว');
        setEditingSalesId(null);
        setSalesName('');
        setSalesEmail('');
        setSalesPhone('');
        loadData();
      } else {
        showStatus('error', res.error || 'เกิดข้อผิดพลาดในการแก้ไข');
      }
    } else {
      const res = await addSalesPerson({
        name: salesName,
        email: salesEmail,
        phone: salesPhone,
      });
      if (res.success) {
        showStatus('success', 'เพิ่มพนักงานขายเรียบร้อยแล้ว');
        setSalesName('');
        setSalesEmail('');
        setSalesPhone('');
        loadData();
      } else {
        showStatus('error', res.error || 'เกิดข้อผิดพลาดในการเพิ่ม');
      }
    }
  };

  const handleDisplaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim() || !brand.trim()) return;

    if (editingModelId !== null) {
      const res = await updateDisplayModel(editingModelId, {
        modelName,
        brand,
        specifications,
      });
      if (res.success) {
        showStatus('success', 'แก้ไขข้อมูลรุ่นจอภาพเรียบร้อยแล้ว');
        setEditingModelId(null);
        setModelName('');
        setBrand('');
        setSpecifications('');
        loadData();
      } else {
        showStatus('error', res.error || 'เกิดข้อผิดพลาดในการแก้ไข');
      }
    } else {
      const res = await addDisplayModel({
        modelName,
        brand,
        specifications,
      });
      if (res.success) {
        showStatus('success', 'เพิ่มรุ่นจอภาพเรียบร้อยแล้ว');
        setModelName('');
        setBrand('');
        setSpecifications('');
        loadData();
      } else {
        showStatus('error', res.error || 'เกิดข้อผิดพลาดในการเพิ่ม');
      }
    }
  };

  const handleOptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!optionValue.trim()) return;

    const res = await addDropdownOption({
      category: optionCategory,
      value: optionValue.trim(),
    });

    if (res.success) {
      showStatus('success', 'เพิ่มตัวเลือกเรียบร้อยแล้ว');
      setOptionValue('');
      loadData();
    } else {
      showStatus('error', res.error || 'เกิดข้อผิดพลาดในการเพิ่มตัวเลือก');
    }
  };

  const startEditSales = (sp: SalesPerson) => {
    setEditingSalesId(sp.id);
    setSalesName(sp.name);
    setSalesEmail(sp.email || '');
    setSalesPhone(sp.phone || '');
  };

  const cancelEditSales = () => {
    setEditingSalesId(null);
    setSalesName('');
    setSalesEmail('');
    setSalesPhone('');
  };

  const startEditModel = (dm: DisplayModel) => {
    setEditingModelId(dm.id);
    setModelName(dm.modelName);
    setBrand(dm.brand);
    setSpecifications(dm.specifications || '');
  };

  const cancelEditModel = () => {
    setEditingModelId(null);
    setModelName('');
    setBrand('');
    setSpecifications('');
  };

  const handleDeleteSales = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายชื่อพนักงานขายนี้?')) return;
    const res = await deleteSalesPerson(id);
    if (res.success) {
      showStatus('success', 'ลบรายชื่อเรียบร้อยแล้ว');
      loadData();
    } else {
      showStatus('error', res.error || 'ไม่สามารถลบข้อมูลได้');
    }
  };

  const handleDeleteModel = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลรุ่นจอภาพนี้?')) return;
    const res = await deleteDisplayModel(id);
    if (res.success) {
      showStatus('success', 'ลบข้อมูลรุ่นจอภาพเรียบร้อยแล้ว');
      loadData();
    } else {
      showStatus('error', res.error || 'ไม่สามารถลบข้อมูลได้');
    }
  };

  const handleDeleteOption = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบตัวเลือกของระบบนี้?')) return;
    const res = await deleteDropdownOption(id);
    if (res.success) {
      showStatus('success', 'ลบตัวเลือกของระบบเรียบร้อยแล้ว');
      loadData();
    } else {
      showStatus('error', res.error || 'ไม่สามารถลบข้อมูลได้');
    }
  };

  return (
    <div className="pb-12 animate-fade-in">
      {/* Status Toast */}
      {statusMessage && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
          statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <div className="max-w-6xl mx-auto">


        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5] mb-2" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4 text-slate-900">
                เพิ่มตัวเลือกดรอปดาวน์
              </h2>

              <form onSubmit={handleOptionSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                    กลุ่มดรอปดาวน์ (Dropdown Category) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={optionCategory}
                    onChange={(e) => setOptionCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 text-sm"
                  >
                    {Object.entries(CATEGORY_MAP).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                    ค่าแบรนด์/ข้อมูล (Value Option) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={optionValue}
                    onChange={(e) => setOptionValue(e.target.value)}
                    placeholder="เช่น Bose, Crestron, Shure"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 text-sm"
                    required
                  />
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] hover:bg-gradient-to-r from-[#4338ca] to-[#6d28d9] text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    เพิ่มตัวเลือก
                  </button>
                </div>
              </form>
            </div>

            {/* List Table Section */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-4 text-slate-900 font-bold">
                รายการตัวเลือกของระบบภาพและเสียง
              </h2>

              <div className="overflow-x-auto">
                {(() => {
                  const filteredOptions = optionsList.filter(opt => opt.category === optionCategory);
                  const totalPages = Math.max(1, Math.ceil(filteredOptions.length / itemsPerPage));
                  const paginatedOptions = filteredOptions.slice((optionsPage - 1) * itemsPerPage, optionsPage * itemsPerPage);

                  return filteredOptions.length === 0 ? (
                    <p className="text-center py-10 text-slate-500 text-sm">ไม่มีข้อมูลตัวเลือกสำหรับกลุ่มดรอปดาวน์ &quot;{CATEGORY_MAP[optionCategory]}&quot;</p>
                  ) : (
                    <div>
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-150 bg-slate-50/50">
                            <th className="py-3 px-4 font-semibold text-slate-600">กลุ่มดรอปดาวน์</th>
                            <th className="py-3 px-4 font-semibold text-slate-600">ค่าตัวเลือก (Brand / Option)</th>
                            <th className="py-3 px-4 font-semibold text-slate-600 text-right">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedOptions.map((opt) => (
                            <tr key={opt.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition">
                              <td className="py-3.5 px-4 font-semibold text-[#4338ca]">{CATEGORY_MAP[opt.category] || opt.category}</td>
                              <td className="py-3.5 px-4 text-slate-900 font-medium">{opt.value}</td>
                              <td className="py-3.5 px-4 text-right flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleDeleteOption(opt.id)}
                                  className="p-1.5 text-slate-550 hover:text-rose-650 hover:bg-rose-50 rounded-lg transition"
                                  title="ลบตัวเลือก"
                                >
                                  <Trash2 className="w-4.5 h-4.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {totalPages > 1 && (
                        <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            disabled={optionsPage === 1}
                            onClick={() => setOptionsPage(prev => Math.max(1, prev - 1))}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition shadow-2xs border border-slate-200"
                          >
                            ก่อนหน้า
                          </button>
                          <span className="text-slate-500 font-semibold">
                            หน้า {optionsPage} / {totalPages} (ทั้งหมด {filteredOptions.length} รายการ)
                          </span>
                          <button
                            type="button"
                            disabled={optionsPage === totalPages}
                            onClick={() => setOptionsPage(prev => Math.min(totalPages, prev + 1))}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition shadow-2xs border border-slate-200"
                          >
                            ถัดไป
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
