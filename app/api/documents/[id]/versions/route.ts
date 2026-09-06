import { db, json, validId } from '@/lib/storage';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Tài liệu không hợp lệ.' }, 400);
  if (
    id !== 'sample' &&
    !(await db()
      .prepare('SELECT id FROM documents WHERE id=?')
      .bind(id)
      .first())
  )
    return json({ error: 'Không tìm thấy tài liệu.' }, 404);
  const result = await db()
    .prepare(
      "SELECT v.id,v.document_id AS documentId,COALESCE(d.name,'The art of paying attention.pdf') AS documentName,v.created_at AS createdAt,v.kind FROM versions v LEFT JOIN documents d ON d.id=v.document_id WHERE v.document_id=? ORDER BY v.created_at DESC,v.rowid DESC LIMIT 100",
    )
    .bind(id)
    .all();
  return json(result.results);
}
