CREATE TABLE `folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`created_at` text NOT NULL,
	`kind` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `versions_document_date` ON `versions` (`document_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `documents` ADD `folder_id` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `last_opened_at` text;