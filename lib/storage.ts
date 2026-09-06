import { env } from 'cloudflare:workers';
export const db = () => env.DB;
export const files = () => env.FILES;
export const validId = (id: string) =>
  id === 'sample' || /^[a-f0-9-]{36}$/.test(id);
export function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  return (
    (!origin || origin === new URL(request.url).origin) &&
    request.headers.get('Sec-Fetch-Site') !== 'cross-site'
  );
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export async function readLimited(request: Request, limit: number) {
  if (Number(request.headers.get('Content-Length')) > limit)
    throw new Error('too-large');
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error('too-large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
