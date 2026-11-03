'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Users,
  Send,
  History,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Shield,
  Search,
  Webhook,
  Sparkles,
} from 'lucide-react';
import { NotificationLog, TelegramConfig, User } from '@/lib/types';

interface StaffAndTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'STAFF' | 'TELEGRAM' | 'LOGS';
  currentUser: Omit<User, 'password'>;
  users: Omit<User, 'password'>[];
  onRefreshData: () => Promise<void>;
}

interface DiscoveredChat {
  chatId: string;
  title: string;
  username?: string;
  type: string;
  lastMessage?: string;
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

export default function StaffAndTelegramModal({
  isOpen,
  onClose,
  initialTab = 'STAFF',
  currentUser,
  users,
  onRefreshData,
}: StaffAndTelegramModalProps) {
  const [activeTab, setActiveTab] = useState<'STAFF' | 'TELEGRAM' | 'LOGS'>(
    initialTab
  );

  // New user form state (for Manager)
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newDepartment, setNewDepartment] = useState('Phòng Kế toán & Thuế');
  const [newRole, setNewRole] = useState<'STAFF' | 'MANAGER'>('STAFF');
  const [newColor, setNewColor] = useState('#0284C7');
  const [newChatId, setNewChatId] = useState('');
  const [newTgUsername, setNewTgUsername] = useState('');

  // Telegram config state
  const [config, setConfig] = useState<TelegramConfig>({
    botToken: '',
    groupChatId: '',
    managerChatId: '',
    dailyDigestEnabled: true,
    dailyDigestTime: '07:30',
    autoWorkerEnabled: true,
    webhookUrl: '',
  });
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [discoveredChats, setDiscoveredChats] = useState<DiscoveredChat[]>([]);
  const [botUsername, setBotUsername] = useState('');
  const [statusMsg, setStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  // Editable Chat IDs per user
  const [userChatEdits, setUserChatEdits] = useState<Record<string, string>>({});
  const [userPasswordEdits, setUserPasswordEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      loadTelegramData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const map: Record<string, string> = {};
      for (const u of users) {
        map[u.id] = u.telegramChatId || '';
      }
      setUserChatEdits(map);
    }
  }, [isOpen, users]);

  async function loadTelegramData() {
    try {
      const res = await fetch('/api/telegram', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          if (data.config.botUsername) setBotUsername(data.config.botUsername);
        }
        if (data.logs) setLogs(data.logs);
      }
    } catch {
      // ignore
    }
  }

  if (!isOpen) return null;

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUsername.trim()) return;
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          username: newUsername,
          password: newPassword || '123456',
          department: newDepartment,
          role: newRole,
          color: newColor,
          telegramChatId: newChatId,
          telegramUsername: newTgUsername,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'Lỗi tạo tài khoản' });
      } else {
        setStatusMsg({
          type: 'success',
          text: `Đã tạo tài khoản "${data.user.username}" cho ${data.user.name}`,
        });
        setNewName('');
        setNewUsername('');
        setNewChatId('');
        setNewTgUsername('');
        await onRefreshData();
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleUpdateUserChatAndPass(userId: string) {
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          telegramChatId: userChatEdits[userId] || '',
          ...(userPasswordEdits[userId]
            ? { password: userPasswordEdits[userId] }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'Lỗi cập nhật' });
      } else {
        setStatusMsg({
          type: 'success',
          text: `Đã lưu cập nhật cho ${data.user.name}!`,
        });
        setUserPasswordEdits((prev) => ({ ...prev, [userId]: '' }));
        await onRefreshData();
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản nhân sự "${name}"?`)) return;
    const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
    if (res.ok) {
      setStatusMsg({ type: 'success', text: `Đã xóa nhân sự ${name}` });
      await onRefreshData();
    }
  }

  async function handleSaveTelegramConfig(e: React.FormEvent) {
    e.preventDefault();
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          ...config,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'error', text: data.error || 'Lỗi lưu cấu hình' });
      } else {
        if (data.config) {
          setConfig(data.config);
        }
        setStatusMsg({
          type: 'success',
          text: 'Đã lưu cấu hình Telegram Bot & Giờ báo tự động thành công!',
        });
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleDiscoverChats() {
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discover_chats',
          botToken: config.botToken,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatusMsg({
          type: 'error',
          text: data.error || 'Không quét được danh sách chat',
        });
      } else {
        setDiscoveredChats(data.chats || []);
        if (data.botInfo?.username) setBotUsername(data.botInfo.username);
        setStatusMsg({
          type: 'success',
          text: `Kết nối thành công tới Bot @${data.botInfo?.username}! Tìm thấy ${data.chats?.length || 0} cuộc hội thoại gần đây.`,
        });
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleSendTestMessage(targetChatId?: string) {
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_message',
          botToken: config.botToken,
          chatId: targetChatId,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatusMsg({
          type: 'error',
          text: `Gửi thất bại: ${data.error}`,
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: 'Đã bắn tin nhắn Test vào Telegram thành công! Hãy kiểm tra ứng dụng Telegram của bạn.',
        });
        await loadTelegramData();
      }
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleTriggerCronNow() {
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/cron/notify', {
        method: 'POST',
        headers: { 'x-internal-heartbeat': '1' },
      });
      const data = await res.json();
      await loadTelegramData();
      setStatusMsg({
        type: 'success',
        text: `Đã quét lịch lúc ${data.vietnamTime} (${data.vietnamDate}): Đã gửi ${data.sentCount} thông báo đến hạn.`,
      });
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRegisterWebhook() {
    setLoadingAction(true);
    setStatusMsg(null);
    try {
      const defaultWebhook =
        config.webhookUrl || `${window.location.origin}/api/telegram/webhook`;
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_webhook',
          botToken: config.botToken,
          webhookUrl: defaultWebhook,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig((prev) => ({ ...prev, webhookUrl: defaultWebhook }));
        setStatusMsg({
          type: 'success',
          text: `Đã kích hoạt Telegram Webhook về ${defaultWebhook}!`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: data.description || data.error || 'Không thể cài đặt Webhook (cần chạy trên HTTPS/Vercel)',
        });
      }
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              {currentUser.role === 'MANAGER'
                ? 'Quản trị Nhân Sự, Phân Quyền & Cấu hình Telegram Bot'
                : 'Tài khoản Cá nhân & Kết nối Telegram Nhắc Việc'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentUser.role === 'MANAGER'
                ? 'Tạo tài khoản riêng cho từng nhân viên, gán Chat ID Telegram và thiết lập bắn thông báo tự động'
                : 'Cấu hình Telegram Chat ID cá nhân để nhận lịch làm việc tự động đúng giờ'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('STAFF')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'STAFF'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-sm'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              {currentUser.role === 'MANAGER'
                ? `Tài khoản Nhân sự (${users.length})`
                : 'Tài khoản & Telegram của tôi'}
            </span>
          </button>

          {currentUser.role === 'MANAGER' && (
            <button
              type="button"
              onClick={() => setActiveTab('TELEGRAM')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'TELEGRAM'
                  ? 'bg-white text-sky-600 border-sky-600 shadow-sm'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>Cấu hình Telegram Bot & Vercel Cron</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('LOGS')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'LOGS'
                ? 'bg-white text-emerald-600 border-emerald-600 shadow-sm'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Nhật ký Thông báo ({logs.length})</span>
          </button>
        </div>

        {/* Status Banner */}
        {statusMsg && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: QUẢN LÝ TÀI KHOẢN NHÂN SỰ */}
          {activeTab === 'STAFF' && (
            <div className="space-y-6">
              {/* Danh sách nhân sự hiện tại */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3">
                  {currentUser.role === 'MANAGER'
                    ? 'Danh sách Tài khoản Nhân sự & Liên kết Telegram'
                    : 'Thông tin Tài khoản & Telegram Cá nhân'}
                </h3>

                <div className="space-y-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow"
                          style={{ backgroundColor: u.color }}
                        >
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900">
                              {u.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-mono">
                              @{u.username}
                            </span>
                            {u.role === 'MANAGER' ? (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                QUẢN LÝ (Xem toàn bộ)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                NHÂN SỰ (Chỉ xem lịch riêng)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Phòng ban: <b>{u.department}</b>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-col">
                          <label className="text-[10px] font-semibold text-slate-500 mb-0.5">
                            Telegram Chat ID cá nhân
                          </label>
                          <input
                            type="text"
                            value={userChatEdits[u.id] ?? ''}
                            onChange={(e) =>
                              setUserChatEdits((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                            placeholder="VD: 582910384"
                            className="w-40 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                          />
                        </div>

                        <div className="flex flex-col">
                          <label className="text-[10px] font-semibold text-slate-500 mb-0.5">
                            Đổi mật khẩu mới (nếu cần)
                          </label>
                          <input
                            type="password"
                            value={userPasswordEdits[u.id] ?? ''}
                            onChange={(e) =>
                              setUserPasswordEdits((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                            placeholder="Giữ nguyên..."
                            className="w-32 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>

                        <div className="flex items-end gap-1.5 pt-4">
                          <button
                            type="button"
                            onClick={() => handleUpdateUserChatAndPass(u.id)}
                            disabled={loadingAction}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                          >
                            Lưu
                          </button>

                          {userChatEdits[u.id] && (
                            <button
                              type="button"
                              onClick={() => handleSendTestMessage(userChatEdits[u.id])}
                              disabled={loadingAction}
                              className="px-2.5 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-xs font-bold flex items-center gap-1"
                              title="Bắn thử tin nhắn Telegram cho nhân sự này"
                            >
                              <Send className="w-3 h-3" />
                              Test
                            </button>
                          )}

                          {currentUser.role === 'MANAGER' && u.id !== currentUser.id && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                              title="Xóa tài khoản nhân sự"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Thêm Nhân Sự Mới (Chỉ dành cho Quản lý) */}
              {currentUser.role === 'MANAGER' && (
                <form
                  onSubmit={handleCreateStaff}
                  className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4"
                >
                  <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    <span>Thêm Tài Khoản Nhân Sự Mới</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Họ và tên nhân sự *
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="VD: Thu Hà (Kế toán viên)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tên đăng nhập (Username) *
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="VD: thuha"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mật khẩu khởi tạo *
                      </label>
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phòng ban / Chức vụ
                      </label>
                      <input
                        type="text"
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Phân quyền hệ thống
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as 'STAFF' | 'MANAGER')}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold"
                      >
                        <option value="STAFF">NHÂN SỰ (Chỉ xem được lịch của mình)</option>
                        <option value="MANAGER">QUẢN LÝ (Xem & giao việc toàn công ty)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Telegram Chat ID (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={newChatId}
                        onChange={(e) => setNewChatId(e.target.value)}
                        placeholder="Điền hoặc quét tự động ở Tab 2"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">
                        Màu hiển thị trên lịch:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewColor(c)}
                            className={`w-6 h-6 rounded-full border-2 transition ${
                              newColor === c
                                ? 'border-slate-900 scale-110'
                                : 'border-transparent'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loadingAction}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow"
                    >
                      + Tạo Tài Khoản Nhân Sự
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: CẤU HÌNH TELEGRAM BOT & VERCEL CRON */}
          {activeTab === 'TELEGRAM' && currentUser.role === 'MANAGER' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveTelegramConfig}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-4 h-4 text-sky-600" />
                    <span>Kết nối Bot Telegram (Bạn đã có sẵn Bot)</span>
                  </h3>
                  {botUsername && (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      Đã kết nối: @{botUsername}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Telegram Bot Token (Từ @BotFather) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={config.botToken}
                        onChange={(e) =>
                          setConfig({ ...config, botToken: e.target.value })
                        }
                        placeholder="VD: 7482910482:AAHxyz123456789..."
                        className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleDiscoverChats}
                        disabled={loadingAction}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Quét người vừa nhắn Bot</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chat ID của Quản lý (Nhận báo cáo & cảnh báo)
                    </label>
                    <input
                      type="text"
                      value={config.managerChatId}
                      onChange={(e) =>
                        setConfig({ ...config, managerChatId: e.target.value })
                      }
                      placeholder="VD: 582910384"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Group Chat ID chung công ty (Nếu bắn vào nhóm)
                    </label>
                    <input
                      type="text"
                      value={config.groupChatId}
                      onChange={(e) =>
                        setConfig({ ...config, groupChatId: e.target.value })
                      }
                      placeholder="VD: -100192837465"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Giờ gửi Bản tin tổng hợp sáng (Daily Digest)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={config.dailyDigestTime}
                        onChange={(e) =>
                          setConfig({ ...config, dailyDigestTime: e.target.value })
                        }
                        className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                      />
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={config.dailyDigestEnabled}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dailyDigestEnabled: e.target.checked,
                            })
                          }
                          className="rounded text-indigo-600"
                        />
                        <span>Tự động gửi tổng hợp mỗi sáng</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendTestMessage()}
                      disabled={loadingAction}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Bắn tin nhắn Test</span>
                    </button>
                    <button
                      type="submit"
                      disabled={loadingAction}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow"
                    >
                      Lưu Cấu Hình Bot
                    </button>
                  </div>
                </div>
              </form>

              {/* Danh sách người dùng vừa quét được từ Bot */}
              {discoveredChats.length > 0 && (
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-3">
                  <div className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>
                      Các tài khoản / Group vừa nhắn tin cho Bot (Chọn nhân sự để gán Chat ID 1-Click):
                    </span>
                  </div>
                  <div className="space-y-2">
                    {discoveredChats.map((ch) => (
                      <div
                        key={ch.chatId}
                        className="p-3 bg-white rounded-xl border border-sky-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{ch.title}</span>{' '}
                          {ch.username && (
                            <span className="text-slate-500">(@{ch.username})</span>
                          )}
                          <span className="ml-2 px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-indigo-700">
                            ID: {ch.chatId}
                          </span>
                          <span className="ml-2 text-slate-400">[{ch.type}]</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            onChange={async (e) => {
                              const targetUid = e.target.value;
                              if (!targetUid) return;
                              if (targetUid === '__GROUP__') {
                                setConfig((prev) => ({
                                  ...prev,
                                  groupChatId: ch.chatId,
                                }));
                                setStatusMsg({
                                  type: 'success',
                                  text: `Đã điền ID ${ch.chatId} vào ô Group Chat ID chung! Hãy bấm Lưu Cấu Hình Bot.`,
                                });
                                return;
                              }
                              setUserChatEdits((prev) => ({
                                ...prev,
                                [targetUid]: ch.chatId,
                              }));
                              await fetch('/api/users', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: targetUid,
                                  telegramChatId: ch.chatId,
                                  telegramUsername: ch.username || '',
                                }),
                              });
                              await onRefreshData();
                              setStatusMsg({
                                type: 'success',
                                text: `Đã gán Chat ID ${ch.chatId} cho nhân sự thành công!`,
                              });
                            }}
                            defaultValue=""
                            className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-semibold"
                          >
                            <option value="">-- Gán Chat ID này cho... --</option>
                            <option value="__GROUP__">👥 Đặt làm Group chung công ty</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                👤 Gán cho: {u.name} (@{u.username})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cài đặt Webhook & Hướng dẫn chạy tự động 24/7 trên Vercel */}
              <div className="p-5 rounded-2xl bg-slate-900 text-slate-200 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-indigo-400" />
                    <span>Chạy tự động 24/7 trên Vercel (Không cần bật máy tính)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegisterWebhook}
                    disabled={loadingAction}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold"
                  >
                    Kích hoạt Telegram Webhook 1-Click
                  </button>
                </div>
                <div className="space-y-1.5 text-slate-300 leading-relaxed">
                  <div>
                    1. <b>Endpoint quét & bắn lịch tự động:</b>{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                      /api/cron/notify
                    </code>{' '}
                    — Đã tích hợp sẵn file <code>vercel.json</code> và GitHub Actions{' '}
                    <code>.github/workflows/cron-notify.yml</code> (hoặc bạn dán link{' '}
                    <code>https://ten-web.vercel.app/api/cron/notify</code> vào{' '}
                    <b>cron-job.org</b> chọn mỗi 1 phút <code>* * * * *</code> hoàn toàn miễn phí).
                  </div>
                  <div>
                    2. <b>Endpoint nhận nút bấm Hoàn thành / Nhắc lại từ Telegram:</b>{' '}
                    <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">
                      /api/telegram/webhook
                    </code>{' '}
                    — Khi nhân sự bấm nút <b>[✅ Đã hoàn thành]</b> dưới tin nhắn Telegram, lịch trên Web tự động chuyển sang Hoàn thành ngay lập tức.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NHẬT KÝ BẮN THÔNG BÁO TELEGRAM */}
          {activeTab === 'LOGS' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Lịch sử bắn thông báo Telegram gần đây
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hệ thống tự động chống trùng lặp (mỗi khung giờ hẹn chỉ bắn 1 lần cho mỗi công việc)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerCronNow}
                  disabled={loadingAction}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
                  <span>Quét & Bắn thông báo đến hạn ngay</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                  Chưa có nhật ký thông báo nào. Bạn có thể bấm nút <b>&quot;Bắn Telegram ngay&quot;</b> trên bất kỳ công việc nào để kiểm thử!
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SENT'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {log.status === 'SENT' ? 'ĐÃ GỬI TELEGRAM' : 'LỖI GỬI'}
                          </span>
                          <span className="font-bold text-slate-900">
                            {log.taskTitle}
                          </span>
                        </div>
                        <div className="text-slate-500">
                          Nhân sự: <b>{log.assigneeName}</b> • Ngày công việc:{' '}
                          <b>{log.occurrenceDate}</b> • Mốc:{' '}
                          <code className="px-1 py-0.5 bg-slate-100 rounded">
                            {log.notifyTimeSlot}
                          </code>{' '}
                          • Chat ID: <code>{log.targetChatId}</code>
                        </div>
                        {log.error && (
                          <div className="text-rose-600 font-medium">
                            Chi tiết lỗi: {log.error}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 shrink-0">
                        {new Date(log.sentAt).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
