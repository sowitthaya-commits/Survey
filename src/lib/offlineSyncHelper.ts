import { offlineDb } from './offlineDb';
import { getSalesPersons, getDisplayModels, getDropdownOptions } from '@/app/actions/master';

export async function syncMasterDataCache() {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const sales = await getSalesPersons();
    if (sales && sales.length > 0) {
      await offlineDb.salesPersonsCache.clear();
      await offlineDb.salesPersonsCache.bulkPut(
        sales.map(sp => ({
          id: sp.id,
          name: sp.name,
          email: sp.email,
          phone: sp.phone
        }))
      );
    }

    const displays = await getDisplayModels();
    if (displays && displays.length > 0) {
      await offlineDb.displayModelsCache.clear();
      await offlineDb.displayModelsCache.bulkPut(
        displays.map(d => ({
          id: d.id,
          modelName: d.modelName,
          brand: d.brand,
          specifications: d.specifications
        }))
      );
    }

    const options = await getDropdownOptions();
    if (options && options.length > 0) {
      await offlineDb.dropdownOptionsCache.clear();
      await offlineDb.dropdownOptionsCache.bulkPut(
        options.map(o => ({
          id: o.id,
          category: o.category,
          value: o.value
        }))
      );
    }
    console.log('Master data and dropdown options cache synchronized to IndexedDB.');
  } catch (error) {
    console.error('Failed to sync master data cache:', error);
  }
}
