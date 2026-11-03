'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Lock,
  User as UserIcon,
  ShieldCheck,
  Send,
  ArrowRight,
  Users,
} from 'lucide-react';
import { User } from '@/lib/types';

interface AvailableAccount {
  id: string;
  username: string;
  name: string;
  role: 'MANAGER' | 'STAFF';
  department: string;
  color: string;
}

interface LoginViewProps {
  availableAccounts: AvailableAccount[];
  onLoginSuccess: (user: Omit<User, 'password'>) => void;
}

export default function LoginView({
  availableAccounts,
  onLoginSuccess,
}: LoginViewProps) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(username, password);
  }

  async function performLogin(u: string, p: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          username: u,
          password: p,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Đăng nhập thất bại');
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
        {/* Left column: Value prop & Quick Switcher */}
        <div className="lg:col-span-7 p-8 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
              <Calendar className="w-3.5 h-3.5" />
              <span>HỆ THỐNG LỊCH LÀM VIỆC & TELEGRAM BOT</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              Quản lý Lịch định kỳ, Lịch tự chọn & Nhắc việc tự động
            </h1>
            <p className="text-slate-400 text-sm mt-3 leading-relaxed">
              Phân quyền bảo mật theo từng nhân sự: Nhân viên chỉ xem và xử lý lịch cá nhân của mình. Quản lý theo dõi tổng thể, điều phối công việc và cài đặt giờ tự động bắn thông báo Telegram.
            </p>

            {/* Quick Login Cards for Testing RBAC */}
            <div className="mt-7">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Chọn nhanh tài khoản để kiểm thử phân quyền (Mật khẩu: 123456)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {availableAccounts.map((acc) => {
                  const isSelected = username.toLowerCase() === acc.username.toLowerCase();
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setUsername(acc.username);
                        setPassword('123456');
                        performLogin(acc.username, '123456');
                      }}
                      className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 group ${
                        isSelected
                          ? 'bg-indigo-600/15 border-indigo-500/60 shadow-sm'
                          : 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 mt-0.5 shadow"
                        style={{ backgroundColor: acc.color }}
                      >
                        {acc.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-white truncate">
                            {acc.name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          @{acc.username} • {acc.department}
                        </div>
                        <div className="mt-1.5">
                          {acc.role === 'MANAGER' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <ShieldCheck className="w-3 h-3" />
                              QUẢN LÝ (Xem toàn bộ NV)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              NHÂN SỰ (Chỉ xem việc riêng)
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-sky-400" />
              Tích hợp Telegram Bot API & Vercel Cron
            </span>
            <span>Múi giờ chuẩn: Asia/Ho_Chi_Minh (GMT+7)</span>
          </div>
        </div>

        {/* Right column: Login Form */}
        <div className="lg:col-span-5 p-8 flex flex-col justify-center bg-slate-900">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Đăng nhập hệ thống</h2>
            <p className="text-xs text-slate-400 mt-1">
              Nhập tài khoản nhân sự hoặc quản lý để truy cập lịch làm việc
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tên đăng nhập (Username)
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="VD: admin, trang, minh..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mật khẩu
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào Lịch làm việc'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 p-3.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="font-semibold text-slate-300">Cơ chế bảo mật phân quyền:</div>
            <div>• <b>Quản lý (admin)</b>: Xem lịch toàn công ty, lọc theo nhân viên, giao việc, thêm/xóa tài khoản nhân sự & cài đặt Bot Telegram.</div>
            <div>• <b>Nhân viên (trang, minh, khanh)</b>: Chỉ nhìn thấy lịch làm việc của cá nhân mình.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
