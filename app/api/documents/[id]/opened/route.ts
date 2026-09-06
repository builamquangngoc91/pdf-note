import { db, json, sameOrigin, validId } from '@/lib/storage';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return json({ error: 'Origin không hợp lệ.' }, 403);
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Không tìm thấy tài liệu.' }, 404);
  if (id !== 'sample')
    await db()
      .prepare('UPDATE documents SET last_opened_at=? WHERE id=?')
      .bind(new Date().toISOString(), id)
      .run();
  return json({ saved: true });
}
