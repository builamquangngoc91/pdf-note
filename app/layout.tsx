import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Margin — Ghi chú PDF',
  description: 'Không gian đọc, viết tay và ghi chú PDF của bạn.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
