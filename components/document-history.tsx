'use client';
import { useEffect, useState } from 'react';
import { History, Loader2, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { Doc, Version } from '@/lib/annotations';

const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
export function DocumentHistory({
  document,
  onClose,
  onRestore,
  disabled,
}: {
  document: Doc | null;
  onClose(): void;
  onRestore(version: Version): Promise<void>;
  disabled: boolean;
}) {
  const [versions, setVersions] = useState<Version[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [selected, setSelected] = useState<Version | null>(null),
    [saving, setSaving] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    setSelected(null);
    setVersions([]);
    setError('');
    if (!document) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch(`/api/documents/${document.id}/versions`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('Không tải được lịch sử của PDF này.');
        setVersions((await response.json()) as Version[]);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [document?.id, revision]);
  async function restore() {
    if (!selected || selected.documentId !== document?.id) return;
    setSaving(true);
    setError('');
    try {
      await onRestore(selected);
      setSelected(null);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Không khôi phục được phiên bản.',
      );
    } finally {
      setSaving(false);
    }
  }
  const ownVersions = versions.filter((v) => v.documentId === document?.id);
  return (
    <>
      <Dialog
        open={!!document}
        onOpenChange={(open) => {
          if (!open && !saving) onClose();
        }}
      >
        <DialogContent className="pdf-history-dialog">
          <DialogTitle className="library-title">
            <History size={23} />
            Lịch sử PDF
          </DialogTitle>
          <DialogDescription className="pdf-history-filename">
            {document?.name}
          </DialogDescription>
          <p className="pdf-history-hint">
            100 phiên bản gần nhất của tài liệu này
          </p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
              <button onClick={() => setRevision((r) => r + 1)}>Thử lại</button>
            </div>
          )}
          <div className="pdf-history-list">
            {loading ? (
              <div className="vault-empty" role="status">
                <Loader2 className="spin" size={24} />
                Đang tải lịch sử…
              </div>
            ) : ownVersions.length === 0 ? (
              <div className="vault-empty">
                <History size={32} />
                <p>
                  PDF này chưa có lịch sử. Phiên bản sẽ được lưu khi bạn chỉnh
                  sửa.
                </p>
              </div>
            ) : (
              ownVersions.map((version) => (
                <article className="version-row" key={version.id}>
                  <span className="version-dot" />
                  <div>
                    <strong>
                      {version.kind === 'initial'
                        ? 'Bản trước khi chỉnh sửa'
                        : version.kind === 'restore'
                          ? 'Đã khôi phục phiên bản'
                          : 'Tự động lưu'}
                    </strong>
                    <p>{date(version.createdAt)}</p>
                  </div>
                  <button
                    className="button"
                    disabled={disabled || saving}
                    onClick={() => setSelected(version)}
                  >
                    <RotateCcw size={15} />
                    Khôi phục
                  </button>
                </article>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !saving) setSelected(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Khôi phục phiên bản của PDF này?</AlertDialogTitle>
          <AlertDialogDescription>
            {document?.name} — {selected ? date(selected.createdAt) : ''}. Bản
            hiện tại của tài liệu vẫn được giữ trong lịch sử.
          </AlertDialogDescription>
          {error && (
            <p className="vault-form-error" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Hủy</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void restore()}>
              {saving ? 'Đang khôi phục…' : 'Khôi phục'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
