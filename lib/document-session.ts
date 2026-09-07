import type { Doc } from './annotations';

export function startupDocument(
  records: Doc[],
  requested: string | null,
  sample: Doc,
): Doc {
  if (requested === sample.id) return sample;
  if (requested) {
    const record = records.find((item) => item.id === requested);
    if (!record)
      throw new Error(
        'Không tìm thấy PDF trong liên kết này. Hãy mở file từ thư viện.',
      );
    return record;
  }
  return (
    [...records].sort((a, b) =>
      (b.lastOpenedAt || b.updatedAt).localeCompare(
        a.lastOpenedAt || a.updatedAt,
      ),
    )[0] || sample
  );
}
