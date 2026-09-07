'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, TextLayer } from 'pdfjs-dist';

/** Native DOM selection works on HTTP as well as HTTPS, without clipboard permissions. */
export function PdfTextLayer({
  pdf,
  page,
  width,
  active,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  width: number;
  active: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Đang tải chữ…');

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const element = document.createElement('div');
    element.className = 'pdf-text-layer';
    container.appendChild(element);
    let cancelled = false;
    let layer: TextLayer | undefined;
    setStatus('Đang tải chữ…');

    void (async () => {
      const [pdfPage, { TextLayer }] = await Promise.all([
        pdf.getPage(page),
        import('pdfjs-dist'),
      ]);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: width / base.width });
      // PDF.js includes UserUnit in the viewport scale used by its text CSS.
      element.style.setProperty(
        '--total-scale-factor',
        String(viewport.scale * pdfPage.userUnit),
      );
      layer = new TextLayer({
        container: element,
        viewport,
        textContentSource: pdfPage.streamTextContent(),
      });
      await layer.render();
      if (!cancelled)
        setStatus(
          layer.textContentItemsStr.some((text) => text.trim())
            ? ''
            : 'Trang này không có lớp chữ. PDF scan cần OCR để sao chép.',
        );
    })().catch(() => {
      if (!cancelled)
        setStatus('Không tải được lớp chữ. Hãy mở lại trang để thử lại.');
    });

    return () => {
      cancelled = true;
      layer?.cancel();
      const selection = window.getSelection();
      if (
        selection &&
        (element.contains(selection.anchorNode) ||
          element.contains(selection.focusNode))
      ) {
        selection.removeAllRanges();
      }
      element.remove();
    };
  }, [pdf, page, width]);

  useEffect(() => {
    if (active) return;
    const selection = window.getSelection();
    if (selection && host.current?.contains(selection.anchorNode))
      selection.removeAllRanges();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const copy = (event: ClipboardEvent) => {
      const selection = window.getSelection();
      if (
        !event.clipboardData ||
        !selection ||
        selection.isCollapsed ||
        !host.current?.contains(selection.anchorNode) ||
        !host.current?.contains(selection.focusNode)
      )
        return;
      // Copy readable text, without the transparent overlay's HTML styling.
      event.clipboardData.setData(
        'text/plain',
        selection.toString().replace(/\u0000/g, ''),
      );
      event.preventDefault();
    };
    document.addEventListener('copy', copy);
    return () => document.removeEventListener('copy', copy);
  }, [active]);

  return (
    <>
      <div
        ref={host}
        className={'pdf-text-overlay' + (active ? ' active' : '')}
        aria-label={'Chữ trong PDF trang ' + page}
      />
      {active && status && (
        <div className="pdf-text-status" role="status">
          {status}
        </div>
      )}
    </>
  );
}
