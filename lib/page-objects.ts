import type { PageObject, TextFormat } from './annotations';

export function textFormat(object: Partial<TextFormat>): TextFormat {
  return {
    fontFamily: object.fontFamily ?? 'Arial',
    fontSize: object.fontSize ?? 20,
    color: object.color ?? '#292d39',
    bold: object.bold ?? false,
    italic: object.italic ?? false,
    underline: object.underline ?? false,
    strikethrough: object.strikethrough ?? false,
    align: object.align ?? 'left',
    lineHeight: object.lineHeight ?? 1.3,
  };
}
export function fontCss(object: Partial<TextFormat>): string {
  const style = textFormat(object);
  return `${style.italic ? 'italic' : 'normal'} ${style.bold ? '700' : '400'} ${style.fontSize}px "${style.fontFamily}"`;
}
export function textDecoration(object: Partial<TextFormat>): string {
  return (
    [
      object.underline ? 'underline' : '',
      object.strikethrough ? 'line-through' : '',
    ]
      .filter(Boolean)
      .join(' ') || 'none'
  );
}
export function textAnchor(
  object: Partial<TextFormat>,
): 'start' | 'middle' | 'end' {
  return object.align === 'center'
    ? 'middle'
    : object.align === 'right'
      ? 'end'
      : 'start';
}
export function textX(object: Extract<PageObject, { kind: 'text' }>): number {
  return (
    object.x +
    (object.align === 'center'
      ? object.width / 2
      : object.align === 'right'
        ? object.width
        : 0)
  );
}
export async function ensureTextFont(object: Partial<TextFormat>) {
  if (typeof document !== 'undefined' && document.fonts)
    await document.fonts.load(fontCss(object), 'Tiếng Việt Aa');
}

export function wrapText(
  text: string,
  width: number,
  measure: (text: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (line && measure(line + word) > width) {
        lines.push(line.trimEnd());
        line = '';
      }
      for (const char of word) {
        if (line && measure(line + char) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function textLines(
  object: Extract<PageObject, { kind: 'text' }>,
): string[] {
  const ctx = document.createElement('canvas').getContext('2d')!;
  ctx.font = fontCss(object);
  return wrapText(
    object.text,
    object.width,
    (text) => ctx.measureText(text).width,
  );
}

export function fitObject(
  object: PageObject,
  page: { width: number; height: number },
): PageObject {
  const width = Math.min(page.width, Math.max(20, object.width));
  let height =
    object.kind === 'image'
      ? (object.height * width) / object.width
      : textLines({ ...object, width }).length *
          object.fontSize *
          (object.lineHeight ?? 1.3) +
        4;
  let fittedWidth = width;
  if (object.kind === 'image' && height > page.height) {
    fittedWidth *= page.height / height;
    height = page.height;
  }
  return {
    ...object,
    width: fittedWidth,
    height,
    x: Math.max(0, Math.min(page.width - fittedWidth, object.x)),
    y: Math.max(0, Math.min(Math.max(0, page.height - height), object.y)),
  };
}

export async function paintObjects(
  ctx: CanvasRenderingContext2D,
  objects: PageObject[],
) {
  for (const object of objects) {
    ctx.save();
    try {
      if (object.kind === 'image') {
        const image = new Image();
        image.src = object.src;
        await image.decode();
        ctx.drawImage(image, object.x, object.y, object.width, object.height);
      } else {
        await ensureTextFont(object);
        ctx.font = fontCss(object);
        ctx.fillStyle = object.color;
        ctx.textBaseline = 'alphabetic';
        const lines = wrapText(
          object.text,
          object.width,
          (text) => ctx.measureText(text).width,
        );
        lines.forEach((line, i) => {
          const lineWidth = ctx.measureText(line).width;
          const x =
            object.x +
            (object.align === 'center'
              ? (object.width - lineWidth) / 2
              : object.align === 'right'
                ? object.width - lineWidth
                : 0);
          const y =
            object.y +
            object.fontSize +
            i * object.fontSize * (object.lineHeight ?? 1.3);
          ctx.fillText(line, x, y);
          if (object.underline || object.strikethrough) {
            ctx.strokeStyle = object.color;
            ctx.lineWidth = Math.max(0.7, object.fontSize / 16);
            ctx.beginPath();
            if (object.underline) {
              ctx.moveTo(x, y + object.fontSize * 0.12);
              ctx.lineTo(x + lineWidth, y + object.fontSize * 0.12);
            }
            if (object.strikethrough) {
              ctx.moveTo(x, y - object.fontSize * 0.3);
              ctx.lineTo(x + lineWidth, y - object.fontSize * 0.3);
            }
            ctx.stroke();
          }
        });
      }
    } finally {
      ctx.restore();
    }
  }
}
