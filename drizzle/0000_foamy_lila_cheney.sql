CREATE TABLE `survey_display_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_name` text NOT NULL,
	`brand` text NOT NULL,
	`specifications` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `survey_dropdown_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`value` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `survey_sales_persons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `survey_surveys` (
	`id` text PRIMARY KEY NOT NULL,
	`project_name` text NOT NULL,
	`customer_name` text NOT NULL,
	`sales_person_id` integer,
	`status` text DEFAULT 'synced' NOT NULL,
	`doc_url` text,
	`pdf_url` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`request_date` text,
	`location_lat` real,
	`location_lng` real,
	`location_address` text,
	`quotation_deadline` text,
	`budget` text,
	`existing_images` text,
	`contact_name` text,
	`contact_phone` text,
	`survey_date` text,
	`rooms_data` text,
	FOREIGN KEY (`sales_person_id`) REFERENCES `survey_sales_persons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`position` text NOT NULL,
	`active` integer DEFAULT 1,
	`vacation_quota` real DEFAULT 12,
	`created_at` text,
	`line_user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);