import {
  db,
  files,
  json,
  readLimited,
  sameOrigin,
  validId,
} from '@/lib/storage';
import { empty, validate } from '@/lib/annotations';
import { saveVersion } from '@/lib/versions';
type Context = { params: Promise<{ id: string }> };
async function exists(id: string) {
  return (
    id === 'sample' ||
    Boolean(
      await db()
        .prepare('SELECT id FROM documents WHERE id=?')
        .bind(id)
        .first(),
    )
  );
}
export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Không tìm thấy tài liệu.' }, 404);
  try {
    if (!(await exists(id)))
      return json({ error: 'Không tìm thấy tài liệu.' }, 404);
    const object = await files().get(id + '/annotations.json');
    return json(object ? await object.json() : empty());
  } catch {
    return json({ error: 'Không tải được ghi chú.' }, 503);
  }
}
export async function PUT(request: Request, context: Context) {
  if (!sameOrigin(request))
    return json({ error: 'Chỉ chấp nhận yêu cầu cùng origin.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return json({ error: 'Yêu cầu JSON.' }, 415);
  const { id } = await context.params;
  if (!validId(id)) return json({ error: 'Không tìm thấy tài liệu.' }, 404);
  try {
    const bytes = await readLimited(request, 8 * 1024 * 1024);
    let input;
    try {
      input = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ error: 'JSON không hợp lệ.' }, 400);
    }
    const state = validate(input);
    if (!state) return json({ error: 'Ghi chú không hợp lệ.' }, 400);
    if (
      state.objects.some(
        (o) =>
          o.kind === 'image' &&
          !o.src.startsWith(`/api/documents/${id}/images/`),
      )
    )
      return json({ error: 'Ảnh không thuộc tài liệu này.' }, 400);
    if (!(await exists(id)))
      return json({ error: 'Không tìm thấy tài liệu.' }, 404);
    await saveVersion(id, state);
    return json({ saved: true });
  } catch (e) {
    return json(
      { error: 'Không lưu được ghi chú.' },
      e instanceof Error && e.message === 'too-large' ? 413 : 500,
    );
  }
}
export async function PATCH(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: 'Origin không hợp lệ.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return json({ error: 'Yêu cầu JSON.' }, 415);
  const { id } = await context.params;
  if (!validId(id) || id === 'sample')
    return json({ error: 'Không thể đổi tài liệu mẫu.' }, 400);
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await readLimited(request, 4096)),
    );
    const existing = await db()
      .prepare('SELECT id,name,folder_id FROM documents WHERE id=?')
      .bind(id)
      .first<{ id: string; name: string; folder_id: string | null }>();
    if (!existing) return json({ error: 'Không tìm thấy tài liệu.' }, 404);
    const name = body.name === undefined ? existing.name : body.name;
    const folderId =
      body.folderId === undefined ? existing.folder_id : body.folderId;
    if (typeof name !== 'string' || !name.trim() || name.length > 200)
      return json({ error: 'Tên tài liệu không hợp lệ.' }, 400);
    if (
      folderId !== null &&
      (typeof folderId !== 'string' ||
        !validId(folderId) ||
        !(await db()
          .prepare('SELECT id FROM folders WHERE id=?')
          .bind(folderId)
          .first()))
    )
      return json({ error: 'Không tìm thấy thư mục.' }, 400);
    await db()
      .prepare('UPDATE documents SET name=?,folder_id=? WHERE id=?')
      .bind(name.trim(), folderId, id)
      .run();
    return json({ saved: true });
  } catch {
    return json({ error: 'Không cập nhật được tài liệu.' }, 400);
  }
}
