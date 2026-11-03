'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Send,
  Users,
  CheckCircle2,
  Clock,
  Repeat,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  ShieldCheck,
  Lock,
  LayoutGrid,
  ListTodo,
  Columns,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import {
  OccurrenceState,
  ScheduleTask,
  TaskOccurrenceInstance,
  User,
} from '@/lib/types';
import {
  addDaysToDateStr,
  formatDisplayDateVN,
  formatScheduleSummary,
} from '@/lib/recurrence';
import LoginView from '@/components/LoginView';
import TaskFormModal from '@/components/TaskFormModal';
import StaffAndTelegramModal from '@/components/StaffAndTelegramModal';

type ViewMode = 'MONTH' | 'WEEK' | 'AGENDA' | 'KANBAN';

const CATEGORY_BADGES: Record<string, { label: string; cls: string }> = {
  TAX_ACCOUNTING: {
    label: '📊 Kế toán - Thuế',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  CLIENT: {
    label: '🤝 Khách hàng',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  MEETING: {
    label: '📅 Họp nội bộ',
    cls: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  REPORT: {
    label: '📑 Báo cáo',
    cls: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  MARKETING: {
    label: '📣 Marketing',
    cls: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  OPERATION: {
    label: '⚙️ Vận hành',
    cls: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
  OTHER: {
    label: '📌 Khác',
    cls: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

const PRIORITY_BADGES: Record<string, { label: string; cls: string }> = {
  LOW: { label: 'Thấp', cls: 'bg-slate-100 text-slate-600' },
  MEDIUM: { label: 'Trung bình', cls: 'bg-sky-100 text-sky-700' },
  HIGH: { label: 'Cao', cls: 'bg-amber-100 text-amber-800' },
  URGENT: { label: 'Khẩn cấp', cls: 'bg-rose-100 text-rose-700 font-bold' },
};

const DOW_HEADERS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

export default function WorkScheduleAppPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<Omit<User, 'password'> | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<
    Array<{
      id: string;
      username: string;
      name: string;
      role: 'MANAGER' | 'STAFF';
      department: string;
      color: string;
    }>
  >([]);

  // Main Schedule State
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [occurrences, setOccurrences] = useState<TaskOccurrenceInstance[]>([]);
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [todayVN, setTodayVN] = useState<string>('2026-11-03');
  const [timeVN, setTimeVN] = useState<string>('09:00');

  // Navigation & Filters
  const [viewMode, setViewMode] = useState<ViewMode>('MONTH');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-03');
  const [currentMonth, setCurrentMonth] = useState<{ year: number; month: number }>({
    year: 2026,
    month: 10, // 0-indexed (10 = Nov)
  });
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('ALL');
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminModalTab, setAdminModalTab] = useState<'STAFF' | 'TELEGRAM' | 'LOGS'>('STAFF');

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  function showToast(type: 'success' | 'error', text: string) {
    setToast({ type, text });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }

  const checkAuthentication = useCallback(async () => {
    try {
      const res = await fetch('/api/auth', { cache: 'no-store' });
      const data = await res.json();
      if (data.availableAccounts) {
        setAvailableAccounts(data.availableAccounts);
      }
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      // ignore
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const fetchScheduleData = useCallback(
    async (overrideMonth?: { year: number; month: number }, overrideAssignee?: string) => {
      if (!currentUser) return;
      try {
        const activeMonth = overrideMonth || currentMonth;
        const activeAssignee = overrideAssignee ?? selectedAssigneeId;

        // Compute range covering current month +/- 45 days
        const baseStr = `${activeMonth.year}-${String(activeMonth.month + 1).padStart(2, '0')}-01`;
        const startRange = addDaysToDateStr(baseStr, -15);
        const endRange = addDaysToDateStr(baseStr, 60);

        const params = new URLSearchParams({
          startDate: startRange,
          endDate: endRange,
        });
        if (currentUser.role === 'MANAGER' && activeAssignee !== 'ALL') {
          params.set('assigneeId', activeAssignee);
        }

        const res = await fetch(`/api/tasks?${params.toString()}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setTasks(data.tasks || []);
          setOccurrences(data.occurrences || []);
          setUsers(data.users || []);
          if (data.serverTimeVN?.dateStr) {
            setTodayVN(data.serverTimeVN.dateStr);
            setTimeVN(data.serverTimeVN.timeStr);
          }
        }
      } catch {
        // ignore
      }
    },
    [currentUser, currentMonth, selectedAssigneeId]
  );

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  useEffect(() => {
    if (currentUser) {
      fetchScheduleData();
    }
  }, [currentUser, fetchScheduleData]);

  // Set initial selected date to server Vietnam date once loaded
  useEffect(() => {
    if (todayVN) {
      setSelectedDate(todayVN);
      const [y, m] = todayVN.split('-').map(Number);
      if (y && m) {
        setCurrentMonth({ year: y, month: m - 1 });
      }
    }
  }, [todayVN]);

  // Background heartbeat to trigger notification worker every 30s
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/cron/notify', {
          method: 'POST',
          headers: { 'x-internal-heartbeat': '1' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.vietnamTime) setTimeVN(data.vietnamTime);
          if (data.sentCount > 0) {
            showToast(
              'success',
              `🔔 Đã tự động bắn ${data.sentCount} thông báo lịch làm việc vào Telegram lúc ${data.vietnamTime}!`
            );
          }
        }
      } catch {
        // ignore
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [currentUser]);

  async function handleLogout() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setCurrentUser(null);
    setSelectedAssigneeId('ALL');
    await checkAuthentication();
  }

  async function handleQuickSwitchAccount(username: string) {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        username,
        password: '123456',
      }),
    });
    const data = await res.json();
    if (data.ok && data.user) {
      setCurrentUser(data.user);
      setSelectedAssigneeId('ALL');
      showToast(
        'success',
        `Đã chuyển sang tài khoản: ${data.user.name} (${
          data.user.role === 'MANAGER' ? 'Quản lý - Xem toàn bộ' : 'Nhân sự - Chỉ xem việc riêng'
        })`
      );
    }
  }

  async function handleSaveTask(taskPayload: Partial<ScheduleTask>) {
    const isEdit = Boolean(taskPayload.id);
    const res = await fetch('/api/tasks', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskPayload),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const savedTask: ScheduleTask = data.task;
      let nextMonth = currentMonth;
      let nextAssignee = selectedAssigneeId;

      if (
        selectedAssigneeId !== 'ALL' &&
        savedTask.assigneeId !== selectedAssigneeId
      ) {
        nextAssignee = 'ALL';
        setSelectedAssigneeId('ALL');
      }
      if (
        scheduleTypeFilter !== 'ALL' &&
        savedTask.scheduleType !== scheduleTypeFilter
      ) {
        setScheduleTypeFilter('ALL');
      }

      // Tự động nhảy lịch tới ngày bắt đầu của công việc vừa tạo để hiển thị ngay trước mắt
      const focusDate =
        savedTask.scheduleType === 'SINGLE'
          ? savedTask.singleDate
          : savedTask.scheduleType === 'MULTI_DATE'
          ? savedTask.selectedDates?.[0]
          : savedTask.recurrence?.startDate;

      if (focusDate) {
        setSelectedDate(focusDate);
        const [fy, fm] = focusDate.split('-').map(Number);
        if (fy && fm) {
          nextMonth = { year: fy, month: fm - 1 };
          setCurrentMonth(nextMonth);
        }
      }

      showToast(
        'success',
        isEdit
          ? `Đã cập nhật lịch "${savedTask.title}"`
          : `Đã tạo lịch làm việc "${savedTask.title}" thành công!`
      );
      await fetchScheduleData(nextMonth, nextAssignee);
    } else {
      showToast('error', data.error || 'Lỗi lưu lịch làm việc');
    }
  }

  async function handleUpdateOccurrenceStatus(
    taskId: string,
    dateStr: string,
    newStatus: OccurrenceState
  ) {
    const res = await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_occurrence',
        taskId,
        date: dateStr,
        status: newStatus,
      }),
    });
    if (res.ok) {
      await fetchScheduleData();
      showToast(
        'success',
        newStatus === 'DONE'
          ? `✅ Đã đánh dấu Hoàn thành buổi làm việc ngày ${formatDisplayDateVN(dateStr)}`
          : `Đã cập nhật trạng thái ngày ${formatDisplayDateVN(dateStr)}`
      );
    }
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string) {
    const res = await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_subtask',
        taskId,
        subtaskId,
      }),
    });
    if (res.ok) {
      await fetchScheduleData();
    }
  }

  async function handleDeleteTask(task: ScheduleTask) {
    if (!confirm(`Bạn có chắc muốn xóa lịch làm việc "${task.title}"?`)) return;
    const res = await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('success', `Đã xóa lịch "${task.title}"`);
      await fetchScheduleData();
    }
  }

  async function handleSendTaskTelegramNow(task: ScheduleTask, dateStr: string) {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_task_now',
        taskId: task.id,
        date: dateStr,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(
        'success',
        `🚀 Đã bắn thông báo công việc "${task.title}" vào Telegram thành công!`
      );
    } else {
      const errDetail =
        data.logs?.[0]?.error ||
        data.error ||
        'Chưa cấu hình Telegram Bot Token hoặc Chat ID nhân sự';
      showToast('error', `Không gửi được Telegram: ${errDetail}`);
      setAdminModalTab('TELEGRAM');
      setIsAdminModalOpen(true);
    }
  }

  // Filtered occurrences based on searchQuery and scheduleTypeFilter
  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occ) => {
      if (
        scheduleTypeFilter !== 'ALL' &&
        occ.task.scheduleType !== scheduleTypeFilter
      ) {
        return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = occ.task.title.toLowerCase().includes(q);
        const matchDesc = (occ.task.description || '').toLowerCase().includes(q);
        const matchAssignee = (occ.assignee?.name || '').toLowerCase().includes(q);
        return matchTitle || matchDesc || matchAssignee;
      }
      return true;
    });
  }, [occurrences, scheduleTypeFilter, searchQuery]);

  // Group occurrences by YYYY-MM-DD
  const occurrencesByDate = useMemo(() => {
    const map: Record<string, TaskOccurrenceInstance[]> = {};
    for (const occ of filteredOccurrences) {
      if (!map[occ.date]) map[occ.date] = [];
      map[occ.date].push(occ);
    }
    return map;
  }, [filteredOccurrences]);

  // Build Month Calendar Grid cells
  const monthCalendarCells = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

    const cells: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];

    // Leading days from previous month
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthNum = month === 0 ? 12 : month;
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i;
      cells.push({
        dateStr: `${prevYear}-${String(prevMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    const curMonthNum = month + 1;
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        dateStr: `${year}-${String(curMonthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days to complete 35 or 42 grid
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonthNum = month === 11 ? 1 : month + 2;
    const targetLen = cells.length > 35 ? 42 : 35;
    let nextDay = 1;
    while (cells.length < targetLen) {
      cells.push({
        dateStr: `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`,
        dayNum: nextDay,
        isCurrentMonth: false,
      });
      nextDay++;
    }

    return cells;
  }, [currentMonth]);

  // Build Week days around selectedDate
  const weekDaysList = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y || 2026, (m || 11) - 1, d || 1));
    const dow = dt.getUTCDay();
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;
    const mondayStr = addDaysToDateStr(selectedDate, offsetToMonday);
    return Array.from({ length: 7 }, (_, idx) => ({
      dateStr: addDaysToDateStr(mondayStr, idx),
      label: DOW_HEADERS[idx],
    }));
  }, [selectedDate]);

  // Stats for KPI Cards
  const stats = useMemo(() => {
    const todayList = occurrencesByDate[todayVN] || [];
    const doneToday = todayList.filter((o) => o.status === 'DONE').length;
    const recurringCount = tasks.filter((t) => t.scheduleType === 'RECURRING').length;
    const multiDateCount = tasks.filter((t) => t.scheduleType === 'MULTI_DATE').length;
    return {
      todayTotal: todayList.length,
      doneToday,
      pendingToday: todayList.length - doneToday,
      recurringCount,
      multiDateCount,
    };
  }, [occurrencesByDate, todayVN, tasks]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 text-sm">
        Đang tải hệ thống lịch làm việc...
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginView
        availableAccounts={availableAccounts}
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          checkAuthentication();
        }}
      />
    );
  }

  const selectedDayOccurrences = occurrencesByDate[selectedDate] || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 max-w-md px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-indigo-500'
              : 'bg-rose-950 text-rose-100 border-rose-500'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Role Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight">
                  WorkSchedule & Telegram Pro
                </h1>
                {currentUser.role === 'MANAGER' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    QUẢN LÝ (Xem toàn bộ NV)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <Lock className="w-3 h-3" />
                    NHÂN SỰ (Chỉ xem lịch cá nhân)
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>
                  Xin chào, <b className="text-slate-200">{currentUser.name}</b> ({currentUser.department})
                </span>
                <span>•</span>
                <span className="text-sky-400 font-medium">
                  🕒 Giờ VN: {timeVN} ({formatDisplayDateVN(todayVN)})
                </span>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Role/Account Switcher for instant testing */}
            <div className="hidden xl:flex items-center gap-1 bg-slate-800/90 border border-slate-700 rounded-xl p-1 mr-1">
              <span className="text-[11px] text-slate-400 px-2 font-medium">
                Đổi nhanh TK:
              </span>
              {availableAccounts.map((acc) => {
                const active = acc.id === currentUser.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleQuickSwitchAccount(acc.username)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                      active
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    title={`Chuyển sang tài khoản ${acc.name} (${acc.role})`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: acc.color }}
                    />
                    <span>{acc.username}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setIsTaskModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo Lịch Làm Việc</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminModalTab(currentUser.role === 'MANAGER' ? 'TELEGRAM' : 'STAFF');
                setIsAdminModalOpen(true);
              }}
              className="px-3.5 py-2 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {currentUser.role === 'MANAGER' ? 'Cài đặt Telegram Bot' : 'Kết nối Telegram'}
              </span>
            </button>

            {currentUser.role === 'MANAGER' && (
              <button
                type="button"
                onClick={() => {
                  setAdminModalTab('STAFF');
                  setIsAdminModalOpen(true);
                }}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span>Nhân sự ({users.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 rounded-xl transition"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5 flex-1">
        {/* KPI SUMMARY ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Công việc hôm nay ({formatDisplayDateVN(todayVN)})
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.todayTotal} <span className="text-xs font-semibold text-slate-400">buổi</span>
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                Đã xong {stats.doneToday} • Chờ xử lý {stats.pendingToday}
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Lịch định kỳ (2 ngày/lần, Tuần...)
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.recurringCount}{' '}
                <span className="text-xs font-semibold text-slate-400">chu kỳ</span>
              </div>
              <div className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                Tự động lặp & sinh lịch nhắc việc
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Lịch tự chọn theo ngày rời rạc
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {stats.multiDateCount}{' '}
                <span className="text-xs font-semibold text-slate-400">đầu việc</span>
              </div>
              <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                Chọn nhiều ngày linh hoạt trên lịch
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Tự động thông báo Telegram
              </div>
              <div className="text-sm font-extrabold text-sky-700 mt-1.5 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Đang kích hoạt (24/7)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdminModalTab('LOGS');
                  setIsAdminModalOpen(true);
                }}
                className="text-[11px] text-sky-600 hover:underline font-semibold mt-1 inline-block"
              >
                Xem nhật ký bắn tin nhắn →
              </button>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* STAFF FILTER BAR (FOR MANAGER) OR PRIVACY BANNER (FOR STAFF) */}
        {currentUser.role === 'MANAGER' ? (
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1">
                <Users className="w-4 h-4 text-indigo-600" />
                Lọc lịch theo nhân sự:
              </span>

              <button
                type="button"
                onClick={() => setSelectedAssigneeId('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedAssigneeId === 'ALL'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả nhân sự ({users.length})
              </button>

              {users.map((u) => {
                const isSelected = selectedAssigneeId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedAssigneeId(u.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isSelected ? '#fff' : u.color }}
                    />
                    <span>{u.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 font-medium">
              💡 Quyền Quản lý: Bạn đang xem được toàn bộ lịch của nhân viên
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50/90 border border-emerald-200 px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Chế độ Tài khoản Nhân sự riêng biệt: Bạn chỉ xem và quản lý lịch làm việc của cá nhân mình ({currentUser.name}). Nhân viên khác không thể xem lịch của bạn.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setAdminModalTab('STAFF');
                setIsAdminModalOpen(true);
              }}
              className="text-emerald-700 font-bold underline hover:text-emerald-900"
            >
              Cài đặt Telegram Chat ID của tôi →
            </button>
          </div>
        )}

        {/* VIEW CONTROLS & FILTERS TOOLBAR */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {/* Left: View Mode Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('MONTH')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'MONTH'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Lịch Tháng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('WEEK')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'WEEK'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Lịch Tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('AGENDA')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'AGENDA'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span>Danh sách & Định kỳ</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('KANBAN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'KANBAN'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Bảng Kanban</span>
            </button>
          </div>

          {/* Center: Month / Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'WEEK') {
                  setSelectedDate(addDaysToDateStr(selectedDate, -7));
                } else {
                  setCurrentMonth((prev) =>
                    prev.month === 0
                      ? { year: prev.year - 1, month: 11 }
                      : { year: prev.year, month: prev.month - 1 }
                  );
                }
              }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>

            <span className="text-sm font-extrabold text-slate-900 min-w-[140px] text-center">
              Tháng {currentMonth.month + 1} / {currentMonth.year}
            </span>

            <button
              type="button"
              onClick={() => {
                if (viewMode === 'WEEK') {
                  setSelectedDate(addDaysToDateStr(selectedDate, 7));
                } else {
                  setCurrentMonth((prev) =>
                    prev.month === 11
                      ? { year: prev.year + 1, month: 0 }
                      : { year: prev.year, month: prev.month + 1 }
                  );
                }
              }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedDate(todayVN);
                const [y, m] = todayVN.split('-').map(Number);
                if (y && m) setCurrentMonth({ year: y, month: m - 1 });
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100"
            >
              Hôm nay
            </button>
          </div>

          {/* Right: Type Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={scheduleTypeFilter}
                onChange={(e) => setScheduleTypeFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none"
              >
                <option value="ALL">Mọi loại lịch</option>
                <option value="RECURRING">🔄 Lịch định kỳ (2 ngày/lần...)</option>
                <option value="MULTI_DATE">📅 Lịch tự chọn nhiều ngày</option>
                <option value="SINGLE">📌 Lịch 1 ngày cố định</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên việc, nhân sự..."
                className="pl-8 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:border-indigo-500 w-44 sm:w-52"
              />
            </div>
          </div>
        </div>

        {/* MAIN CONTENT AREA: CALENDAR + SELECTED DAY SIDEBAR */}
        {viewMode === 'MONTH' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Left 8 cols: Month Calendar Grid */}
            <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 bg-slate-900 text-white text-center py-2.5 text-xs font-bold">
                {DOW_HEADERS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
                {monthCalendarCells.map((cell) => {
                  const dayOccs = occurrencesByDate[cell.dateStr] || [];
                  const isToday = cell.dateStr === todayVN;
                  const isSelected = cell.dateStr === selectedDate;

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={`min-h-[112px] sm:min-h-[126px] p-1.5 sm:p-2 transition cursor-pointer flex flex-col justify-between ${
                        !cell.isCurrentMonth
                          ? 'bg-slate-50/70 text-slate-400'
                          : 'bg-white'
                      } ${
                        isSelected
                          ? 'ring-2 ring-inset ring-indigo-600 bg-indigo-50/20'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                              isToday
                                ? 'bg-indigo-600 text-white shadow'
                                : isSelected
                                ? 'bg-indigo-100 text-indigo-800'
                                : ''
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {dayOccs.length > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {dayOccs.length} việc
                            </span>
                          )}
                        </div>

                        {/* Task pills inside cell */}
                        <div className="space-y-1">
                          {dayOccs.slice(0, 3).map((occ) => {
                            const isDone = occ.status === 'DONE';
                            const badgeColor = occ.assignee?.color || '#4F46E5';
                            return (
                              <div
                                key={`${occ.taskId}_${occ.date}`}
                                className={`px-1.5 py-1 rounded-md text-[10px] font-semibold truncate border-l-2 transition ${
                                  isDone
                                    ? 'bg-emerald-50 text-emerald-700 line-through opacity-75 border-emerald-500'
                                    : 'bg-slate-100/90 text-slate-800 hover:bg-indigo-50'
                                }`}
                                style={{
                                  borderLeftColor: isDone ? '#10B981' : badgeColor,
                                }}
                                title={`${occ.task.startTime} - ${occ.task.title} (${occ.assignee?.name || ''})`}
                              >
                                <span className="font-bold">{occ.task.startTime}</span>{' '}
                                {occ.task.scheduleType === 'RECURRING' && '🔄 '}
                                {occ.task.title}
                              </div>
                            );
                          })}
                          {dayOccs.length > 3 && (
                            <div className="text-[10px] font-bold text-indigo-600 pl-1">
                              + {dayOccs.length - 3} công việc khác...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 4 cols: Selected Date Detail Panel */}
            <div className="xl:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 sticky top-20">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    CHI TIẾT NGÀY ĐANG CHỌN
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                    Ngày {formatDisplayDateVN(selectedDate)}
                    {selectedDate === todayVN && (
                      <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700">
                        Hôm nay
                      </span>
                    )}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setIsTaskModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm việc</span>
                </button>
              </div>

              {selectedDayOccurrences.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto" />
                  <div className="text-xs font-semibold text-slate-500">
                    Không có lịch làm việc nào vào ngày {formatDisplayDateVN(selectedDate)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(null);
                      setIsTaskModalOpen(true);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:underline"
                  >
                    + Tạo lịch mới cho ngày này
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
                  {selectedDayOccurrences.map((occ) => (
                    <TaskOccurrenceCard
                      key={`${occ.taskId}_${occ.date}`}
                      occ={occ}
                      onUpdateStatus={handleUpdateOccurrenceStatus}
                      onToggleSubtask={handleToggleSubtask}
                      onEdit={(t) => {
                        setEditingTask(t);
                        setIsTaskModalOpen(true);
                      }}
                      onDelete={handleDeleteTask}
                      onSendTelegramNow={handleSendTaskTelegramNow}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW MODE 2: WEEK VIEW */}
        {viewMode === 'WEEK' && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDaysList.map((wd) => {
              const dayOccs = occurrencesByDate[wd.dateStr] || [];
              const isToday = wd.dateStr === todayVN;
              return (
                <div
                  key={wd.dateStr}
                  className={`bg-white rounded-2xl border shadow-sm flex flex-col min-h-[420px] ${
                    isToday ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
                  }`}
                >
                  <div
                    className={`p-3 border-b text-center rounded-t-2xl ${
                      isToday
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold">{wd.label}</div>
                    <div className="text-[11px] opacity-90 font-semibold mt-0.5">
                      {formatDisplayDateVN(wd.dateStr)}
                    </div>
                  </div>

                  <div className="p-2.5 space-y-2.5 flex-1">
                    {dayOccs.length === 0 ? (
                      <div className="text-[11px] text-slate-400 text-center py-8 italic">
                        Trống lịch
                      </div>
                    ) : (
                      dayOccs.map((occ) => (
                        <div
                          key={`${occ.taskId}_${occ.date}`}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-indigo-700">
                              {occ.task.startTime} - {occ.task.endTime}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateOccurrenceStatus(
                                  occ.taskId,
                                  occ.date,
                                  occ.status === 'DONE' ? 'TODO' : 'DONE'
                                )
                              }
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                occ.status === 'DONE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-700 hover:bg-emerald-100'
                              }`}
                            >
                              {occ.status === 'DONE' ? '✅ Xong' : '⬜ Chưa xong'}
                            </button>
                          </div>

                          <div
                            className={`font-bold text-slate-900 leading-snug ${
                              occ.status === 'DONE' ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {occ.task.title}
                          </div>

                          {occ.assignee && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: occ.assignee.color }}
                              />
                              <span className="truncate font-medium">
                                {occ.assignee.name}
                              </span>
                            </div>
                          )}

                          <div className="text-[10px] text-slate-500 font-medium">
                            🔄 {formatScheduleSummary(occ.task)}
                          </div>

                          {occ.task.telegramEnabled && occ.task.notifyTimes?.length > 0 && (
                            <div className="text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded font-semibold">
                              🔔 Báo TG: {occ.task.notifyTimes.join(', ')}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* VIEW MODE 3: AGENDA & RECURRING MASTER VIEW */}
        {viewMode === 'AGENDA' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-indigo-600" />
                <span>
                  Danh sách Đầu Việc & Quy Tắc Lịch Định Kỳ / Tự Chọn ({tasks.length} đầu việc)
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {tasks.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                CATEGORY_BADGES[task.category]?.cls || ''
                              }`}
                            >
                              {CATEGORY_BADGES[task.category]?.label || task.category}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                PRIORITY_BADGES[task.priority]?.cls || ''
                              }`}
                            >
                              Ưu tiên: {PRIORITY_BADGES[task.priority]?.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleSendTaskTelegramNow(task, todayVN)
                              }
                              className="px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 text-[11px] font-bold flex items-center gap-1"
                              title="Bắn thông báo công việc này vào Telegram ngay lập tức"
                            >
                              <Send className="w-3 h-3" />
                              <span>Bắn TG ngay</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTask(task);
                                setIsTaskModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(task)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900">
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: assignee?.color || '#4F46E5' }}
                          />
                          <span className="font-bold text-slate-800">
                            {assignee?.name || 'Nhân sự'}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-indigo-700">
                            {task.startTime} - {task.endTime}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                            🔄 {formatScheduleSummary(task)}
                          </span>
                          {task.telegramEnabled && (
                            <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold">
                              🔔 Giờ báo TG: {(task.notifyTimes || []).join(', ') || 'Trước giờ làm'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 4: KANBAN BOARD FOR SELECTED DATE */}
        {viewMode === 'KANBAN' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-800">
                Bảng tiến độ Kanban — Ngày {formatDisplayDateVN(selectedDate)}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  {
                    status: 'TODO' as const,
                    title: '📋 Cần làm (To Do)',
                    headerCls: 'bg-slate-800 text-white',
                  },
                  {
                    status: 'IN_PROGRESS' as const,
                    title: '⏳ Đang xử lý (In Progress)',
                    headerCls: 'bg-amber-600 text-white',
                  },
                  {
                    status: 'DONE' as const,
                    title: '✅ Đã hoàn thành (Done)',
                    headerCls: 'bg-emerald-600 text-white',
                  },
                ]
              ).map((col) => {
                const items = selectedDayOccurrences.filter(
                  (o) => o.status === col.status
                );
                return (
                  <div
                    key={col.status}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[380px]"
                  >
                    <div
                      className={`px-4 py-3 font-bold text-xs flex items-center justify-between ${col.headerCls}`}
                    >
                      <span>{col.title}</span>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[11px]">
                        {items.length}
                      </span>
                    </div>
                    <div className="p-3 space-y-3 flex-1 bg-slate-50/50">
                      {items.map((occ) => (
                        <TaskOccurrenceCard
                          key={`${occ.taskId}_${occ.date}`}
                          occ={occ}
                          onUpdateStatus={handleUpdateOccurrenceStatus}
                          onToggleSubtask={handleToggleSubtask}
                          onEdit={(t) => {
                            setEditingTask(t);
                            setIsTaskModalOpen(true);
                          }}
                          onDelete={handleDeleteTask}
                          onSendTelegramNow={handleSendTaskTelegramNow}
                        />
                      ))}
                      {items.length === 0 && (
                        <div className="text-center py-12 text-xs text-slate-400 italic">
                          Không có công việc ở trạng thái này
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {isTaskModalOpen && (
        <TaskFormModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          initialTask={editingTask}
          defaultDate={selectedDate}
          currentUser={currentUser}
          users={users}
        />
      )}

      {isAdminModalOpen && (
        <StaffAndTelegramModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          initialTab={adminModalTab}
          currentUser={currentUser}
          users={users}
          onRefreshData={async () => {
            await checkAuthentication();
            await fetchScheduleData();
          }}
        />
      )}
    </div>
  );
}

interface TaskOccurrenceCardProps {
  occ: TaskOccurrenceInstance;
  onUpdateStatus: (
    taskId: string,
    dateStr: string,
    newStatus: OccurrenceState
  ) => Promise<void>;
  onToggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  onEdit: (task: ScheduleTask) => void;
  onDelete: (task: ScheduleTask) => Promise<void>;
  onSendTelegramNow: (task: ScheduleTask, dateStr: string) => Promise<void>;
}

function TaskOccurrenceCard({
  occ,
  onUpdateStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onSendTelegramNow,
}: TaskOccurrenceCardProps) {
  const { task, assignee, status, date } = occ;
  const isDone = status === 'DONE';

  return (
    <div
      className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
        isDone
          ? 'bg-emerald-50/40 border-emerald-200'
          : 'bg-slate-50/80 border-slate-200 hover:border-indigo-300'
      }`}
    >
      {/* Top badges & actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3 text-indigo-400" />
            {task.startTime} - {task.endTime}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
              CATEGORY_BADGES[task.category]?.cls || ''
            }`}
          >
            {CATEGORY_BADGES[task.category]?.label || task.category}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] ${
              PRIORITY_BADGES[task.priority]?.cls || ''
            }`}
          >
            {PRIORITY_BADGES[task.priority]?.label}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSendTelegramNow(task, date)}
            className="p-1.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 transition"
            title="Bắn thông báo Telegram ngay lập tức"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500"
            title="Chỉnh sửa lịch"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task)}
            className="p-1.5 rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600"
            title="Xóa lịch"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Title & Description */}
      <div>
        <h4
          className={`font-bold text-sm leading-snug ${
            isDone ? 'line-through text-slate-400' : 'text-slate-900'
          }`}
        >
          {task.title}
        </h4>
        {task.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {task.description}
          </p>
        )}
      </div>

      {/* Recurrence & Telegram schedule info */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
          🔄 {formatScheduleSummary(task)}
        </span>
        {task.telegramEnabled && (
          <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-semibold border border-sky-100">
            🔔 Báo TG: {(task.notifyTimes || []).join(', ') || 'Trước giờ làm'}
          </span>
        )}
      </div>

      {/* Subtasks Checklist */}
      {Array.isArray(task.subtasks) && task.subtasks.length > 0 && (
        <div className="pt-1.5 border-t border-slate-200/70 space-y-1">
          {task.subtasks.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onToggleSubtask(task.id, sub.id)}
              className="w-full text-left flex items-center gap-2 text-xs py-0.5 text-slate-700 hover:text-indigo-600"
            >
              {sub.completed ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <span className={sub.completed ? 'line-through text-slate-400' : ''}>
                {sub.title}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Assignee & Status Switcher */}
      <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-bold text-[10px] shrink-0"
            style={{ backgroundColor: assignee?.color || '#4F46E5' }}
          >
            {(assignee?.name || 'NV').slice(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-slate-700 truncate">
            {assignee?.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateStatus(task.id, date, 'TODO')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              status === 'TODO'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-200/70 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cần làm
          </button>
          <button
            type="button"
            onClick={() => onUpdateStatus(task.id, date, 'IN_PROGRESS')}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
              status === 'IN_PROGRESS'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-200/70 text-slate-600 hover:bg-amber-100'
            }`}
          >
            Đang làm
          </button>
          <button
            type="button"
            onClick={() => onUpdateStatus(task.id, date, 'DONE')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
              status === 'DONE'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-200/70 text-slate-600 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>Hoàn thành</span>
          </button>
        </div>
      </div>
    </div>
  );
}
