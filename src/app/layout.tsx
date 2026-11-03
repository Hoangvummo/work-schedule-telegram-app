import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartSchedule & Telegram — Lịch Trình Cá Nhân & Nhắc Việc Tự Động',
  description:
    'Ứng dụng lên lịch định kỳ, lịch tự chọn theo ngày và tự động thông báo Telegram theo giờ tự chọn.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
