import type { PDFDocumentProxy } from 'pdfjs-dist';
import { paint, type Workspace } from './annotations';
import { paintObjects } from './page-objects';
export async function exportDocument(
  pdf: PDFDocumentProxy,
  state: Workspace,
  name: string,
) {
  const { PDFDocument } = await import('pdf-lib');
  const output = await PDFDocument.create();
  for (let n = 1; n <= pdf.numPages; n++) {
    const p = await pdf.getPage(n),
      base = p.getViewport({ scale: 1 }),
      scale = Math.min(1.8, 2200 / Math.max(base.width, base.height)),
      viewport = p.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.ceil(viewport.width);
    c.height = Math.ceil(viewport.height);
    await p.render({ canvas: c, viewport }).promise;
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    paint(
      ctx,
      state.strokes.filter((s) => s.page === n),
    );
    await paintObjects(
      ctx,
      (state.objects || []).filter((object) => object.page === n),
    );
    const png = await output.embedPng(c.toDataURL('image/png'));
    output
      .addPage([base.width, base.height])
      .drawImage(png, { x: 0, y: 0, width: base.width, height: base.height });
  }
  if (state.notes.length) {
    const c = document.createElement('canvas');
    c.width = 1190;
    c.height = 1684;
    const ctx = c.getContext('2d')!;
    let y = 150;
    const reset = () => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#292d39';
      ctx.font = 'bold 38px Arial';
      ctx.fillText('Ghi chú · ' + name.slice(0, 35), 90, 95);
      ctx.font = '26px Arial';
      y = 160;
    };
    const flush = async () => {
      const png = await output.embedPng(c.toDataURL());
      output
        .addPage([595, 842])
        .drawImage(png, { x: 0, y: 0, width: 595, height: 842 });
    };
    reset();
    for (const note of state.notes) {
      let line = '';
      const text = 'Trang ' + note.page + ' — ' + note.text;
      // Character wrapping also handles long URLs and Vietnamese text.
      for (const char of text) {
        if (char === '\n' || ctx.measureText(line + char).width > 1000) {
          if (y > 1560) {
            await flush();
            reset();
          }
          ctx.fillText(line, 90, y);
          y += 40;
          line = '';
          if (char === '\n') continue;
        }
        line += char;
      }
      if (y > 1560) {
        await flush();
        reset();
      }
      ctx.fillText(line, 90, y);
      y += 75;
    }
    await flush();
  }
  const data = await output.save(),
    blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/\.pdf$/i, '') + '-ghi-chu.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
