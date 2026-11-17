CREATE TABLE `agenda_items` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`responsible_person` text NOT NULL,
	`location_detail` text,
	`notes` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_agenda_time_range" CHECK("agenda_items"."start_time" < "agenda_items"."end_time")
);
--> statement-breakpoint
CREATE INDEX `idx_agenda_event` ON `agenda_items` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_agenda_order` ON `agenda_items` (`event_id`,`order_index`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_id` text NOT NULL,
	`user_id` text,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_user_id_unique` ON `clients` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_clients_organizer` ON `clients` (`organizer_id`);--> statement-breakpoint
CREATE INDEX `idx_clients_email` ON `clients` (`email`);--> statement-breakpoint
CREATE TABLE `event_services` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`service_id` text,
	`service_name` text DEFAULT '' NOT NULL,
	`vendor_name` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`agreed_price` real NOT NULL,
	`status` text DEFAULT 'quoted' NOT NULL,
	`contract_url` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_event_services_category" CHECK("event_services"."category" IN ('catering', 'photography', 'music_dj', 'venue', 'decoration', 'flowers', 'security', 'transport', 'other')),
	CONSTRAINT "chk_event_services_price" CHECK("event_services"."agreed_price" >= 0),
	CONSTRAINT "chk_event_services_status" CHECK("event_services"."status" IN ('quoted', 'contracted', 'paid', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_event_services_event` ON `event_services` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_event_services_service` ON `event_services` (`service_id`);--> statement-breakpoint
CREATE TABLE `event_tables` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`table_number` integer NOT NULL,
	`label` text,
	`capacity` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_event_tables_number" CHECK("event_tables"."table_number" > 0),
	CONSTRAINT "chk_event_tables_capacity" CHECK("event_tables"."capacity" > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_event_tables_event` ON `event_tables` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_event_tables_event_number` ON `event_tables` (`event_id`,`table_number`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_id` text NOT NULL,
	`client_id` text NOT NULL,
	`title` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`event_date` text NOT NULL,
	`venue_name` text NOT NULL,
	`venue_address` text,
	`initial_budget` real DEFAULT 0 NOT NULL,
	`estimated_guests` integer DEFAULT 0 NOT NULL,
	`cancellation_reason` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_events_type" CHECK("events"."event_type" IN ('wedding', 'fifteen_years', 'corporate', 'graduation', 'social')),
	CONSTRAINT "chk_events_status" CHECK("events"."status" IN ('draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled')),
	CONSTRAINT "chk_events_budget" CHECK("events"."initial_budget" >= 0),
	CONSTRAINT "chk_events_guests" CHECK("events"."estimated_guests" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_events_organizer` ON `events` (`organizer_id`);--> statement-breakpoint
CREATE INDEX `idx_events_client` ON `events` (`client_id`);--> statement-breakpoint
CREATE INDEX `idx_events_date` ON `events` (`event_date`);--> statement-breakpoint
CREATE INDEX `idx_events_status` ON `events` (`status`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`event_service_id` text,
	`concept` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`due_date` text,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`receipt_url` text,
	`paid_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_service_id`) REFERENCES `event_services`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_expenses_amount" CHECK("expenses"."amount" > 0),
	CONSTRAINT "chk_expenses_status" CHECK("expenses"."payment_status" IN ('pending', 'partial', 'paid'))
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_event` ON `expenses` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_expenses_status` ON `expenses` (`payment_status`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`table_number` integer,
	`rsvp_status` text DEFAULT 'pending' NOT NULL,
	`plus_ones` integer DEFAULT 0 NOT NULL,
	`meal_preference` text DEFAULT 'standard' NOT NULL,
	`allergies` text,
	`has_critical_allergies` integer DEFAULT false NOT NULL,
	`dietary_restrictions` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`,`table_number`) REFERENCES `event_tables`(`event_id`,`table_number`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_guests_rsvp" CHECK("guests"."rsvp_status" IN ('pending', 'confirmed', 'declined')),
	CONSTRAINT "chk_guests_plus_ones" CHECK("guests"."plus_ones" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_guests_event` ON `guests` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_guests_rsvp` ON `guests` (`rsvp_status`);--> statement-breakpoint
CREATE INDEX `idx_guests_table` ON `guests` (`event_id`,`table_number`);--> statement-breakpoint
CREATE INDEX `idx_guests_meal` ON `guests` (`event_id`,`meal_preference`);--> statement-breakpoint
CREATE INDEX `idx_guests_critical` ON `guests` (`event_id`,`has_critical_allergies`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`base_price` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_services_price" CHECK("services"."base_price" >= 0)
);
--> statement-breakpoint
CREATE INDEX `idx_services_vendor` ON `services` (`vendor_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`assigned_to` text,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`due_date` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_tasks_priority" CHECK("tasks"."priority" IN ('low', 'medium', 'high', 'urgent')),
	CONSTRAINT "chk_tasks_status" CHECK("tasks"."status" IN ('todo', 'in_progress', 'completed', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_event` ON `tasks` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due_date` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	CONSTRAINT "chk_users_role" CHECK("users"."role" IN ('admin', 'organizer', 'client'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`organizer_id` text NOT NULL,
	`business_name` text NOT NULL,
	`category` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`rating` real DEFAULT 5 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "chk_vendors_category" CHECK("vendors"."category" IN ('catering', 'photography', 'music_dj', 'venue', 'decoration', 'flowers', 'security', 'transport', 'other')),
	CONSTRAINT "chk_vendors_rating" CHECK("vendors"."rating" >= 1.0 AND "vendors"."rating" <= 5.0)
);
--> statement-breakpoint
CREATE INDEX `idx_vendors_organizer` ON `vendors` (`organizer_id`);--> statement-breakpoint
CREATE INDEX `idx_vendors_category` ON `vendors` (`category`);