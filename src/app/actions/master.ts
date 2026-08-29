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
    return await db.select().from(dropdownOptions).all();
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
