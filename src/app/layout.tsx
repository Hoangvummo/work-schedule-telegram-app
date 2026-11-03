import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkFlow & Telegram Scheduler — Hệ thống Quản lý Lịch Làm Việc',
  description:
    'Hệ thống lên lịch làm việc định kỳ, lịch tự chọn theo ngày, phân quyền nhân sự và tự động thông báo Telegram theo giờ tự chọn.',
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
