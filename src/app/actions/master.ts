'use server';

import { db } from '@/db';
import { salesPersons, displayModels, dropdownOptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

// --- Sales Person Actions ---

export async function getSalesPersons() {
  try {
    return await db.select().from(salesPersons).all();
  } catch (error) {
    console.error('Error fetching sales persons:', error);
    return [];
  }
}

export async function addSalesPerson(data: { name: string; email?: string; phone?: string }) {
  try {
    await db.insert(salesPersons).values({
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
    }).run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error adding sales person:', error);
    return { success: false, error: error.message };
  }
}

export async function updateSalesPerson(id: number, data: { name: string; email?: string; phone?: string }) {
  try {
    await db.update(salesPersons)
      .set({
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
      })
      .where(eq(salesPersons.id, id))
      .run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating sales person:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteSalesPerson(id: number) {
  try {
    await db.delete(salesPersons).where(eq(salesPersons.id, id)).run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting sales person:', error);
    return { success: false, error: error.message };
  }
}

// --- Display Model Actions ---

export async function getDisplayModels() {
  try {
    return await db.select().from(displayModels).all();
  } catch (error) {
    console.error('Error fetching display models:', error);
    return [];
  }
}

export async function addDisplayModel(data: { modelName: string; brand: string; specifications?: string }) {
  try {
    await db.insert(displayModels).values({
      modelName: data.modelName,
      brand: data.brand,
      specifications: data.specifications || null,
    }).run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error adding display model:', error);
    return { success: false, error: error.message };
  }
}

export async function updateDisplayModel(id: number, data: { modelName: string; brand: string; specifications?: string }) {
  try {
    await db.update(displayModels)
      .set({
        modelName: data.modelName,
        brand: data.brand,
        specifications: data.specifications || null,
      })
      .where(eq(displayModels.id, id))
      .run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating display model:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteDisplayModel(id: number) {
  try {
    await db.delete(displayModels).where(eq(displayModels.id, id)).run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting display model:', error);
    return { success: false, error: error.message };
  }
}

// --- Dropdown Options Actions ---

export async function getDropdownOptions() {
  try {
    const list = await db.select().from(dropdownOptions).all();
    if (list.length === 0) {
      console.log('Seeding default dropdown options into database...');
      const defaults: { category: string; value: string }[] = [
        ...['Samsung', 'LG', 'Sony', 'Leyard', 'Absen', 'Unilumin'].map(v => ({ category: 'led_brand', value: v })),
        ...['Horion', 'Dahua'].map(v => ({ category: 'interactive_brand', value: v })),
        ...['Epson', 'Panasonic', 'Any'].map(v => ({ category: 'projector_brand', value: v })),
        ...['Sony', 'Canon', 'Aver', 'Telycam'].map(v => ({ category: 'ptz_brand', value: v })),
        ...['LG', 'Samsung', 'Any'].map(v => ({ category: 'signage_brand', value: v })),
        ...['Soundvision', 'TOA', 'Sennheiser', 'Audio-Technica', 'Shure', 'JTS'].map(v => ({ category: 'mic_brand', value: v })),
        ...['TOA', 'Yamaha', 'Bose', 'QSC', 'EV'].map(v => ({ category: 'speaker_brand', value: v })),
        ...['TOA', 'Televic', 'Soundvision', 'Bosch', 'Vissonic'].map(v => ({ category: 'tabletop_brand', value: v })),
        ...['Barco', 'Crestron', 'Kramer'].map(v => ({ category: 'byod_brand', value: v })),
        ...['AVer', 'Logitech'].map(v => ({ category: 'vdo_brand', value: v })),
        ...['ติดผนัง', 'ตั้งจากพื้น', 'แขวนจากเพดาน'].map(v => ({ category: 'installation_type', value: v })),
        ...['ผนังปูน', 'ผนังเบา', 'ผนัง built-in'].map(v => ({ category: 'surface_type', value: v })),
        ...['SWS จัดเตรียม', 'ลูกค้าจัดเตรียม'].map(v => ({ category: 'responsibility', value: v })),
        ...['ห้องควบคุม', 'ภายในห้องประชุม'].map(v => ({ category: 'rack_location', value: v })),
        ...['เดินราง', 'เดินฝัง'].map(v => ({ category: 'wall_plate_wiring', value: v })),
        ...['HDMI Wall Plate', 'LAN Wall Plate - Extender', 'LAN Wall Plate - HDBaseT'].map(v => ({ category: 'wall_plate_type', value: v })),
        ...['Flat', 'Flat curve', 'Real curve'].map(v => ({ category: 'led_type', value: v })),
        ...['SMD', 'GOB', 'COB'].map(v => ({ category: 'led_substrate', value: v })),
        ...['ห้องประชุม', 'โฆษณา'].map(v => ({ category: 'led_application', value: v })),
        ...['จอ LED', 'จอ TV'].map(v => ({ category: 'side_display_type', value: v })),
        ...['ต้องการภาพต่างกับจอหลัก', 'ภาพเหมือนจอหลัก'].map(v => ({ category: 'side_display_diff_image', value: v })),
        ...['ต้องการระบบ Tracking', 'ไม่ต้องการระบบ Tracking'].map(v => ({ category: 'ptz_tracking', value: v })),
        ...['ตู้ลำโพงหน้า', 'ลำโพงติดเพดาน', 'ลำโพงคู่หน้า+ลำโพงเพดาน'].map(v => ({ category: 'speaker_type', value: v })),
        ...['BYOD', 'BYOM'].map(v => ({ category: 'byod_type', value: v })),
        ...['แบบมีสาย', 'แบบไร้สาย'].map(v => ({ category: 'tabletop_type', value: v })),
        ...['ภาพ', 'ภาพ+เสียง'].map(v => ({ category: 'control_type', value: v })),
        ...['ควบคุมผ่านปุ่มกด', 'ควบคุมผ่าน Touch Pad', 'ควบคุมผ่าน iPad'].map(v => ({ category: 'control_interface', value: v })),
        ...['ลูกค้ามี iPad อยู่แล้ว', 'ลูกค้าต้องการ iPad เพิ่ม'].map(v => ({ category: 'control_ipad', value: v })),
        ...['LAN (สายแลน)', 'Wi-Fi (ไร้สาย)', 'LAN & Wi-Fi', 'ไม่ต้องเชื่อมต่อเครือข่าย'].map(v => ({ category: 'network_interface', value: v })),
        ...['เชื่อมต่อ internet', 'ไม่เชื่อมต่อ internet'].map(v => ({ category: 'network_ip', value: v })),
        ...['Switch', 'Access point', 'Switch/Access point'].map(v => ({ category: 'network_responsibility', value: v })),
      ];
      for (const item of defaults) {
        await db.insert(dropdownOptions).values(item).run();
      }
      return await db.select().from(dropdownOptions).all();
    }
    return list;
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
    return [];
  }
}

export async function addDropdownOption(data: { category: string; value: string }) {
  try {
    await db.insert(dropdownOptions).values({
      category: data.category,
      value: data.value,
    }).run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error adding dropdown option:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteDropdownOption(id: number) {
  try {
    await db.delete(dropdownOptions).where(eq(dropdownOptions.id, id)).run();
    revalidatePath('/master');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting dropdown option:', error);
    return { success: false, error: error.message };
  }
}
