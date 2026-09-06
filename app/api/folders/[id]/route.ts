import { db, json, readLimited, sameOrigin, validId } from '@/lib/storage';
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return json({ error: 'Origin không hợp lệ.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return json({ error: 'Yêu cầu JSON.' }, 415);
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Không tìm thấy thư mục.' }, 404);
  try {
    const { name } = JSON.parse(
      new TextDecoder().decode(await readLimited(request, 4096)),
    );
    if (typeof name !== 'string' || !name.trim() || name.length > 100)
      return json({ error: 'Tên thư mục không hợp lệ.' }, 400);
    const result = await db()
      .prepare('UPDATE folders SET name=? WHERE id=?')
      .bind(name.trim(), id)
      .run();
    return result.meta.changes
      ? json({ saved: true })
      : json({ error: 'Không tìm thấy thư mục.' }, 404);
  } catch {
    return json({ error: 'Không đổi tên được thư mục.' }, 400);
  }
}
