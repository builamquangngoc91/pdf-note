'use client';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Clock,
  Folder as FolderIcon,
  FolderPlus,
  FileText,
  History,
  Upload,
  Search,
  Pencil,
  FolderInput,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { Doc, Folder } from '@/lib/annotations';

const sample: Doc = {
  id: 'sample',
  name: 'The art of paying attention.pdf',
  updatedAt: '',
};
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
export function FileLibrary({
  open,
  onOpenChange,
  onOpen,
  onUpload,
  onHistory,
  onDocumentChanged,
  disabled,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  onOpen(doc: Doc): Promise<void>;
  onUpload(folderId: string | null): void;
  onHistory(doc: Doc): void;
  onDocumentChanged(doc: Doc): void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState('all'),
    [docs, setDocs] = useState<Doc[]>([]),
    [folders, setFolders] = useState<Folder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null),
    [query, setQuery] = useState(''),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{
    type: 'folder' | 'file';
    id?: string;
    name: string;
    folderId: string | null;
  } | null>(null);
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const responses = await Promise.all(
        ['/api/documents', '/api/folders'].map((url) => fetch(url)),
      );
      if (responses.some((r) => !r.ok))
        throw new Error('Không tải được thư viện.');
      const [documents, folderList] = await Promise.all(
        responses.map((r) => r.json()),
      );
      setDocs(documents as Doc[]);
      setFolders(folderList as Folder[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được thư viện.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (open) {
      setQuery('');
      void refresh();
    }
  }, [open]);
  function folderPath(id: string | null): string {
    const names: string[] = [];
    const visited = new Set<string>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const folder = folders.find((f) => f.id === id);
      if (!folder) break;
      names.unshift(folder.name);
      id = folder.parentId;
    }
    return names.join(' / ') || 'Ngoài thư mục';
  }
  const ancestors: Folder[] = [];
  let ancestor = folderId;
  const seen = new Set<string>();
  while (ancestor && !seen.has(ancestor)) {
    seen.add(ancestor);
    const f = folders.find((f) => f.id === ancestor);
    if (!f) break;
    ancestors.unshift(f);
    ancestor = f.parentId;
  }
  const visibleDocs = (
    tab === 'recent'
      ? docs
          .filter((d) => d.lastOpenedAt)
          .sort((a, b) =>
            (b.lastOpenedAt || '').localeCompare(a.lastOpenedAt || ''),
          )
      : tab === 'folders'
        ? docs.filter((d) => (d.folderId || null) === folderId)
        : [sample, ...docs]
  ).filter((d) =>
    d.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError('');
    try {
      const url =
        edit.type === 'folder'
          ? '/api/folders' + (edit.id ? '/' + edit.id : '')
          : '/api/documents/' + edit.id;
      const response = await fetch(url, {
        method: edit.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          edit.type === 'folder'
            ? { name: edit.name, parentId: folderId }
            : { name: edit.name, folderId: edit.folderId },
        ),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'Không lưu được thay đổi.');
      }
      if (edit.type === 'file') {
        const existing = docs.find((d) => d.id === edit.id);
        if (existing)
          onDocumentChanged({
            ...existing,
            name: edit.name.trim(),
            folderId: edit.folderId,
          });
      }
      setEdit(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được thay đổi.');
    } finally {
      setSaving(false);
    }
  }
  const fileRows = (
    <div className="vault-file-list">
      {visibleDocs.length === 0 ? (
        <div className="vault-empty">
          <FileText size={32} />
          <p>
            {query
              ? 'Không có tài liệu phù hợp.'
              : tab === 'recent'
                ? 'Các PDF bạn mở sẽ xuất hiện ở đây.'
                : 'Thư mục chưa có PDF. Thêm file hoặc chuyển file vào đây.'}
          </p>
        </div>
      ) : (
        visibleDocs.map((d) => (
          <article className="vault-file" key={d.id}>
            <button
              className="vault-file-open"
              onClick={() => void onOpen(d)}
              disabled={disabled || saving}
            >
              <span className="file-icon">
                <FileText size={24} />
              </span>
              <span>
                <strong>{d.name}</strong>
                <small>
                  {d.id === 'sample'
                    ? 'Tài liệu mẫu'
                    : folderPath(d.folderId || null)}
                  {tab === 'recent' && d.lastOpenedAt
                    ? ' · Đã mở ' + date(d.lastOpenedAt)
                    : ''}
                </small>
              </span>
            </button>
            <div className="vault-file-actions">
              <button
                title="Lịch sử phiên bản của PDF này"
                disabled={disabled || saving}
                aria-label={'Lịch sử ' + d.name}
                onClick={() => onHistory(d)}
              >
                <History size={17} />
              </button>
              {d.id !== 'sample' && (
                <button
                  title="Đổi tên / chuyển thư mục"
                  aria-label={'Đổi tên hoặc chuyển ' + d.name}
                  onClick={() =>
                    setEdit({
                      type: 'file',
                      id: d.id,
                      name: d.name,
                      folderId: d.folderId || null,
                    })
                  }
                >
                  <FolderInput size={17} />
                </button>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!saving) onOpenChange(value);
        }}
      >
        <DialogContent className="vault-dialog">
          <div className="vault-heading">
            <div>
              <DialogTitle className="library-title">
                <BookOpen size={25} />
                Thư viện của bạn
              </DialogTitle>
              <DialogDescription>
                Tài liệu, thư mục và những ý tưởng đã lưu.
              </DialogDescription>
            </div>
            <button
              className="button primary"
              disabled={disabled || saving}
              onClick={() => onUpload(tab === 'folders' ? folderId : null)}
            >
              <Upload size={16} />
              Thêm PDF
            </button>
          </div>
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(String(value));
              setQuery('');
            }}
          >
            <TabsList className="vault-tabs">
              <TabsTrigger value="all">
                <FileText size={16} />
                Tất cả
              </TabsTrigger>
              <TabsTrigger value="recent">
                <Clock size={16} />
                Gần đây
              </TabsTrigger>
              <TabsTrigger value="folders">
                <FolderIcon size={16} />
                Thư mục
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => void refresh()}>Thử lại</button>
            </div>
          )}
          <div className="vault-search">
            <Search size={17} />
            <input
              placeholder="Tìm tài liệu…"
              aria-label="Tìm tài liệu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span>{visibleDocs.length} PDF</span>
          </div>
          <div className="vault-content">
            {loading ? (
              <div className="vault-empty" role="status">
                <Loader2 className="spin" size={24} />
                Đang tải thư viện…
              </div>
            ) : (
              <>
                {tab === 'folders' && (
                  <>
                    <div className="folder-breadcrumb">
                      <button onClick={() => setFolderId(null)}>Thư mục</button>
                      {ancestors.map((f) => (
                        <span key={f.id}>
                          <ChevronRight size={14} />
                          <button onClick={() => setFolderId(f.id)}>
                            {f.name}
                          </button>
                        </span>
                      ))}
                      <button
                        className="button"
                        onClick={() =>
                          setEdit({ type: 'folder', name: '', folderId: null })
                        }
                      >
                        <FolderPlus size={16} />
                        Tạo thư mục
                      </button>
                    </div>
                    <div className="folder-grid">
                      {folders
                        .filter((f) => f.parentId === folderId)
                        .map((f) => (
                          <article className="folder-card" key={f.id}>
                            <button
                              onClick={() => {
                                setFolderId(f.id);
                                setQuery('');
                              }}
                            >
                              <FolderIcon size={30} />
                              <strong>{f.name}</strong>
                              <span>
                                {docs.filter((d) => d.folderId === f.id).length}{' '}
                                file ·{' '}
                                {
                                  folders.filter(
                                    (child) => child.parentId === f.id,
                                  ).length
                                }{' '}
                                thư mục
                              </span>
                            </button>
                            <button
                              className="folder-rename"
                              aria-label={'Đổi tên thư mục ' + f.name}
                              onClick={() =>
                                setEdit({
                                  type: 'folder',
                                  id: f.id,
                                  name: f.name,
                                  folderId: null,
                                })
                              }
                            >
                              <Pencil size={14} />
                            </button>
                          </article>
                        ))}
                    </div>
                  </>
                )}
                {fileRows}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!edit}
        onOpenChange={(value) => {
          if (!value && !saving) setEdit(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {edit?.type === 'folder'
              ? edit.id
                ? 'Đổi tên thư mục'
                : 'Tạo thư mục'
              : 'Sắp xếp tài liệu'}
          </DialogTitle>
          <DialogDescription>
            {edit?.type === 'folder'
              ? 'Thư mục hiện tại: ' + folderPath(folderId)
              : 'Đổi tên hoặc chọn nơi lưu file PDF.'}
          </DialogDescription>
          <form className="vault-edit-form" onSubmit={saveEdit}>
            <label>
              Tên
              <input
                autoFocus
                required
                maxLength={edit?.type === 'folder' ? 100 : 200}
                value={edit?.name || ''}
                onChange={(e) =>
                  setEdit((current) =>
                    current ? { ...current, name: e.target.value } : null,
                  )
                }
              />
            </label>
            {edit?.type === 'file' && (
              <label>
                Thư mục
                <Select
                  value={edit.folderId || 'root'}
                  onValueChange={(value) =>
                    setEdit((current) =>
                      current
                        ? {
                            ...current,
                            folderId: value === 'root' ? null : String(value),
                          }
                        : null,
                    )
                  }
                >
                  <SelectTrigger aria-label="Chọn thư mục lưu PDF">
                    <SelectValue>{folderPath(edit.folderId)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Ngoài thư mục</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {folderPath(f.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
            {error && (
              <p role="alert" className="vault-form-error">
                {error}
              </p>
            )}
            <button
              className="button primary"
              type="submit"
              disabled={saving || !edit?.name.trim()}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
