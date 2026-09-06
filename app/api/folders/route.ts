import { db, json, readLimited, sameOrigin, validId } from '@/lib/storage';
export async function GET() {
  const result = await db()
    .prepare(
      'SELECT id,name,parent_id AS parentId,created_at AS createdAt FROM folders ORDER BY name COLLATE NOCASE',
    )
    .all();
  return json(result.results);
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Origin không hợp lệ.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return json({ error: 'Yêu cầu JSON.' }, 415);
  try {
    const { name, parentId = null } = JSON.parse(
      new TextDecoder().decode(await readLimited(request, 4096)),
    );
    if (typeof name !== 'string' || !name.trim() || name.length > 100)
      return json({ error: 'Tên thư mục cần từ 1–100 ký tự.' }, 400);
    if (
      parentId !== null &&
      (typeof parentId !== 'string' ||
        !validId(parentId) ||
        !(await db()
          .prepare('SELECT id FROM folders WHERE id=?')
          .bind(parentId)
          .first()))
    )
      return json({ error: 'Không tìm thấy thư mục cha.' }, 400);
    const id = crypto.randomUUID(),
      createdAt = new Date().toISOString();
    await db()
      .prepare(
        'INSERT INTO folders(id,name,parent_id,created_at) VALUES (?,?,?,?)',
      )
      .bind(id, name.trim(), parentId, createdAt)
      .run();
    return json({ id, name: name.trim(), parentId, createdAt }, 201);
  } catch {
    return json({ error: 'Không tạo được thư mục.' }, 400);
  }
}
