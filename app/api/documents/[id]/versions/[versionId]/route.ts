import { db, files, json, sameOrigin, validId } from '@/lib/storage';
import { validate } from '@/lib/annotations';
import { saveVersion } from '@/lib/versions';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  if (!sameOrigin(request)) return json({ error: 'Origin không hợp lệ.' }, 403);
  const { id, versionId } = await context.params;
  if (!validId(id) || !validId(versionId))
    return json({ error: 'Không tìm thấy phiên bản.' }, 404);
  if (
    !(await db()
      .prepare('SELECT id FROM versions WHERE id=? AND document_id=?')
      .bind(versionId, id)
      .first())
  )
    return json({ error: 'Không tìm thấy phiên bản.' }, 404);
  const object = await files().get(`${id}/versions/${versionId}.json`);
  if (!object) return json({ error: 'Không tìm thấy phiên bản.' }, 404);
  const state = validate(await object.json());
  if (!state) return json({ error: 'Phiên bản không hợp lệ.' }, 400);
  await saveVersion(id, state, 'restore');
  return json(state);
}
