import { db, files, json, readLimited, sameOrigin } from '@/lib/storage';
export async function GET() {
  try {
    const r = await db()
      .prepare(
        'SELECT id, name, updated_at AS updatedAt,folder_id AS folderId,last_opened_at AS lastOpenedAt FROM documents ORDER BY updated_at DESC',
      )
      .all();
    return json(r.results);
  } catch {
    return json({ error: 'Không tải được thư viện.' }, 503);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: 'Chỉ chấp nhận yêu cầu cùng origin.' }, 403);
  if (request.headers.get('Content-Type') !== 'application/pdf')
    return json({ error: 'Vui lòng chọn PDF.' }, 415);
  try {
    const bytes = await readLimited(request, 25 * 1024 * 1024);
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
      return json({ error: 'File không phải PDF hợp lệ.' }, 400);
    const name = decodeURIComponent(
      request.headers.get('X-File-Name') || 'Document.pdf',
    ).slice(0, 200);
    const folderId = request.headers.get('X-Folder-Id') || null;
    if (
      folderId &&
      !(await db()
        .prepare('SELECT id FROM folders WHERE id=?')
        .bind(folderId)
        .first())
    )
      return json({ error: 'Không tìm thấy thư mục.' }, 400);
    const id = crypto.randomUUID(),
      updatedAt = new Date().toISOString();
    await files().put(id + '/document.pdf', bytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });
    try {
      await db()
        .prepare(
          'INSERT INTO documents (id,name,updated_at,folder_id,last_opened_at) VALUES (?,?,?,?,?)',
        )
        .bind(id, name, updatedAt, folderId, updatedAt)
        .run();
    } catch (e) {
      await files().delete(id + '/document.pdf');
      throw e;
    }
    return json(
      { id, name, updatedAt, folderId, lastOpenedAt: updatedAt },
      201,
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && e.message === 'too-large'
            ? 'PDF phải nhỏ hơn 25 MB.'
            : 'Không tải lên được PDF.',
      },
      e instanceof Error && e.message === 'too-large' ? 413 : 500,
    );
  }
}
