import { db, files } from './storage';
import { empty, type Workspace } from './annotations';
async function hash(body: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
async function snapshot(documentId: string, body: string, kind: string) {
  const id = crypto.randomUUID(),
    createdAt = new Date().toISOString();
  await files().put(`${documentId}/versions/${id}.json`, body, {
    httpMetadata: { contentType: 'application/json' },
  });
  await db()
    .prepare(
      'INSERT INTO versions (id,document_id,created_at,kind,hash) VALUES (?,?,?,?,?)',
    )
    .bind(id, documentId, createdAt, kind, await hash(body))
    .run();
}
export async function saveVersion(
  documentId: string,
  state: Workspace,
  kind = 'autosave',
) {
  const body = JSON.stringify(state),
    digest = await hash(body);
  const latest = await db()
    .prepare(
      'SELECT hash FROM versions WHERE document_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',
    )
    .bind(documentId)
    .first<{ hash: string }>();
  if (!latest) {
    const previous = await files().get(`${documentId}/annotations.json`);
    await snapshot(
      documentId,
      previous ? await previous.text() : JSON.stringify(empty()),
      'initial',
    );
  }
  if (latest?.hash !== digest || kind === 'restore')
    await snapshot(documentId, body, kind);
  await files().put(`${documentId}/annotations.json`, body, {
    httpMetadata: { contentType: 'application/json' },
  });
  if (documentId !== 'sample')
    await db()
      .prepare('UPDATE documents SET updated_at=? WHERE id=?')
      .bind(new Date().toISOString(), documentId)
      .run();
}
