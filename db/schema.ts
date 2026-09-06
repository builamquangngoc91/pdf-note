import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  createdAt: text('created_at').notNull(),
});
export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  updatedAt: text('updated_at').notNull(),
  folderId: text('folder_id'),
  lastOpenedAt: text('last_opened_at'),
});
export const versions = sqliteTable(
  'versions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id').notNull(),
    createdAt: text('created_at').notNull(),
    kind: text('kind').notNull(),
    hash: text('hash').notNull(),
  },
  (table) => [
    index('versions_document_date').on(table.documentId, table.createdAt),
  ],
);
