'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Lock,
  User as UserIcon,
  Send,
  ArrowRight,
  Repeat,
  CalendarDays,
  Bell,
  Sparkles,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { User } from '@/lib/types';

interface LoginViewProps {
  onLoginSuccess: (user: Omit<User, 'password'>) => void;
}

const PRESET_COLORS = [
  '#4F46E5',
  '#059669',
  '#D97706',
  '#E11D48',
  '#7C3AED',
  '#0284C7',
  '#0D9488',
  '#EA580C',
];

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'LOGIN'
            ? {
                action: 'login',
                username,
                password,
              }
            : {
                action: 'register',
                username,
                password,
                name: displayName.trim() || username.trim(),
                color,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.error ||
            (mode === 'LOGIN' ? 'Đăng nhập thất bại' : 'Đăng ký tài khoản thất bại')
        );
      } else {
        onLoginSuccess(data.user);
      }
    } catch {
      setError('Không thể kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Left column: App Introduction & Features */}
        <div className="lg:col-span-7 p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
              <Calendar className="w-3.5 h-3.5" />
              <span>SMART SCHEDULE & TELEGRAM REMINDER</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              Lên Lịch Cá Nhân, Chu Kỳ Định Kỳ & Nhắc Việc Tự Động Qua Telegram
            </h1>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Thiết lập và theo dõi mọi kế hoạch, thói quen, lịch hẹn và mục tiêu cá nhân của bạn trên một giao diện trực quan, tự động bắn thông báo nhắc nhở đúng giờ vào Telegram.
            </p>

            {/* Feature cards */}
            <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-800/45 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                  <Repeat className="w-4 h-4" />
                  <span>Lịch định kỳ tùy biến</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tự do hẹn lịch lặp lại mỗi 2 ngày 1 lần, 3 ngày 1 lần, theo các thứ trong tuần hoặc ngày cố định trong tháng.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/45 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CalendarDays className="w-4 h-4" />
                  <span>Lịch tự chọn theo ngày</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click chọn nhanh nhiều ngày bất kỳ trên lịch tương tác hoặc lên lịch cho 1 ngày cụ thể kèm checklist chi tiết.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/45 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                  <Bell className="w-4 h-4" />
                  <span>Báo Telegram theo giờ tự chọn</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chọn nhiều khung giờ bất kỳ trong ngày để hệ thống tự động nhắn tin Telegram kèm nút bấm Hoàn thành / Nhắc lại.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/45 border border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Không gian riêng tư & Đa chế độ xem</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mỗi tài khoản sở hữu không gian lịch độc lập với 4 chế độ trực quan: Lịch Tháng, Lịch Tuần, Danh sách & Bảng Kanban.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-sky-400" />
              Đồng bộ thông báo Telegram 24/7
            </span>
            <span>Múi giờ: Asia/Ho_Chi_Minh (GMT+7)</span>
          </div>
        </div>

        {/* Right column: Login & Register Form */}
        <div className="lg:col-span-5 p-8 flex flex-col justify-center bg-slate-900">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'LOGIN'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                mode === 'REGISTER'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Đăng ký tài khoản</span>
            </button>
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">
              {mode === 'LOGIN' ? 'Đăng nhập vào Lịch của bạn' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'LOGIN'
                ? 'Nhập tên đăng nhập và mật khẩu để mở không gian lịch cá nhân'
                : 'Tự do đặt tên hiển thị theo ý thích để bắt đầu quản lý lịch trình'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Tên hiển thị (Đặt tùy ý theo sở thích)
                </label>
                <div className="relative">
                  <Sparkles className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="VD: Alex, Minh, Lịch Cá Nhân..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tên đăng nhập (Username) *
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mật khẩu *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {mode === 'REGISTER' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Chọn màu chủ đề yêu thích
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition ${
                        color === c ? 'border-white scale-110' : 'border-transparent opacity-75'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 mt-2"
            >
              <span>
                {loading
                  ? 'Đang xử lý...'
                  : mode === 'LOGIN'
                  ? 'Đăng nhập ngay'
                  : 'Đăng ký & Bắt đầu sử dụng'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
