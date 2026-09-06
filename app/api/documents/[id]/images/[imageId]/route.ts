import { files, json, validId } from '@/lib/storage';
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id, imageId } = await context.params;
  if (!validId(id) || !validId(imageId) || imageId === 'sample')
    return json({ error: 'Không tìm thấy ảnh.' }, 404);
  const image = await files().get(`${id}/images/${imageId}`);
  if (!image) return json({ error: 'Không tìm thấy ảnh.' }, 404);
  return new Response(image.body, {
    headers: {
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
