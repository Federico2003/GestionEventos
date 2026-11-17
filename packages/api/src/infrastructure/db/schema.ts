import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  real,
  sqliteTable,
  text,
  unique
} from 'drizzle-orm/sqlite-core';

/**
 * Esquema relacional de Planora para Cloudflare D1 (SQLite) definido con Drizzle ORM.
 * 11 tablas: users, clients, events, event_tables, guests, vendors, services,
 * event_services, expenses, tasks y agenda_items.
 *
 * Las migraciones SQL se generan con `npm run db:generate -w @planora/api`
 * y se aplican con `wrangler d1 migrations apply`.
 */

const nowIso = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const timestamps = {
  createdAt: text('created_at').notNull().default(nowIso),
  updatedAt: text('updated_at').notNull().default(nowIso)
};

const SERVICE_CATEGORIES = `('catering', 'photography', 'music_dj', 'venue', 'decoration', 'flowers', 'security', 'transport', 'other')`;

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'organizer', 'client'] }).notNull(),
    phone: text('phone'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps
  },
  (t) => [
    index('idx_users_email').on(t.email),
    index('idx_users_role').on(t.role),
    check('chk_users_role', sql`${t.role} IN ('admin', 'organizer', 'client')`)
  ]
);

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .unique()
      .references(() => users.id, { onDelete: 'set null' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    notes: text('notes'),
    ...timestamps
  },
  (t) => [
    index('idx_clients_organizer').on(t.organizerId),
    index('idx_clients_email').on(t.email)
  ]
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    clientId: text('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    eventType: text('event_type', {
      enum: ['wedding', 'fifteen_years', 'corporate', 'graduation', 'social']
    }).notNull(),
    status: text('status', {
      enum: ['draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled']
    })
      .notNull()
      .default('draft'),
    eventDate: text('event_date').notNull(),
    venueName: text('venue_name').notNull(),
    venueAddress: text('venue_address'),
    initialBudget: real('initial_budget').notNull().default(0),
    estimatedGuests: integer('estimated_guests').notNull().default(0),
    cancellationReason: text('cancellation_reason'),
    ...timestamps
  },
  (t) => [
    index('idx_events_organizer').on(t.organizerId),
    index('idx_events_client').on(t.clientId),
    index('idx_events_date').on(t.eventDate),
    index('idx_events_status').on(t.status),
    check(
      'chk_events_type',
      sql`${t.eventType} IN ('wedding', 'fifteen_years', 'corporate', 'graduation', 'social')`
    ),
    check(
      'chk_events_status',
      sql`${t.status} IN ('draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled')`
    ),
    check('chk_events_budget', sql`${t.initialBudget} >= 0`),
    check('chk_events_guests', sql`${t.estimatedGuests} >= 0`)
  ]
);

/** Mesas del evento: la capacidad es un parámetro de cada mesa (no un valor fijo). */
export const eventTables = sqliteTable(
  'event_tables',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    tableNumber: integer('table_number').notNull(),
    label: text('label'),
    capacity: integer('capacity').notNull(),
    ...timestamps
  },
  (t) => [
    unique('uq_event_tables_event_number').on(t.eventId, t.tableNumber),
    index('idx_event_tables_event').on(t.eventId),
    check('chk_event_tables_number', sql`${t.tableNumber} > 0`),
    check('chk_event_tables_capacity', sql`${t.capacity} > 0`)
  ]
);

export const guests = sqliteTable(
  'guests',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    tableNumber: integer('table_number'),
    rsvpStatus: text('rsvp_status', { enum: ['pending', 'confirmed', 'declined'] })
      .notNull()
      .default('pending'),
    plusOnes: integer('plus_ones').notNull().default(0),
    mealPreference: text('meal_preference', {
      enum: ['standard', 'vegetarian', 'vegan', 'child', 'kosher', 'other']
    })
      .notNull()
      .default('standard'),
    allergies: text('allergies'),
    hasCriticalAllergies: integer('has_critical_allergies', { mode: 'boolean' })
      .notNull()
      .default(false),
    dietaryRestrictions: text('dietary_restrictions'),
    ...timestamps
  },
  (t) => [
    // Un invitado solo puede ocupar una mesa existente del MISMO evento (FK compuesta).
    foreignKey({
      name: 'fk_guests_event_table',
      columns: [t.eventId, t.tableNumber],
      foreignColumns: [eventTables.eventId, eventTables.tableNumber]
    }),
    index('idx_guests_event').on(t.eventId),
    index('idx_guests_rsvp').on(t.rsvpStatus),
    index('idx_guests_table').on(t.eventId, t.tableNumber),
    index('idx_guests_meal').on(t.eventId, t.mealPreference),
    index('idx_guests_critical').on(t.eventId, t.hasCriticalAllergies),
    check('chk_guests_rsvp', sql`${t.rsvpStatus} IN ('pending', 'confirmed', 'declined')`),
    check('chk_guests_plus_ones', sql`${t.plusOnes} >= 0`)
  ]
);

export const vendors = sqliteTable(
  'vendors',
  {
    id: text('id').primaryKey(),
    organizerId: text('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    businessName: text('business_name').notNull(),
    category: text('category').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    rating: real('rating').notNull().default(5),
    ...timestamps
  },
  (t) => [
    index('idx_vendors_organizer').on(t.organizerId),
    index('idx_vendors_category').on(t.category),
    check('chk_vendors_category', sql`${t.category} IN ${sql.raw(SERVICE_CATEGORIES)}`),
    check('chk_vendors_rating', sql`${t.rating} >= 1.0 AND ${t.rating} <= 5.0`)
  ]
);

export const services = sqliteTable(
  'services',
  {
    id: text('id').primaryKey(),
    vendorId: text('vendor_id')
      .notNull()
      .references(() => vendors.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    basePrice: real('base_price').notNull().default(0),
    ...timestamps
  },
  (t) => [
    index('idx_services_vendor').on(t.vendorId),
    check('chk_services_price', sql`${t.basePrice} >= 0`)
  ]
);

export const eventServices = sqliteTable(
  'event_services',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    serviceId: text('service_id').references(() => services.id, { onDelete: 'set null' }),
    serviceName: text('service_name').notNull().default(''),
    vendorName: text('vendor_name').notNull().default(''),
    category: text('category').notNull().default('other'),
    agreedPrice: real('agreed_price').notNull(),
    status: text('status', { enum: ['quoted', 'contracted', 'paid', 'cancelled'] })
      .notNull()
      .default('quoted'),
    contractUrl: text('contract_url'),
    notes: text('notes'),
    ...timestamps
  },
  (t) => [
    index('idx_event_services_event').on(t.eventId),
    index('idx_event_services_service').on(t.serviceId),
    check('chk_event_services_category', sql`${t.category} IN ${sql.raw(SERVICE_CATEGORIES)}`),
    check('chk_event_services_price', sql`${t.agreedPrice} >= 0`),
    check(
      'chk_event_services_status',
      sql`${t.status} IN ('quoted', 'contracted', 'paid', 'cancelled')`
    )
  ]
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    eventServiceId: text('event_service_id').references(() => eventServices.id, {
      onDelete: 'set null'
    }),
    concept: text('concept').notNull(),
    category: text('category').notNull(),
    amount: real('amount').notNull(),
    dueDate: text('due_date'),
    paymentStatus: text('payment_status', { enum: ['pending', 'partial', 'paid'] })
      .notNull()
      .default('pending'),
    receiptUrl: text('receipt_url'),
    paidAt: text('paid_at'),
    ...timestamps
  },
  (t) => [
    index('idx_expenses_event').on(t.eventId),
    index('idx_expenses_status').on(t.paymentStatus),
    check('chk_expenses_amount', sql`${t.amount} > 0`),
    check('chk_expenses_status', sql`${t.paymentStatus} IN ('pending', 'partial', 'paid')`)
  ]
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] })
      .notNull()
      .default('medium'),
    status: text('status', { enum: ['todo', 'in_progress', 'completed', 'cancelled'] })
      .notNull()
      .default('todo'),
    dueDate: text('due_date').notNull(),
    completedAt: text('completed_at'),
    ...timestamps
  },
  (t) => [
    index('idx_tasks_event').on(t.eventId),
    index('idx_tasks_status').on(t.status),
    index('idx_tasks_due_date').on(t.dueDate),
    check('chk_tasks_priority', sql`${t.priority} IN ('low', 'medium', 'high', 'urgent')`),
    check(
      'chk_tasks_status',
      sql`${t.status} IN ('todo', 'in_progress', 'completed', 'cancelled')`
    )
  ]
);

export const agendaItems = sqliteTable(
  'agenda_items',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    responsiblePerson: text('responsible_person').notNull(),
    locationDetail: text('location_detail'),
    notes: text('notes'),
    orderIndex: integer('order_index').notNull().default(0),
    ...timestamps
  },
  (t) => [
    index('idx_agenda_event').on(t.eventId),
    index('idx_agenda_order').on(t.eventId, t.orderIndex),
    check('chk_agenda_time_range', sql`${t.startTime} < ${t.endTime}`)
  ]
);

export const schema = {
  users,
  clients,
  events,
  eventTables,
  guests,
  vendors,
  services,
  eventServices,
  expenses,
  tasks,
  agendaItems
};
