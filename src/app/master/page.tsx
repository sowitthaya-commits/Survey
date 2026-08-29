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
  led_brand: 'แบรนด์จอ LED หลัก',
  interactive_brand: 'แบรนด์ Interactive Board',
  projector_brand: 'แบรนด์ Projector',
  ptz_brand: 'แบรนด์กล้อง PTZ',
  signage_brand: 'แบรนด์ Digital Signage',
  mic_brand: 'แบรนด์ไมโครโฟน',
  speaker_brand: 'แบรนด์ลำโพง',
  tabletop_brand: 'แบรนด์ชุดไมค์ประชุม',
  byod_brand: 'แบรนด์ระบบไร้สาย (BYOD/BYOM)',
  vdo_brand: 'แบรนด์กล้อง All-in-one VDO Conf',
};

export default function MasterDataPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'displays' | 'options'>('sales');
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
  const [optionCategory, setOptionCategory] = useState('led_brand');
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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Navbar / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-650 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-slate-900">จัดการข้อมูลระบบ (Master Data)</h1>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            กลับหน้า Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Status Toast */}
        {statusMessage && (
          <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
            statusMessage.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Tab Switching */}
        <div className="flex border-b border-slate-200 mb-8 bg-white p-1 rounded-xl shadow-sm max-w-lg">
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex-1 text-center py-2.5 rounded-lg font-semibold text-xs transition-all ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            รายชื่อพนักงานขาย
          </button>
          <button
            onClick={() => setActiveTab('displays')}
            className={`flex-1 text-center py-2.5 rounded-lg font-semibold text-xs transition-all ${
              activeTab === 'displays'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            รุ่นจอภาพ (Display Models)
          </button>
          <button
            onClick={() => setActiveTab('options')}
            className={`flex-1 text-center py-2.5 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1 ${
              activeTab === 'options'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            ตัวเลือก Dropdowns
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Form Section */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
              <h2 className="text-lg font-bold mb-4 text-slate-900">
                {activeTab === 'sales' && (editingSalesId ? 'แก้ไขพนักงานขาย' : 'เพิ่มพนักงานขาย')}
                {activeTab === 'displays' && (editingModelId ? 'แก้ไขรุ่นจอภาพ' : 'เพิ่มรุ่นจอภาพ')}
                {activeTab === 'options' && 'เพิ่มตัวเลือกดรอปดาวน์'}
              </h2>

              {activeTab === 'sales' && (
                <form onSubmit={handleSalesSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                      ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={salesName}
                      onChange={(e) => setSalesName(e.target.value)}
                      placeholder="เช่น สมชาย ใจดี"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">อีเมล</label>
                    <input
                      type="email"
                      value={salesEmail}
                      onChange={(e) => setSalesEmail(e.target.value)}
                      placeholder="เช่น somchai@company.com"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">เบอร์โทรศัพท์</label>
                    <input
                      type="text"
                      value={salesPhone}
                      onChange={(e) => setSalesPhone(e.target.value)}
                      placeholder="เช่น 081-234-5678"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm"
                    />
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                    >
                      {editingSalesId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingSalesId ? 'บันทึกการแก้ไข' : 'เพิ่มรายชื่อ'}
                    </button>
                    {editingSalesId && (
                      <button
                        type="button"
                        onClick={cancelEditSales}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2 px-3 rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </form>
              )}

              {activeTab === 'displays' && (
                <form onSubmit={handleDisplaySubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                      ชื่อรุ่น (Model Name) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="เช่น QM55B, FW-65BZ30L"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                      ยี่ห้อ (Brand) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="เช่น Samsung, Sony, LG"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">รายละเอียดทางเทคนิค</label>
                    <textarea
                      value={specifications}
                      onChange={(e) => setSpecifications(e.target.value)}
                      placeholder="เช่น 55 นิ้ว 4K UHD, ความสว่าง 500 nits"
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition text-sm resize-none"
                    />
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                    >
                      {editingModelId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {editingModelId ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูลจอ'}
                    </button>
                    {editingModelId && (
                      <button
                        type="button"
                        onClick={cancelEditModel}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2 px-3 rounded-lg transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </form>
              )}

              {activeTab === 'options' && (
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
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มตัวเลือก
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* List Table Section */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold mb-4 text-slate-900 font-bold">
                {activeTab === 'sales' && 'รายการพนักงานขายทั้งหมด'}
                {activeTab === 'displays' && 'รายการรุ่นจอภาพทั้งหมด'}
                {activeTab === 'options' && 'รายการตัวเลือกของระบบภาพและเสียง'}
              </h2>

              <div className="overflow-x-auto">
                {activeTab === 'sales' && (
                  salesList.length === 0 ? (
                    <p className="text-center py-10 text-slate-500 text-sm">ไม่มีข้อมูลพนักงานขาย</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-150 bg-slate-50/50">
                          <th className="py-3 px-4 font-semibold text-slate-600">ชื่อ</th>
                          <th className="py-3 px-4 font-semibold text-slate-600">อีเมล</th>
                          <th className="py-3 px-4 font-semibold text-slate-600">เบอร์โทร</th>
                          <th className="py-3 px-4 font-semibold text-slate-600 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesList.map((sp) => (
                          <tr key={sp.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition">
                            <td className="py-3.5 px-4 font-medium text-slate-900">{sp.name}</td>
                            <td className="py-3.5 px-4 text-slate-600">{sp.email || '-'}</td>
                            <td className="py-3.5 px-4 text-slate-600">{sp.phone || '-'}</td>
                            <td className="py-3.5 px-4 text-right flex justify-end gap-1.5">
                              <button
                                onClick={() => startEditSales(sp)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="แก้ไข"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSales(sp.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {activeTab === 'displays' && (
                  displayList.length === 0 ? (
                    <p className="text-center py-10 text-slate-500 text-sm">ไม่มีข้อมูลรุ่นจอภาพ</p>
                  ) : (
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-150 bg-slate-50/50">
                          <th className="py-3 px-4 font-semibold text-slate-600">รุ่น (Model)</th>
                          <th className="py-3 px-4 font-semibold text-slate-600">ยี่ห้อ (Brand)</th>
                          <th className="py-3 px-4 font-semibold text-slate-600">รายละเอียด</th>
                          <th className="py-3 px-4 font-semibold text-slate-600 text-right">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayList.map((dm) => (
                          <tr key={dm.id} className="border-b border-slate-100 hover:bg-slate-50/40 transition">
                            <td className="py-3.5 px-4 font-medium text-slate-900">{dm.modelName}</td>
                            <td className="py-3.5 px-4 text-slate-600">{dm.brand}</td>
                            <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={dm.specifications || ''}>
                              {dm.specifications || '-'}
                            </td>
                            <td className="py-3.5 px-4 text-right flex justify-end gap-1.5">
                              <button
                                onClick={() => startEditModel(dm)}
                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="แก้ไข"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteModel(dm.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="ลบ"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {activeTab === 'options' && (() => {
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
                              <td className="py-3.5 px-4 font-semibold text-blue-700">{CATEGORY_MAP[opt.category] || opt.category}</td>
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
      </main>
    </div>
  );
}
