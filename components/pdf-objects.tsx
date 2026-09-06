'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Loader2, Pencil, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  newId,
  type PageObject,
  type Point,
  type TextFormat,
} from '@/lib/annotations';
import {
  fitObject,
  textLines,
  textFormat,
  fontCss,
  textDecoration,
  textAnchor,
  textX,
  ensureTextFont,
} from '@/lib/page-objects';
import { TextFormatToolbar } from '@/components/text-format-toolbar';

export type ObjectsHandle = { chooseImage(): void };
type Props = {
  docId: string;
  page: number;
  dimensions: { width: number; height: number };
  objects: PageObject[];
  tool: string;
  color: string;
  disabled: boolean;
  onAdd(object: PageObject): void;
  onReplace(object: PageObject): void;
  onDelete(id: string): void;
  onSelectTool(): void;
  onError(message: string): void;
};

export const PdfObjects = forwardRef<ObjectsHandle, Props>(
  function PdfObjects(props, ref) {
    const {
      docId,
      page,
      dimensions,
      objects,
      tool,
      color,
      disabled,
      onAdd,
      onReplace,
      onDelete,
      onSelectTool,
      onError,
    } = props;
    const [selected, setSelected] = useState<string | null>(null);
    const [preview, setPreview] = useState<PageObject | null>(null);
    const [editor, setEditor] = useState<{ id?: string; point: Point } | null>(
      null,
    );
    const [text, setText] = useState(''),
      [format, setFormat] = useState<TextFormat>(
        textFormat({ fontFamily: 'Liberation Sans', color }),
      );
    const [textError, setTextError] = useState(''),
      [fontReady, setFontReady] = useState(true);
    const [, setFontEpoch] = useState(0);
    const formatRequest = useRef(0),
      formatIntent = useRef<Extract<PageObject, { kind: 'text' }> | null>(null);
    const [uploading, setUploading] = useState(false);
    const input = useRef<HTMLInputElement>(null),
      surface = useRef<SVGSVGElement>(null);
    const gesture = useRef<{
      object: PageObject;
      start: Point;
      resize: boolean;
      pointerId: number;
    } | null>(null);
    const livePreview = useRef<PageObject | null>(null);
    const liveDoc = useRef(docId);
    liveDoc.current = docId;
    const liveProps = useRef(props);
    liveProps.current = props;
    const currentObject = objects.find(
      (o) => o.id === selected && o.page === page,
    );
    const interactive = !disabled && (tool === 'select' || tool === 'text');

    useImperativeHandle(
      ref,
      () => ({
        chooseImage() {
          if (!disabled && !uploading) input.current?.click();
        },
      }),
      [disabled, uploading],
    );
    useEffect(() => {
      setSelected(null);
      setEditor(null);
      setPreview(null);
      livePreview.current = null;
      gesture.current = null;
      formatRequest.current++;
      formatIntent.current = null;
    }, [docId, page]);
    useEffect(() => {
      if (tool !== 'select' && tool !== 'text') setSelected(null);
    }, [tool]);

    useEffect(() => {
      let cancelled = false;
      void Promise.all(
        objects
          .filter(
            (o): o is Extract<PageObject, { kind: 'text' }> =>
              o.kind === 'text' && o.page === page,
          )
          .map((o) => ensureTextFont(o)),
      )
        .then(() => {
          if (!cancelled) setFontEpoch((n) => n + 1);
        })
        .catch(() => {
          if (!cancelled)
            onError('Không tải được phông chữ. Vui lòng tải lại trang.');
        });
      return () => {
        cancelled = true;
      };
    }, [objects, page]);
    useEffect(() => {
      if (!editor) return;
      let cancelled = false;
      setFontReady(false);
      void ensureTextFont(format)
        .then(() => {
          if (!cancelled) setFontReady(true);
        })
        .catch(() => {
          if (!cancelled)
            setTextError('Không tải được phông chữ. Vui lòng thử lại.');
        });
      return () => {
        cancelled = true;
      };
    }, [
      editor,
      format.fontFamily,
      format.bold,
      format.italic,
      format.fontSize,
    ]);
    async function changeFormat(patch: Partial<TextFormat>) {
      if (currentObject?.kind !== 'text' || disabled) return;
      const token = ++formatRequest.current;
      const intended = {
        ...(formatIntent.current?.id === currentObject.id
          ? formatIntent.current
          : currentObject),
        ...patch,
      };
      formatIntent.current = intended;
      setPreview(intended);
      try {
        await ensureTextFont(intended);
        if (token !== formatRequest.current) return;
        const fitted = fitObject(intended, dimensions);
        if (fitted.height > dimensions.height)
          throw new Error('Chữ dài hơn một trang. Hãy giảm cỡ hoặc giãn dòng.');
        onReplace(fitted);
      } catch (error) {
        if (token === formatRequest.current)
          onError(
            error instanceof Error
              ? error.message
              : 'Không đổi được định dạng.',
          );
      } finally {
        if (token === formatRequest.current) {
          setPreview(null);
          formatIntent.current = null;
        }
      }
    }
    function formatShortcut(event: React.KeyboardEvent, dialog = false) {
      if (!(event.ctrlKey || event.metaKey)) return false;
      const key = ({ b: 'bold', i: 'italic', u: 'underline' } as const)[
        event.key.toLowerCase() as 'b' | 'i' | 'u'
      ];
      if (!key) return false;
      event.preventDefault();
      event.stopPropagation();
      if (dialog) setFormat((value) => ({ ...value, [key]: !value[key] }));
      else if (currentObject?.kind === 'text')
        void changeFormat({ [key]: !textFormat(currentObject)[key] });
      return true;
    }
    function point(event: React.PointerEvent): Point {
      const box = surface.current!.getBoundingClientRect();
      return {
        x: ((event.clientX - box.left) / box.width) * dimensions.width,
        y: ((event.clientY - box.top) / box.height) * dimensions.height,
      };
    }
    function openText(
      at: Point,
      object?: Extract<PageObject, { kind: 'text' }>,
    ) {
      setEditor({ id: object?.id, point: at });
      setText(object?.text || '');
      setFormat(textFormat(object || { fontFamily: 'Liberation Sans', color }));
      setTextError('');
    }
    async function commitText(event: React.FormEvent) {
      event.preventDefault();
      if (!editor || !text.trim() || disabled) return;
      const existing = objects.find((o) => o.id === editor.id);
      try {
        await ensureTextFont(format);
        const object = fitObject(
          {
            id: editor.id || newId(),
            kind: 'text',
            page,
            x: editor.point.x,
            y: editor.point.y,
            width: existing?.width || Math.min(260, dimensions.width * 0.7),
            height: 30,
            text: text.trim(),
            ...format,
          },
          dimensions,
        );
        if (object.height > dimensions.height) {
          setTextError(
            'Chữ dài hơn một trang. Hãy giảm cỡ chữ hoặc chia thành nhiều hộp chữ.',
          );
          return;
        }
        existing ? onReplace(object) : onAdd(object);
        setSelected(object.id);
        setEditor(null);
        onSelectTool();
      } catch {
        setTextError('Không tải được phông chữ. Vui lòng thử lại.');
      }
    }
    function start(
      event: React.PointerEvent<SVGGElement>,
      object: PageObject,
      resize = false,
    ) {
      event.stopPropagation();
      if (!interactive || event.button !== 0) return;
      setSelected(object.id);
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        object,
        start: point(event),
        resize,
        pointerId: event.pointerId,
      };
    }
    function move(event: React.PointerEvent<SVGGElement>) {
      const drag = gesture.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopPropagation();
      const p = point(event),
        dx = p.x - drag.start.x,
        dy = p.y - drag.start.y;
      const object = drag.object;
      const next = fitObject(
        drag.resize
          ? {
              ...object,
              width: Math.max(30, object.width + dx),
              height:
                object.kind === 'image'
                  ? (object.height * Math.max(30, object.width + dx)) /
                    object.width
                  : object.height,
            }
          : { ...object, x: object.x + dx, y: object.y + dy },
        dimensions,
      );
      if (next.height > dimensions.height) return;
      livePreview.current = next;
      setPreview(next);
    }
    function finish(event: React.PointerEvent<SVGGElement>, cancel = false) {
      event.stopPropagation();
      const drag = gesture.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!cancel && livePreview.current) onReplace(livePreview.current);
      gesture.current = null;
      livePreview.current = null;
      setPreview(null);
    }
    function objectKeys(
      event: React.KeyboardEvent<SVGGElement>,
      object: PageObject,
    ) {
      if (!interactive) return;
      if (object.kind === 'text' && formatShortcut(event)) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        onDelete(object.id);
        setSelected(null);
        return;
      }
      if (event.key === 'Enter' && object.kind === 'text') {
        event.stopPropagation();
        openText(object, object);
        return;
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        setSelected(null);
        return;
      }
      const delta = event.shiftKey ? 10 : 1;
      const offset = (
        {
          ArrowLeft: [-delta, 0],
          ArrowRight: [delta, 0],
          ArrowUp: [0, -delta],
          ArrowDown: [0, delta],
        } as Record<string, number[]>
      )[event.key];
      if (offset) {
        event.preventDefault();
        event.stopPropagation();
        onReplace(
          fitObject(
            { ...object, x: object.x + offset[0], y: object.y + offset[1] },
            dimensions,
          ),
        );
      }
    }
    async function insertImage(file?: File) {
      if (!file) return;
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 20 * 1024 * 1024
      ) {
        onError('Chọn ảnh PNG, JPG hoặc WebP nhỏ hơn 20 MB.');
        return;
      }
      setUploading(true);
      const targetDoc = docId,
        targetPage = page,
        targetDimensions = dimensions;
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const scale = Math.min(
          1,
          2000 / Math.max(image.naturalWidth, image.naturalHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas
          .getContext('2d')!
          .drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value
                ? resolve(value)
                : reject(new Error('Không xử lý được ảnh.')),
            'image/png',
          ),
        );
        if (blob.size > 8 * 1024 * 1024)
          throw new Error('Ảnh quá lớn sau xử lý. Hãy chọn ảnh nhỏ hơn.');
        const response = await fetch(`/api/documents/${targetDoc}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: blob,
        });
        if (!response.ok)
          throw new Error('Không lưu được ảnh. Vui lòng thử lại.');
        const result = (await response.json()) as { src: string };
        if (liveDoc.current !== targetDoc) return;
        const width = Math.min(260, targetDimensions.width * 0.6),
          height = (width * canvas.height) / canvas.width;
        const object = fitObject(
          {
            id: newId(),
            kind: 'image',
            page: targetPage,
            src: result.src,
            alt: file.name.slice(0, 200),
            x: (targetDimensions.width - width) / 2,
            y: Math.max(0, (targetDimensions.height - height) / 2),
            width,
            height,
          },
          targetDimensions,
        );
        liveProps.current.onAdd(object);
        setSelected(object.id);
        liveProps.current.onSelectTool();
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Không mở được ảnh.');
      } finally {
        URL.revokeObjectURL(url);
        setUploading(false);
        if (input.current) input.current.value = '';
      }
    }
    return (
      <>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => void insertImage(event.target.files?.[0])}
        />
        <svg
          ref={surface}
          className={
            'object-layer ' +
            (tool === 'text' && !disabled ? 'insert-text' : '')
          }
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          aria-label="Chữ và hình trên trang PDF"
          onPointerDown={(event) => {
            if (tool === 'text' && !disabled && event.button === 0)
              openText(point(event));
            else setSelected(null);
          }}
        >
          {objects
            .filter((object) => object.page === page)
            .map((original) => {
              const object = preview?.id === original.id ? preview : original;
              return (
                <g
                  key={object.id}
                  style={{ pointerEvents: interactive ? 'auto' : 'none' }}
                  tabIndex={interactive ? 0 : -1}
                  role="button"
                  aria-label={
                    object.kind === 'text'
                      ? 'Hộp chữ: ' + object.text
                      : 'Hình: ' + object.alt
                  }
                  onFocus={() => setSelected(object.id)}
                  onPointerDown={(e) => start(e, object)}
                  onPointerMove={move}
                  onPointerUp={finish}
                  onPointerCancel={(e) => finish(e, true)}
                  onLostPointerCapture={finish}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (interactive && object.kind === 'text')
                      openText(object, object);
                  }}
                  onKeyDown={(e) => objectKeys(e, object)}
                  className="page-object"
                >
                  <rect
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    height={object.height}
                    fill="transparent"
                  />
                  {object.kind === 'image' ? (
                    <image
                      href={object.src}
                      x={object.x}
                      y={object.y}
                      width={object.width}
                      height={object.height}
                      preserveAspectRatio="none"
                    />
                  ) : (
                    <text
                      fontFamily={object.fontFamily ?? 'Arial'}
                      fontSize={object.fontSize}
                      fontWeight={object.bold ? 700 : 400}
                      fontStyle={object.italic ? 'italic' : 'normal'}
                      textDecoration={textDecoration(object)}
                      textAnchor={textAnchor(object)}
                      fill={object.color}
                      style={{ userSelect: 'none' }}
                    >
                      {textLines(object).map((line, i) => (
                        <tspan
                          key={i}
                          x={textX(object)}
                          y={
                            object.y +
                            object.fontSize +
                            i * object.fontSize * (object.lineHeight ?? 1.3)
                          }
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>
                  )}
                  {selected === object.id && interactive && (
                    <>
                      <rect
                        className="object-selection"
                        x={object.x - 2}
                        y={object.y - 2}
                        width={object.width + 4}
                        height={object.height + 4}
                        fill="none"
                        stroke="#5969d7"
                        strokeWidth="1"
                        strokeDasharray="4 3"
                        pointerEvents="none"
                      />
                      <g
                        onPointerDown={(e) => start(e, object, true)}
                        className="object-resize"
                      >
                        <rect
                          x={object.x + object.width - 12}
                          y={object.y + object.height - 12}
                          width="24"
                          height="24"
                          fill="transparent"
                        />
                        <rect
                          x={object.x + object.width - 5}
                          y={object.y + object.height - 5}
                          width="10"
                          height="10"
                          rx="2"
                          fill="white"
                          stroke="#5969d7"
                          strokeWidth="1.5"
                        />
                      </g>
                    </>
                  )}
                </g>
              );
            })}
        </svg>
        {currentObject && interactive && (
          <div
            className={
              'object-actions ' +
              (currentObject.kind === 'text' ? 'text-object-actions' : '')
            }
            role="toolbar"
            aria-label="Chỉnh sửa đối tượng"
          >
            {currentObject.kind === 'text' && (
              <TextFormatToolbar
                value={textFormat(
                  preview?.kind === 'text' && preview.id === currentObject.id
                    ? preview
                    : currentObject,
                )}
                onChange={(patch) => void changeFormat(patch)}
                disabled={disabled}
              />
            )}
            {currentObject.kind === 'text' && (
              <button onClick={() => openText(currentObject, currentObject)}>
                <Pencil size={15} />
                Sửa chữ
              </button>
            )}
            <span>Kéo để di chuyển · Kéo góc để đổi cỡ</span>
            <button
              aria-label="Xóa chữ hoặc hình đã chọn"
              onClick={() => {
                onDelete(currentObject.id);
                setSelected(null);
              }}
            >
              <Trash2 size={16} />
            </button>
            <button aria-label="Bỏ chọn" onClick={() => setSelected(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        {uploading && (
          <div className="object-upload-status" role="status">
            <Loader2 className="spin" size={17} />
            Đang chèn hình…
          </div>
        )}
        <Dialog
          open={!!editor}
          onOpenChange={(open) => {
            if (!open) setEditor(null);
          }}
        >
          <DialogContent className="text-object-dialog word-editor-dialog">
            <DialogTitle>
              {editor?.id ? 'Sửa chữ' : 'Thêm chữ vào trang PDF'}
            </DialogTitle>
            <DialogDescription>
              Định dạng áp dụng cho toàn bộ hộp chữ.
            </DialogDescription>
            <form
              onSubmit={(event) => void commitText(event)}
              onKeyDown={(event) => formatShortcut(event, true)}
            >
              <TextFormatToolbar
                value={format}
                onChange={(patch) => {
                  setTextError('');
                  setFormat((value) => ({ ...value, ...patch }));
                }}
              />
              <label className="sr-only" htmlFor="pdf-text-content">
                Nội dung chữ
              </label>
              <textarea
                id="pdf-text-content"
                autoFocus
                maxLength={5000}
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Nhập nội dung tại đây…"
                required
                style={{
                  font: fontCss(format),
                  color: format.color,
                  textDecoration: textDecoration(format),
                  textAlign: format.align,
                  lineHeight: format.lineHeight,
                }}
              />
              {textError && (
                <p className="vault-form-error" role="alert">
                  {textError}
                </p>
              )}
              <div className="word-editor-footer">
                <span>{text.length}/5000 · Ctrl+B / I / U</span>
                <button
                  type="submit"
                  className="button primary"
                  disabled={!text.trim() || !fontReady || disabled}
                >
                  {!fontReady
                    ? 'Đang tải font…'
                    : editor?.id
                      ? 'Lưu thay đổi'
                      : 'Chèn chữ'}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
