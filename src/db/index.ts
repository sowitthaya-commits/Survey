import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const url = process.env.TURSO_CONNECTION_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

// Run migrations on startup in dev mode
if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
  // Let's migrate asynchronously in development
  import('drizzle-orm/libsql/migrator').then(({ migrate }) => {
    migrate(db, { migrationsFolder: './drizzle' })
      .then(() => {
        console.log('Database migrated successfully.');
        return seedDatabase();
      })
      .catch((err) => {
        console.error('Failed to run database migrations:', err);
      });
  });
}

async function seedDatabase() {
  try {
    const sales = await db.select().from(schema.salesPersons);
    if (sales.length === 0) {
      await db.insert(schema.salesPersons).values([
        { name: 'สมชาย ใจดี (Somchai)', email: 'somchai@company.com', phone: '081-234-5678' },
        { name: 'สมศรี รักดี (Somsri)', email: 'somsri@company.com', phone: '089-876-5432' },
        { name: 'อนันต์ ปัญญา (Anan)', email: 'anan@company.com', phone: '082-345-6789' }
      ]);
      console.log('Seeded sales persons.');
    }

    const models = await db.select().from(schema.displayModels);
    if (models.length === 0) {
      await db.insert(schema.displayModels).values([
        { modelName: 'QM55B', brand: 'Samsung', specifications: '55" 4K UHD Professional Display' },
        { modelName: 'QM75B', brand: 'Samsung', specifications: '75" 4K UHD Professional Display' },
        { modelName: 'FW-65BZ30L', brand: 'Sony', specifications: '65" 4K HDR Professional Bravia' },
        { modelName: 'FW-85BZ30L', brand: 'Sony', specifications: '85" 4K HDR Professional Bravia' },
        { modelName: '55UH5F-H', brand: 'LG', specifications: '55" UHD Signage Display' }
      ]);
      console.log('Seeded display models.');
    }

    const options = await db.select().from(schema.dropdownOptions);
    if (options.length === 0) {
      const defaultOptions = [
        // LED brands
        { category: 'led_brand', value: 'Horion' },
        { category: 'led_brand', value: 'Dahua' },
        // Interactive brands
        { category: 'interactive_brand', value: 'Horion' },
        { category: 'interactive_brand', value: 'Dahua' },
        // Projector brands
        { category: 'projector_brand', value: 'Epson' },
        { category: 'projector_brand', value: 'Panasonic' },
        { category: 'projector_brand', value: 'Any' },
        // PTZ brands
        { category: 'ptz_brand', value: 'Sony' },
        { category: 'ptz_brand', value: 'Canon' },
        { category: 'ptz_brand', value: 'Aver' },
        { category: 'ptz_brand', value: 'Telycam' },
        // Signage brands
        { category: 'signage_brand', value: 'LG' },
        { category: 'signage_brand', value: 'Samsung' },
        { category: 'signage_brand', value: 'Any' },
        // Mic brands
        { category: 'mic_brand', value: 'Soundvision' },
        { category: 'mic_brand', value: 'TOA' },
        { category: 'mic_brand', value: 'Sennheiser' },
        { category: 'mic_brand', value: 'Audio-Technica' },
        { category: 'mic_brand', value: 'Shure' },
        { category: 'mic_brand', value: 'JTS' },
        // Speaker brands
        { category: 'speaker_brand', value: 'TOA' },
        { category: 'speaker_brand', value: 'Yamaha' },
        { category: 'speaker_brand', value: 'Bose' },
        { category: 'speaker_brand', value: 'QSC' },
        { category: 'speaker_brand', value: 'EV' },
        // Tabletop brands
        { category: 'tabletop_brand', value: 'TOA' },
        { category: 'tabletop_brand', value: 'Televic' },
        { category: 'tabletop_brand', value: 'Soundvision' },
        { category: 'tabletop_brand', value: 'Bosch' },
        { category: 'tabletop_brand', value: 'Vissonic' },
        // BYOD brands
        { category: 'byod_brand', value: 'Yealink' },
        { category: 'byod_brand', value: 'Yamaha' },
        // VDO brands
        { category: 'vdo_brand', value: 'AVer' },
        { category: 'vdo_brand', value: 'Logitech' }
      ];

      await db.insert(schema.dropdownOptions).values(defaultOptions);
      console.log('Seeded default dropdown options.');
    }
  } catch (err) {
    console.error('Error seeding database:', err);
  }
}

export * from './schema';
