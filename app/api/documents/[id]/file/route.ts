import { files, validId, json } from '@/lib/storage';
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!validId(id) || id === 'sample')
    return json({ error: 'Không tìm thấy PDF.' }, 404);
  const object = await files().get(id + '/document.pdf');
  if (!object) return json({ error: 'Không tìm thấy PDF.' }, 404);
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(object.size),
      'Cache-Control': 'private, no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
