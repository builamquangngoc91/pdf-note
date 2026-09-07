'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  BookOpen,
  PenLine,
  Highlighter,
  Eraser,
  MousePointer2,
  Undo2,
  Redo2,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  Plus,
  PanelLeft,
  PanelRight,
  Check,
  FileText,
  X,
  StickyNote,
  Search,
  Loader2,
  ArrowUpRight,
  Type,
  ImagePlus,
  History,
} from 'lucide-react';
import { FileLibrary } from '@/components/file-library';
import { DocumentHistory } from '@/components/document-history';
import { PdfTextLayer } from '@/components/pdf-text-layer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';
import {
  type Stroke,
  type Note,
  type Doc,
  type Point,
  type Workspace,
  type Version,
  empty,
  validate,
  hit,
  newId,
} from '@/lib/annotations';
import { PdfObjects, type ObjectsHandle } from '@/components/pdf-objects';
import { exportDocument } from '@/lib/export';
import { WheelPager } from '@/lib/wheel-pager';
type Tool = 'select' | 'pen' | 'highlight' | 'eraser' | 'text';
const colors = ['#292d39', '#5265db', '#e2746b', '#53a68a', '#f3cb53'];
const tools = [
  { id: 'select', icon: MousePointer2, name: 'Chọn chữ / Di chuyển', key: 'V' },
  { id: 'pen', icon: PenLine, name: 'Bút viết', key: 'P' },
  { id: 'highlight', icon: Highlighter, name: 'Đánh dấu', key: 'H' },
  { id: 'eraser', icon: Eraser, name: 'Tẩy nét', key: 'E' },
  { id: 'text', icon: Type, name: 'Thêm chữ', key: 'T' },
] as const;
const sample: Doc = {
  id: 'sample',
  name: 'The art of paying attention.pdf',
  updatedAt: '',
};
function IconButton({
  label,
  children,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={'icon-button ' + (active ? 'active' : '')}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
function Thumbnail({
  pdf,
  page,
  selected,
  onClick,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let disposed = false;
    let task: { cancel(): void } | undefined;
    void pdf
      .getPage(page)
      .then((p) => {
        if (disposed || !ref.current) return;
        const viewport = p.getViewport({
          scale: 144 / p.getViewport({ scale: 1 }).width,
        });
        ref.current.width = viewport.width;
        ref.current.height = viewport.height;
        const r = p.render({ canvas: ref.current, viewport });
        task = r;
        return r.promise;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, page]);
  return (
    <button
      className={'thumbnail ' + (selected ? 'selected' : '')}
      onClick={onClick}
      aria-label={'Đến trang ' + page}
      aria-current={selected ? 'page' : undefined}
    >
      <div className="thumbnail-paper">
        <canvas ref={ref} />
      </div>
      <span>{String(page).padStart(2, '0')}</span>
      {selected && <i />}
    </button>
  );
}
export default function Home() {
  useEffect(() => {
    if (window.innerWidth <= 900) setRightOpen(false);
    if (window.innerWidth <= 620) {
      setLeftOpen(false);
      setZoom(
        Math.max(
          50,
          Math.min(100, Math.floor(((window.innerWidth - 36) / 595) * 100)),
        ),
      );
    }
  }, []);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [doc, setDoc] = useState(sample);
  const [workspace, setWorkspace] = useState<Workspace>(empty()),
    [page, setPage] = useState(1),
    [dimensions, setDimensions] = useState({ width: 595, height: 842 });
  const [tool, setTool] = useState<Tool>('select'),
    [color, setColor] = useState(colors[1]),
    [width, setWidth] = useState(2.5),
    [zoom, setZoom] = useState(100);
  const [leftOpen, setLeftOpen] = useState(true),
    [rightOpen, setRightOpen] = useState(true),
    [library, setLibrary] = useState(false),
    [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(true),
    [exporting, setExporting] = useState(false),
    [status, setStatus] = useState('Đang mở tài liệu…'),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  const [draft, setDraft] = useState<Stroke | null>(null),
    [history, setHistory] = useState<Workspace[]>([]),
    [future, setFuture] = useState<Workspace[]>([]);
  const [historyDoc, setHistoryDoc] = useState<Doc | null>(null);
  const [renderedPage, setRenderedPage] = useState<{
    pdf: PDFDocumentProxy;
    page: number;
  } | null>(null);
  const wheelPager = useRef(new WheelPager());
  const wheelDestination = useRef<{
    pdf: PDFDocumentProxy;
    page: number;
    bottom: boolean;
  } | null>(null);
  const uploadFolder = useRef<string | null>(null),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectsRef = useRef<ObjectsHandle>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    svg = useRef<SVGSVGElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const current = useRef(workspace);
  current.current = workspace;
  const docRef = useRef(doc);
  docRef.current = doc;
  const dirty = useRef(false),
    saveQueue = useRef(Promise.resolve()),
    generation = useRef(0),
    livePdf = useRef<PDFDocumentLoadingTask | null>(null),
    drawing = useRef<Stroke | null>(null),
    eraserBefore = useRef<Workspace | null>(null);
  const pan = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const save = useCallback(async (id: string, state: Workspace) => {
    const pending = saveQueue.current
      .catch(() => {})
      .then(async () => {
        const body = JSON.stringify(state);
        const r = await fetch('/api/documents/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: body.length < 60000,
        });
        if (!r.ok) throw new Error('Chưa lưu được ghi chú. Vui lòng thử lại.');
      });
    saveQueue.current = pending;
    await pending;
  }, []);
  const openDocument = useCallback(
    async (record: Doc) => {
      const token = ++generation.current;
      setBusy(true);
      setReady(false);
      setError('');
      try {
        if (dirty.current) {
          await save(docRef.current.id, current.current);
          dirty.current = false;
        }
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const response = await fetch('/api/documents/' + record.id);
        if (!response.ok) throw new Error('Không tải được ghi chú.');
        const state = validate(await response.json());
        if (!state) throw new Error('Dữ liệu ghi chú không hợp lệ.');
        const loading = pdfjs.getDocument({
          url:
            record.id === 'sample'
              ? '/sample.pdf'
              : '/api/documents/' + record.id + '/file',
        });
        const next = await loading.promise;
        if (token !== generation.current) {
          await loading.destroy();
          return;
        }
        const previous = livePdf.current;
        livePdf.current = loading;
        setPdf(next);
        setDoc(record);
        setWorkspace(state);
        current.current = state;
        void fetch('/api/documents/' + record.id + '/opened', {
          method: 'POST',
        }).catch(() => {});
        setPage(1);
        setHistory([]);
        setFuture([]);
        setNoteText('');
        setLibrary(false);
        setStatus('Đã lưu');
        setReady(true);
        if (previous) void previous.destroy();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không mở được PDF.');
        setStatus('Không mở được tài liệu');
      } finally {
        if (token === generation.current) setBusy(false);
      }
    },
    [save],
  );
  useEffect(() => {
    void openDocument(sample);
    return () => {
      generation.current++;
      void livePdf.current?.destroy();
    };
  }, [openDocument]);
  useEffect(() => {
    if (!ready || !dirty.current) return;
    setStatus('Đang lưu…');
    const id = doc.id,
      snapshot = workspace;
    const timer = setTimeout(() => {
      void save(id, snapshot)
        .then(() => {
          if (current.current === snapshot && docRef.current.id === id) {
            dirty.current = false;
            setStatus('Đã lưu');
          }
        })
        .catch((e) => {
          setStatus('Chưa lưu');
          setError(e.message);
        });
    }, 650);
    saveTimer.current = timer;
    return () => clearTimeout(timer);
  }, [workspace, doc.id, ready, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let cancelled = false;
    let task: { cancel(): void } | undefined;
    void pdf
      .getPage(page)
      .then((p) => {
        if (cancelled || !canvas.current) return;
        const base = p.getViewport({ scale: 1 });
        setDimensions({ width: base.width, height: base.height });
        const viewport = p.getViewport({
          scale: Math.min(1.8, 2200 / Math.max(base.width, base.height)),
        });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        const r = p.render({ canvas: canvas.current, viewport });
        task = r;
        return r.promise.then(() => {
          if (!cancelled) setRenderedPage({ pdf, page });
        });
      })
      .catch((e) => {
        if (e.name !== 'RenderingCancelledException')
          setError('Không hiển thị được trang PDF.');
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page]);
  useEffect(() => {
    wheelPager.current = new WheelPager();
    wheelDestination.current = null;
  }, [pdf]);

  useLayoutEffect(() => {
    if (
      !stage.current ||
      renderedPage?.pdf !== pdf ||
      renderedPage?.page !== page
    )
      return;
    const destination = wheelDestination.current;
    stage.current.scrollTop =
      destination?.pdf === pdf &&
      destination.page === page &&
      destination.bottom
        ? stage.current.scrollHeight - stage.current.clientHeight
        : 0;
    wheelDestination.current = null;
  }, [renderedPage, pdf, page]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (
        !pdf ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        (event.target as Element).closest(
          'input, textarea, select, [contenteditable], .object-actions',
        )
      )
        return;
      if (
        busy ||
        !ready ||
        library ||
        historyDoc ||
        drawing.current ||
        eraserBefore.current ||
        pan.current ||
        wheelDestination.current ||
        renderedPage?.pdf !== pdf ||
        renderedPage?.page !== page
      ) {
        event.preventDefault();
        return;
      }
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1);
      const direction = wheelPager.current.step(
        delta,
        element.scrollTop,
        Math.max(0, element.scrollHeight - element.clientHeight),
        page,
        pdf.numPages,
        performance.now(),
      );
      if (direction === null) return;
      event.preventDefault();
      if (!direction) return;
      const next = page + direction;
      wheelDestination.current = { pdf, page: next, bottom: direction < 0 };
      setPage(next);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [pdf, page, busy, ready, library, historyDoc, renderedPage]);

  function update(next: Workspace) {
    const previous = current.current;
    setHistory((h) => [...h.slice(-49), previous]);
    setFuture([]);
    dirty.current = true;
    current.current = next;
    setWorkspace(next);
  }
  function undo() {
    if (!history.length) return;
    const before = current.current,
      next = history[history.length - 1];
    setFuture((f) => [...f, before]);
    setHistory((h) => h.slice(0, -1));
    dirty.current = true;
    current.current = next;
    setWorkspace(next);
  }
  function redo() {
    if (!future.length) return;
    const before = current.current,
      next = future[future.length - 1];
    setHistory((h) => [...h, before]);
    setFuture((f) => f.slice(0, -1));
    dirty.current = true;
    current.current = next;
    setWorkspace(next);
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,[contenteditable],[role=dialog]',
        ) ||
        library ||
        historyDoc ||
        busy ||
        drawing.current ||
        eraserBefore.current
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const chosen = tools.find(
        (t) => t.key.toLowerCase() === e.key.toLowerCase(),
      );
      if (chosen) setTool(chosen.id);
      if (e.key === 'ArrowRight')
        setPage((p) => Math.min(pdf?.numPages || 1, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });
  function point(e: React.PointerEvent): Point {
    const b = svg.current!.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          dimensions.width,
          ((e.clientX - b.left) / b.width) * dimensions.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          dimensions.height,
          ((e.clientY - b.top) / b.height) * dimensions.height,
        ),
      ),
    };
  }
  function erase(p: Point) {
    const strokes = current.current.strokes.filter(
      (s) => s.page !== page || !hit(s, p),
    );
    if (strokes.length !== current.current.strokes.length) {
      const state = { ...current.current, strokes };
      dirty.current = true;
      current.current = state;
      setWorkspace(state);
    }
  }
  function pointerDown(e: React.PointerEvent) {
    if (busy || !ready || tool === 'text' || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'select') {
      e.preventDefault();
      if (stage.current)
        pan.current = {
          x: e.clientX,
          y: e.clientY,
          left: stage.current.scrollLeft,
          top: stage.current.scrollTop,
        };
      return;
    }
    if (tool === 'eraser') {
      eraserBefore.current = current.current;
      erase(point(e));
      return;
    }
    const s: Stroke = {
      id: newId(),
      page,
      color: tool === 'highlight' && color === colors[1] ? colors[4] : color,
      width: tool === 'highlight' ? width * 6 : width,
      opacity: tool === 'highlight' ? 0.35 : 1,
      points: [point(e)],
    };
    drawing.current = s;
    setDraft(s);
  }
  function pointerMove(e: React.PointerEvent) {
    if (pan.current && stage.current) {
      stage.current.scrollLeft = pan.current.left - e.clientX + pan.current.x;
      stage.current.scrollTop = pan.current.top - e.clientY + pan.current.y;
    }
    if (eraserBefore.current) erase(point(e));
    if (drawing.current && drawing.current.points.length < 10000) {
      const next = {
        ...drawing.current,
        points: [...drawing.current.points, point(e)],
      };
      drawing.current = next;
      setDraft(next);
    }
  }
  function pointerUp() {
    if (drawing.current) {
      update({
        ...current.current,
        strokes: [...current.current.strokes, drawing.current],
      });
      drawing.current = null;
      setDraft(null);
    }
    if (eraserBefore.current && eraserBefore.current !== current.current) {
      const before = eraserBefore.current;
      setHistory((h) => [...h.slice(-49), before]);
      setFuture([]);
    }
    eraserBefore.current = null;
    pan.current = null;
  }
  function addNote(text = noteText) {
    if (!text.trim() || text.length > 5000 || !ready) return;
    const note: Note = {
      id: newId(),
      page,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };
    update({ ...current.current, notes: [...current.current.notes, note] });
    setNoteText('');
    return note;
  }
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool(tool: unknown, options: { signal: AbortSignal }): void;
        };
      }
    ).modelContext;
    if (!context?.registerTool || !ready) return;
    const lifecycle = new AbortController();
    try {
      context.registerTool(
        {
          name: 'add_pdf_note',
          description: 'Add and save a note to the visible PDF page.',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', minLength: 1, maxLength: 5000 },
            },
            required: ['text'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          execute: async (input: { text: string }) => {
            if (
              typeof input?.text !== 'string' ||
              !input.text.trim() ||
              input.text.length > 5000
            )
              throw new Error('Note must contain 1–5000 characters.');
            const note = addNote(input.text);
            await save(doc.id, current.current);
            return { id: note?.id, page, saved: true };
          },
        },
        { signal: lifecycle.signal },
      );
    } catch {}
    return () => lifecycle.abort();
  }, [ready, page, doc.id, save]);
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setError('Vui lòng chọn PDF nhỏ hơn 25 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const loading = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      });
      const probe = await loading.promise;
      const pages = probe.numPages;
      await loading.destroy();
      if (pages > 100) throw new Error('Hỗ trợ PDF tối đa 100 trang.');
      const r = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'X-File-Name': encodeURIComponent(file.name),
          ...(uploadFolder.current
            ? { 'X-Folder-Id': uploadFolder.current }
            : {}),
        },
        body: file,
      });
      if (!r.ok) {
        const b = (await r.json()) as { error?: string };
        throw new Error(b.error || 'Không tải lên được PDF.');
      }
      const record = (await r.json()) as Doc;
      await openDocument(record);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'PDF không hợp lệ hoặc có mật khẩu.',
      );
    } finally {
      setBusy(false);
      uploadFolder.current = null;
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function flushCurrent() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await saveQueue.current.catch(() => {});
    if (dirty.current) {
      const state = current.current;
      await save(docRef.current.id, state);
      if (current.current === state) {
        dirty.current = false;
        setStatus('Đã lưu');
      }
    }
  }
  async function showLibrary() {
    if (busy || exporting) return;
    setBusy(true);
    try {
      await flushCurrent();
      setLibrary(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được tài liệu.');
    } finally {
      setBusy(false);
    }
  }
  async function showHistory(target: Doc) {
    if (busy || exporting) return;
    setBusy(true);
    try {
      await flushCurrent();
      setHistoryDoc(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được tài liệu.');
    } finally {
      setBusy(false);
    }
  }
  async function restoreVersion(version: Version) {
    setBusy(true);
    try {
      await flushCurrent();
      const response = await fetch(
        '/api/documents/' + version.documentId + '/versions/' + version.id,
        { method: 'POST' },
      );
      if (!response.ok) throw new Error('Không khôi phục được phiên bản.');
      await openDocument({
        id: version.documentId,
        name: version.documentName,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!pdf) return;
    setExporting(true);
    try {
      await exportDocument(pdf, current.current, doc.name);
    } catch {
      setError('Không xuất được PDF. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  }
  const pageNotes = workspace.notes.filter((n) => n.page === page),
    strokes = workspace.strokes.filter((s) => s.page === page);
  return (
    <main className="app-shell">
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <header className="app-header">
        <button
          className="brand"
          onClick={() => void showLibrary()}
          aria-label="Margin, mở thư viện"
        >
          <span className="brand-icon">
            <BookOpen size={22} />
          </span>
          margin<span className="brand-dot">.</span>
        </button>
        <div className="header-divider" />
        <button className="library-link" onClick={() => void showLibrary()}>
          <ChevronLeft size={16} />
          Thư viện
        </button>
        <div className="document-heading">
          <span className="document-title">
            {doc.name.replace(/\.pdf$/i, '')}
          </span>
          <span className="save-status" role="status">
            {status === 'Đã lưu' ? (
              <Check size={12} />
            ) : status === 'Đang lưu…' ? (
              <Loader2 size={12} className="spin" />
            ) : null}
            {status}
          </span>
        </div>
        <div className="header-actions">
          <IconButton
            label="Lịch sử phiên bản"
            onClick={() => void showHistory(doc)}
            disabled={busy || exporting}
          >
            <History size={19} />
          </IconButton>
          <button
            className="button upload-button"
            onClick={() => {
              uploadFolder.current = null;
              fileInput.current?.click();
            }}
            disabled={busy || exporting}
          >
            <Upload size={16} />
            <span>Mở PDF</span>
          </button>
          <button
            className="button primary"
            onClick={() => void download()}
            disabled={!pdf || busy || exporting}
          >
            {exporting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Download size={16} />
            )}
            <span>{exporting ? 'Đang xuất…' : 'Xuất PDF'}</span>
          </button>
          <span className="avatar">B</span>
        </div>
      </header>
      <div className="document-tabs">
        <span className="document-tab">
          <FileText size={15} />
          {doc.name}
          <span className="tab-dot" />
        </span>
        <button
          className="new-tab"
          aria-label="Mở PDF khác"
          onClick={() => {
            uploadFolder.current = null;
            fileInput.current?.click();
          }}
          disabled={busy}
        >
          <Plus size={17} />
        </button>
        <span className="workspace-label">KHÔNG GIAN CỦA BẠN</span>
      </div>
      <div className="toolbar" role="toolbar" aria-label="Công cụ ghi chú">
        <div className="toolbar-group">
          <IconButton
            label="Ẩn/hiện danh sách trang"
            active={leftOpen}
            onClick={() => setLeftOpen(!leftOpen)}
          >
            <PanelLeft size={19} />
          </IconButton>
        </div>
        <div className="toolbar-group history-tools">
          <IconButton
            label="Hoàn tác (Ctrl+Z)"
            onClick={undo}
            disabled={!history.length || busy}
          >
            <Undo2 size={18} />
            <span>Undo</span>
          </IconButton>
          <IconButton
            label="Làm lại (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={!future.length || busy}
          >
            <Redo2 size={18} />
            <span>Redo</span>
          </IconButton>
        </div>
        <div className="toolbar-group drawing-tools">
          {tools.map((t) => (
            <IconButton
              key={t.id}
              label={t.name + ' (' + t.key + ')'}
              active={tool === t.id}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              <t.icon size={21} />
              {t.id === 'text' && <span className="tool-label">Chữ</span>}
            </IconButton>
          ))}
          <button
            className="insert-image-button"
            title="Thêm hình PNG, JPG, WebP"
            aria-label="Thêm hình"
            onClick={() => objectsRef.current?.chooseImage()}
            disabled={!ready || busy || exporting}
          >
            <ImagePlus size={20} />
            <span>Hình</span>
          </button>
        </div>
        <div className="toolbar-group color-tools">
          {colors.map((c) => (
            <button
              key={c}
              className={'color-button ' + (color === c ? 'selected' : '')}
              aria-label={'Màu ' + c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              style={{ '--swatch': c } as React.CSSProperties}
            >
              {color === c && (
                <Check size={12} color={c === colors[4] ? '#333' : '#fff'} />
              )}
            </button>
          ))}
        </div>
        <div className="toolbar-group width-control">
          <span className="stroke-example" style={{ height: width + 1 }} />
          <Slider
            aria-label="Độ dày nét bút"
            min={1}
            max={6}
            step={0.5}
            value={[width]}
            onValueChange={(v) => setWidth(Array.isArray(v) ? v[0] : v)}
          />
          <span>{width}</span>
        </div>
        <div className="toolbar-end">
          <div className="zoom-control">
            <IconButton
              label="Thu nhỏ"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              disabled={zoom <= 50}
            >
              −
            </IconButton>
            <button title="Khôi phục 100%" onClick={() => setZoom(100)}>
              {zoom}%
            </button>
            <IconButton
              label="Phóng to"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              disabled={zoom >= 200}
            >
              +
            </IconButton>
          </div>
          <IconButton
            label="Ẩn/hiện ghi chú"
            active={rightOpen}
            onClick={() => setRightOpen(!rightOpen)}
          >
            <PanelRight size={19} />
          </IconButton>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button
            onClick={() => {
              if (dirty.current) {
                const snapshot = current.current;
                void save(doc.id, snapshot)
                  .then(() => {
                    if (current.current === snapshot) {
                      dirty.current = false;
                      setStatus('Đã lưu');
                    }
                    setError('');
                  })
                  .catch((e) => setError(e.message));
              } else void openDocument(doc);
            }}
          >
            Thử lại
          </button>
          <button aria-label="Đóng thông báo" onClick={() => setError('')}>
            <X size={15} />
          </button>
        </div>
      )}
      <div
        className={
          'workspace ' +
          (!leftOpen ? 'hide-pages ' : '') +
          (!rightOpen ? 'hide-notes' : '')
        }
      >
        {leftOpen && (
          <aside className="page-sidebar">
            <div className="sidebar-heading">
              <span>Trang tài liệu</span>
              <span className="count">{pdf?.numPages || '—'}</span>
            </div>
            <div className="page-list">
              {pdf &&
                Array.from({ length: pdf.numPages }, (_, i) => (
                  <Thumbnail
                    key={doc.id + '-' + i}
                    pdf={pdf}
                    page={i + 1}
                    selected={page === i + 1}
                    onClick={() => setPage(i + 1)}
                  />
                ))}
            </div>
            <div className="sidebar-footer">
              <FileText size={14} />
              <span>Tài liệu PDF</span>
            </div>
          </aside>
        )}
        <section
          className="document-stage"
          ref={stage}
          aria-label="Trang PDF"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy && !exporting) void upload(e.dataTransfer.files[0]);
          }}
        >
          <div className="stage-caption">
            <span>
              {doc.id === 'sample' ? 'TÀI LIỆU MẪU' : 'TÀI LIỆU CỦA BẠN'}
            </span>
            <span>
              Trang {page} / {pdf?.numPages || '—'}
            </span>
          </div>
          <div
            className="paper"
            onPointerDown={(event) => {
              if (
                tool !== 'select' ||
                (event.target as Element).closest(
                  '.pdf-text-layer span, .pdf-text-layer br, .page-object, .object-actions',
                )
              )
                return;
              pointerDown(event);
            }}
            onPointerMove={(event) => {
              if (tool === 'select') pointerMove(event);
            }}
            onPointerUp={() => {
              if (tool === 'select') pointerUp();
            }}
            onPointerCancel={() => {
              if (tool === 'select') pointerUp();
            }}
            onLostPointerCapture={() => {
              if (tool === 'select') pointerUp();
            }}
            style={{
              width: (595 * zoom) / 100 + 'px',
              aspectRatio: dimensions.width + '/' + dimensions.height,
            }}
          >
            <canvas
              ref={canvas}
              className="pdf-canvas"
              aria-label={'Nội dung PDF trang ' + page}
            />
            {pdf && (
              <PdfTextLayer
                pdf={pdf}
                page={page}
                width={(595 * zoom) / 100}
                active={tool === 'select' && ready && !busy}
              />
            )}
            <svg
              ref={svg}
              className={'annotation-layer tool-' + tool}
              viewBox={'0 0 ' + dimensions.width + ' ' + dimensions.height}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={pointerUp}
              onLostPointerCapture={pointerUp}
              aria-label="Vùng viết và đánh dấu trên PDF"
            >
              {[...strokes, ...(draft ? [draft] : [])].map((s) =>
                s.points.length === 1 ? (
                  <circle
                    key={s.id}
                    cx={s.points[0].x}
                    cy={s.points[0].y}
                    r={s.width / 2}
                    fill={s.color}
                    opacity={s.opacity}
                  />
                ) : (
                  <polyline
                    key={s.id}
                    points={s.points.map((p) => p.x + ',' + p.y).join(' ')}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={s.opacity}
                  />
                ),
              )}
            </svg>
            <PdfObjects
              ref={objectsRef}
              docId={doc.id}
              page={page}
              dimensions={dimensions}
              objects={workspace.objects}
              tool={tool}
              color={color}
              disabled={!ready || busy || exporting}
              onAdd={(object) =>
                update({
                  ...current.current,
                  objects: [...current.current.objects, object],
                })
              }
              onReplace={(object) =>
                update({
                  ...current.current,
                  objects: current.current.objects.map((item) =>
                    item.id === object.id ? object : item,
                  ),
                })
              }
              onDelete={(id) =>
                update({
                  ...current.current,
                  objects: current.current.objects.filter(
                    (item) => item.id !== id,
                  ),
                })
              }
              onSelectTool={() => setTool('select')}
              onError={setError}
            />
            {busy && (
              <div className="paper-loading">
                <Loader2 className="spin" size={28} />
                <span>Đang mở tài liệu…</span>
              </div>
            )}
          </div>
          <div className="paper-bottom">
            <span>
              {tool === 'select'
                ? 'Kéo trên chữ để chọn · Ctrl+C / ⌘C để copy · Kéo vùng trống để di chuyển'
                : 'Không gian cho những ý tưởng của bạn.'}
            </span>
            <BookOpen size={16} />
          </div>
        </section>
        {rightOpen && (
          <aside className="notes-sidebar">
            <div className="sidebar-heading">
              <span>Ghi chú của bạn</span>
              <IconButton
                label="Đóng bảng ghi chú"
                onClick={() => setRightOpen(false)}
              >
                <X size={16} />
              </IconButton>
            </div>
            <Tabs defaultValue="page" className="notes-tabs">
              <TabsList className="notes-tab-list">
                <TabsTrigger value="page">
                  Trang này{' '}
                  <span className="tiny-count">{pageNotes.length}</span>
                </TabsTrigger>
                <TabsTrigger value="all">Tất cả</TabsTrigger>
              </TabsList>
              {['page', 'all'].map((tab) => (
                <TabsContent value={tab} key={tab} className="notes-content">
                  <div className="notes-context">
                    <span>
                      {tab === 'page'
                        ? 'TRANG ' + String(page).padStart(2, '0')
                        : 'TOÀN BỘ TÀI LIỆU'}
                    </span>
                    <StickyNote size={14} />
                  </div>
                  {(tab === 'page' ? pageNotes : workspace.notes).length ===
                  0 ? (
                    <div className="empty-notes">
                      <span className="empty-note-icon">
                        <PenLine size={25} />
                      </span>
                      <h2>Một ý hay vừa xuất hiện?</h2>
                      <p>Ghi lại suy nghĩ, câu hỏi hoặc điều bạn muốn nhớ.</p>
                    </div>
                  ) : (
                    (tab === 'page' ? pageNotes : workspace.notes).map((n) => (
                      <article className="note-card" key={n.id}>
                        <div className="note-meta">
                          <button onClick={() => setPage(n.page)}>
                            Trang {n.page}
                            <ArrowUpRight size={12} />
                          </button>
                          <IconButton
                            label="Xóa ghi chú"
                            disabled={busy}
                            onClick={() =>
                              update({
                                ...current.current,
                                notes: current.current.notes.filter(
                                  (item) => item.id !== n.id,
                                ),
                              })
                            }
                          >
                            <X size={13} />
                          </IconButton>
                        </div>
                        <p>{n.text}</p>
                        <span className="note-time">
                          {new Date(n.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </article>
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
            <form
              className="note-composer"
              onSubmit={(e) => {
                e.preventDefault();
                addNote();
              }}
            >
              <label htmlFor="note-text">
                Ghi chú mới <span>· Trang {page}</span>
              </label>
              <textarea
                id="note-text"
                placeholder="Viết suy nghĩ của bạn…"
                maxLength={5000}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={!ready || busy}
              />
              <div className="composer-footer">
                <span>{noteText.length}/5000</span>
                <button
                  type="submit"
                  className="add-note"
                  disabled={!noteText.trim() || !ready || busy}
                >
                  <Plus size={15} />
                  Thêm ghi chú
                </button>
              </div>
            </form>
            <div className="quick-tip">
              <span className="tip-label">MẸO NHỎ</span>
              <p>
                Dùng <kbd>P</kbd> để viết, <kbd>H</kbd> để đánh dấu. Ý tưởng
                luôn ở trong tầm tay.
              </p>
            </div>
          </aside>
        )}
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {tools.find((t) => t.id === tool)?.name}
          <span className="footer-separator">·</span>
          <span className="desktop-label">
            Viết bằng chuột hoặc bút cảm ứng
          </span>
        </span>
        <div className="page-controls">
          <IconButton
            label="Trang trước"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={15} />
          </IconButton>
          <span>
            <strong>{page}</strong>
            <span className="of-pages"> / {pdf?.numPages || '—'}</span>
          </span>
          <IconButton
            label="Trang sau"
            disabled={!pdf || page >= pdf.numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={15} />
          </IconButton>
        </div>
        <span className="desktop-label">Một trang. Nhiều ý tưởng.</span>
      </footer>
      <FileLibrary
        open={library}
        onOpenChange={setLibrary}
        disabled={busy || exporting}
        onOpen={openDocument}
        onUpload={(folderId) => {
          uploadFolder.current = folderId;
          fileInput.current?.click();
        }}
        onHistory={(target) => void showHistory(target)}
        onDocumentChanged={(updated) => {
          if (docRef.current.id === updated.id) setDoc(updated);
        }}
      />

      <DocumentHistory
        document={historyDoc}
        onClose={() => setHistoryDoc(null)}
        onRestore={restoreVersion}
        disabled={busy || exporting}
      />
    </main>
  );
}
