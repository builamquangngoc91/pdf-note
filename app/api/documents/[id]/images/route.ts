import {
  db,
  files,
  json,
  readLimited,
  sameOrigin,
  validId,
} from '@/lib/storage';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return json({ error: 'Chỉ chấp nhận yêu cầu cùng origin.' }, 403);
  const { id } = await context.params;
  if (
    !validId(id) ||
    (id !== 'sample' &&
      !(await db()
        .prepare('SELECT id FROM documents WHERE id=?')
        .bind(id)
        .first()))
  )
    return json({ error: 'Không tìm thấy tài liệu.' }, 404);
  if (request.headers.get('Content-Type') !== 'image/png')
    return json({ error: 'Yêu cầu ảnh PNG.' }, 415);
  try {
    const bytes = await readLimited(request, 8 * 1024 * 1024);
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 24 || !signature.every((byte, i) => bytes[i] === byte))
      return json({ error: 'Ảnh không hợp lệ.' }, 400);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16),
      height = view.getUint32(20);
    if (!width || !height || width > 2400 || height > 2400)
      return json({ error: 'Ảnh quá lớn.' }, 400);
    const imageId = crypto.randomUUID();
    await files().put(`${id}/images/${imageId}`, bytes, {
      httpMetadata: { contentType: 'image/png' },
    });
    return json(
      { src: `/api/documents/${id}/images/${imageId}`, width, height },
      201,
    );
  } catch (e) {
    return json(
      { error: 'Không tải lên được ảnh (tối đa 8 MB sau xử lý).' },
      e instanceof Error && e.message === 'too-large' ? 413 : 500,
    );
  }
}
