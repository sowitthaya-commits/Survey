import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Users Table (Reused from existing DB for login)
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  position: text('position').notNull(),
  active: integer('active').default(1),
  vacationQuota: real('vacation_quota').default(12.0),
  createdAt: text('created_at'),
  lineUserId: text('line_user_id'),
});

// SWS Survey Specific Tables (Prefixed with survey_ to prevent table name collisions)
export const salesPersons = sqliteTable('survey_sales_persons', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const displayModels = sqliteTable('survey_display_models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  modelName: text('model_name').notNull(),
  brand: text('brand').notNull(),
  specifications: text('specifications'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const dropdownOptions = sqliteTable('survey_dropdown_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(), // 'led_brand', 'interactive_brand', ...
  value: text('value').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const surveys = sqliteTable('survey_surveys', {
  id: text('id').primaryKey(), // uuid
  projectName: text('project_name').notNull(),
  customerName: text('customer_name').notNull(),
  salesPersonId: integer('sales_person_id').references(() => salesPersons.id),
  status: text('status').notNull().default('synced'), // 'draft', 'synced', 'generating', 'completed'
  docUrl: text('doc_url'),
  pdfUrl: text('pdf_url'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  
  // General Info
  requestDate: text('request_date'),
  locationLat: real('location_lat'),
  locationLng: real('location_lng'),
  locationAddress: text('location_address'),
  quotationDeadline: text('quotation_deadline'),
  budget: text('budget'),

  // Existing Customer Systems (Project-wide Images)
  existingImages: text('existing_images'), // JSON string of RoomImage[]

  // Contact Info
  contactName: text('contact_name'),
  contactPhone: text('contact_phone'),
  surveyDate: text('survey_date'),

  // Rooms Data JSON String
  roomsData: text('rooms_data'),
});
