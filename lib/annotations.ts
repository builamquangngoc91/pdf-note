export type Point = { x: number; y: number };
export type Stroke = {
  id: string;
  page: number;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
};
export type Note = {
  id: string;
  page: number;
  text: string;
  createdAt: string;
};
export type FontFamily =
  | 'Arial'
  | 'Liberation Sans'
  | 'Liberation Serif'
  | 'Liberation Mono';
export type TextFormat = {
  fontFamily: FontFamily;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
};
export type PageObject = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
} & (
  | ({ kind: 'text'; text: string; fontSize: number; color: string } & Partial<
      Omit<TextFormat, 'fontSize' | 'color'>
    >)
  | { kind: 'image'; src: string; alt: string }
);
export type Workspace = {
  strokes: Stroke[];
  notes: Note[];
  objects: PageObject[];
};
export type Doc = {
  id: string;
  name: string;
  updatedAt: string;
  folderId?: string | null;
  lastOpenedAt?: string | null;
};
export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};
export type Version = {
  id: string;
  documentId: string;
  documentName: string;
  createdAt: string;
  kind: string;
};
export const empty = (): Workspace => ({ strokes: [], notes: [], objects: [] });
export function validate(input: unknown): Workspace | null {
  if (!input || typeof input !== 'object') return null;
  const d = input as Workspace;
  const page = (n: number) => Number.isInteger(n) && n >= 1 && n <= 100;
  if (
    !Array.isArray(d.strokes) ||
    !Array.isArray(d.notes) ||
    d.strokes.length > 10000 ||
    d.notes.length > 1000
  )
    return null;
  if (
    !d.strokes.every(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        s.id.length <= 100 &&
        page(s.page) &&
        /^#[0-9a-f]{6}$/i.test(s.color) &&
        Number.isFinite(s.width) &&
        s.width >= 0.5 &&
        s.width <= 50 &&
        [1, 0.35].includes(s.opacity) &&
        Array.isArray(s.points) &&
        s.points.length > 0 &&
        s.points.length <= 10000 &&
        s.points.every(
          (p) =>
            p &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            p.x >= 0 &&
            p.y >= 0 &&
            p.x <= 20000 &&
            p.y <= 20000,
        ),
    )
  )
    return null;
  if (
    !d.notes.every(
      (n) =>
        n &&
        typeof n.id === 'string' &&
        n.id.length <= 100 &&
        page(n.page) &&
        typeof n.text === 'string' &&
        n.text.trim().length > 0 &&
        n.text.length <= 5000 &&
        typeof n.createdAt === 'string' &&
        Number.isFinite(Date.parse(n.createdAt)),
    )
  )
    return null;
  const objects = d.objects === undefined ? [] : d.objects;
  if (
    !Array.isArray(objects) ||
    objects.length > 1000 ||
    !objects.every((o) => {
      if (!o || typeof o.id !== 'string' || o.id.length > 100 || !page(o.page))
        return false;
      if (
        ![o.x, o.y, o.width, o.height].every(Number.isFinite) ||
        o.x < 0 ||
        o.y < 0 ||
        o.x > 20000 ||
        o.y > 20000 ||
        o.width < 1 ||
        o.height < 1 ||
        o.width > 20000 ||
        o.height > 20000
      )
        return false;
      if (o.kind === 'text')
        return (
          typeof o.text === 'string' &&
          o.text.trim().length > 0 &&
          o.text.length <= 5000 &&
          Number.isFinite(o.fontSize) &&
          o.fontSize >= 8 &&
          o.fontSize <= 120 &&
          /^#[0-9a-f]{6}$/i.test(o.color) &&
          (o.fontFamily === undefined ||
            [
              'Arial',
              'Liberation Sans',
              'Liberation Serif',
              'Liberation Mono',
            ].includes(o.fontFamily)) &&
          ['bold', 'italic', 'underline', 'strikethrough'].every(
            (key) =>
              o[key as keyof typeof o] === undefined ||
              typeof o[key as keyof typeof o] === 'boolean',
          ) &&
          (o.align === undefined ||
            ['left', 'center', 'right'].includes(o.align)) &&
          (o.lineHeight === undefined ||
            (Number.isFinite(o.lineHeight) &&
              o.lineHeight >= 1 &&
              o.lineHeight <= 3))
        );
      if (o.kind === 'image')
        return (
          typeof o.src === 'string' &&
          /^\/api\/documents\/(sample|[a-f0-9-]{36})\/images\/[a-f0-9-]{36}$/.test(
            o.src,
          ) &&
          typeof o.alt === 'string' &&
          o.alt.length <= 200
        );
      return false;
    })
  )
    return null;
  return { strokes: d.strokes, notes: d.notes, objects };
}
export function hit(s: Stroke, p: Point, radius = 10): boolean {
  const r = radius + s.width / 2;
  if (s.points.length === 1)
    return Math.hypot(p.x - s.points[0].x, p.y - s.points[0].y) <= r;
  return s.points.slice(1).some((b, i) => {
    const a = s.points[i],
      dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) <= r;
  });
}
export function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const s of strokes) {
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (s.points.length === 1) {
      ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
    ctx.restore();
  }
}

// getRandomValues also works on HTTP LAN/Tailscale origins.
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    h.slice(12, 16),
    h.slice(16, 20),
    h.slice(20),
  ].join('-');
}
