'use client';

import React, { useState } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Repeat,
  CalendarDays,
  Bell,
  Plus,
  Trash2,
  CheckSquare,
  Clock,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  NotifyTarget,
  RecurrenceFrequency,
  ScheduleTask,
  ScheduleType,
  SubtaskItem,
  TaskCategory,
  TaskPriority,
  User,
} from '@/lib/types';
import { formatDisplayDateVN } from '@/lib/recurrence';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskPayload: Partial<ScheduleTask>) => Promise<void>;
  initialTask?: ScheduleTask | null;
  defaultDate: string; // YYYY-MM-DD
  currentUser: Omit<User, 'password'>;
  users: Omit<User, 'password'>[];
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
  { value: 0, label: 'Chủ nhật', short: 'CN' },
];

const QUICK_NOTIFY_TIMES = ['07:30', '08:00', '08:30', '09:00', '13:30', '14:00', '16:30', '20:00'];

export default function TaskFormModal({
  isOpen,
  onClose,
  onSave,
  initialTask,
  defaultDate,
  currentUser,
  users,
}: TaskFormModalProps) {
  const [title, setTitle] = useState(initialTask?.title || '');
  const [description, setDescription] = useState(initialTask?.description || '');
  const [category, setCategory] = useState<TaskCategory>(
    initialTask?.category || 'TAX_ACCOUNTING'
  );
  const [priority, setPriority] = useState<TaskPriority>(
    initialTask?.priority || 'MEDIUM'
  );
  const [assigneeId, setAssigneeId] = useState(
    initialTask?.assigneeId || currentUser.id
  );
  const [startTime, setStartTime] = useState(initialTask?.startTime || '09:00');
  const [endTime, setEndTime] = useState(initialTask?.endTime || '10:30');

  // Schedule Type: SINGLE, RECURRING, MULTI_DATE
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    initialTask?.scheduleType || 'RECURRING'
  );
  const [singleDate, setSingleDate] = useState(
    initialTask?.singleDate || defaultDate
  );

  // Multi-date picker state
  const [selectedDates, setSelectedDates] = useState<string[]>(
    initialTask?.selectedDates && initialTask.selectedDates.length > 0
      ? initialTask.selectedDates
      : [defaultDate]
  );
  const [pickerYearMonth, setPickerYearMonth] = useState(() => {
    const [y, m] = (defaultDate || '2026-11-01').split('-').map(Number);
    return { year: y || 2026, month: (m || 11) - 1 }; // 0-indexed month
  });

  // Recurrence state
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    initialTask?.recurrence?.frequency || 'DAILY'
  );
  const [interval, setInterval] = useState<number>(
    initialTask?.recurrence?.interval || 2
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    initialTask?.recurrence?.daysOfWeek || [1, 3, 5]
  );
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>(
    initialTask?.recurrence?.daysOfMonth || [15, 30]
  );
  const [recurrenceStart, setRecurrenceStart] = useState(
    initialTask?.recurrence?.startDate || defaultDate
  );
  const [recurrenceEnd, setRecurrenceEnd] = useState(
    initialTask?.recurrence?.endDate || ''
  );

  // Telegram Notification state
  const [telegramEnabled, setTelegramEnabled] = useState(
    initialTask ? initialTask.telegramEnabled : true
  );
  const [notifyTimes, setNotifyTimes] = useState<string[]>(
    initialTask?.notifyTimes && initialTask.notifyTimes.length > 0
      ? initialTask.notifyTimes
      : ['08:30']
  );
  const [customTimeInput, setCustomTimeInput] = useState('14:00');
  const [notifyBeforeMinutes, setNotifyBeforeMinutes] = useState<number[]>(
    initialTask?.notifyBeforeMinutes || [15]
  );
  const [notifyTarget, setNotifyTarget] = useState<NotifyTarget>(
    initialTask?.notifyTarget || 'PERSONAL'
  );
  const [remindIfOverdue, setRemindIfOverdue] = useState(
    initialTask?.remindIfOverdue ?? true
  );

  // Subtasks
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(
    initialTask?.subtasks || []
  );
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  function toggleDateInMultiSelect(dateStr: string) {
    setSelectedDates((prev) =>
      prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr].sort()
    );
  }

  function toggleDayOfWeek(dow: number) {
    setDaysOfWeek((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  }

  function toggleDayOfMonth(dom: number) {
    setDaysOfMonth((prev) =>
      prev.includes(dom)
        ? prev.filter((d) => d !== dom)
        : [...prev, dom].sort((a, b) => a - b)
    );
  }

  function addCustomNotifyTime(timeVal: string) {
    if (!timeVal) return;
    if (!notifyTimes.includes(timeVal)) {
      setNotifyTimes([...notifyTimes, timeVal].sort());
    }
  }

  function removeNotifyTime(timeVal: string) {
    setNotifyTimes(notifyTimes.filter((t) => t !== timeVal));
  }

  function toggleBeforeMinute(min: number) {
    setNotifyBeforeMinutes((prev) =>
      prev.includes(min) ? prev.filter((m) => m !== min) : [...prev, min].sort((a, b) => a - b)
    );
  }

  function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([
      ...subtasks,
      {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        title: newSubtaskTitle.trim(),
        completed: false,
      },
    ]);
    setNewSubtaskTitle('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(initialTask ? { id: initialTask.id } : {}),
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        assigneeId: currentUser.role === 'MANAGER' ? assigneeId : currentUser.id,
        scheduleType,
        startTime,
        endTime,
        singleDate,
        selectedDates,
        recurrence: {
          frequency,
          interval: Math.max(1, Number(interval) || 1),
          daysOfWeek,
          daysOfMonth,
          startDate: recurrenceStart,
          endDate: recurrenceEnd || undefined,
        },
        telegramEnabled,
        notifyTimes,
        notifyBeforeMinutes,
        notifyTarget,
        remindIfOverdue,
        subtasks,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Generate mini-calendar days for MULTI_DATE picker
  const firstDayOfMonth = new Date(pickerYearMonth.year, pickerYearMonth.month, 1);
  const daysInMonth = new Date(pickerYearMonth.year, pickerYearMonth.month + 1, 0).getDate();
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
  const miniCalDays: Array<string | null> = [];
  for (let i = 0; i < startOffset; i++) miniCalDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(pickerYearMonth.month + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    miniCalDays.push(`${pickerYearMonth.year}-${mStr}-${dStr}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">
              {initialTask ? 'Chỉnh sửa Lịch Làm Việc' : 'Tạo Lịch Làm Việc & Hẹn Giờ Telegram'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Hỗ trợ lịch định kỳ (VD: 2 ngày 1 lần), lịch tự chọn nhiều ngày và bắn Telegram theo giờ tự chọn
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Tên công việc / Lịch làm việc *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Kiểm tra hóa đơn điện tử / Báo cáo doanh thu / Họp khách hàng..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Nhân sự phụ trách
              </label>
              {currentUser.role === 'MANAGER' ? (
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.department})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-indigo-600" />
                  <span className="truncate">{currentUser.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Category, Priority, Time slot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Danh mục
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
              >
                <option value="TAX_ACCOUNTING">📊 Kế toán - Thuế</option>
                <option value="CLIENT">🤝 Khách hàng</option>
                <option value="MEETING">📅 Họp nội bộ</option>
                <option value="REPORT">📑 Báo cáo</option>
                <option value="MARKETING">📣 Marketing</option>
                <option value="OPERATION">⚙️ Vận hành</option>
                <option value="OTHER">📌 Công việc khác</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Mức độ ưu tiên
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
              >
                <option value="LOW">🟢 Thấp</option>
                <option value="MEDIUM">🔵 Trung bình</option>
                <option value="HIGH">🟠 Cao</option>
                <option value="URGENT">🔴 Khẩn cấp</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Giờ bắt đầu
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Giờ kết thúc
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>

          {/* SECTION 1: CHỌN CHẾ ĐỘ LÊN LỊCH (ĐỊNH KỲ / TỰ CHỌN NHIỀU NGÀY / 1 NGÀY) */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-indigo-600" />
                1. Chế độ Lên Lịch Làm Việc
              </span>

              <div className="grid grid-cols-3 gap-1.5 bg-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScheduleType('RECURRING')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    scheduleType === 'RECURRING'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Định kỳ (2 ngày/lần...)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('MULTI_DATE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    scheduleType === 'MULTI_DATE'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Tự chọn theo ngày</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('SINGLE')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    scheduleType === 'SINGLE'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  <span>1 Ngày cố định</span>
                </button>
              </div>
            </div>

            {/* A. CHẾ ĐỘ ĐỊNH KỲ (RECURRING) */}
            {scheduleType === 'RECURRING' && (
              <div className="space-y-4 pt-2 border-t border-slate-200">
                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-500 mr-1">Chọn nhanh:</span>
                  {[
                    { label: 'Mỗi ngày', freq: 'DAILY' as const, intv: 1 },
                    { label: '2 ngày 1 lần', freq: 'DAILY' as const, intv: 2 },
                    { label: '3 ngày 1 lần', freq: 'DAILY' as const, intv: 3 },
                    { label: '5 ngày 1 lần', freq: 'DAILY' as const, intv: 5 },
                    { label: 'Hàng tuần (T2-T4-T6)', freq: 'WEEKLY' as const, intv: 1, dow: [1, 3, 5] },
                    { label: '2 tuần 1 lần', freq: 'WEEKLY' as const, intv: 2 },
                    { label: 'Hàng tháng (15 & 30)', freq: 'MONTHLY' as const, intv: 1, dom: [15, 30] },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFrequency(preset.freq);
                        setInterval(preset.intv);
                        if (preset.dow) setDaysOfWeek(preset.dow);
                        if (preset.dom) setDaysOfMonth(preset.dom);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Interval Builder */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Khoảng cách lặp (Mỗi N...)
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Mỗi</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={interval}
                        onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-20 px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-center"
                      />
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                      >
                        <option value="DAILY">Ngày / lần</option>
                        <option value="WEEKLY">Tuần / lần</option>
                        <option value="MONTHLY">Tháng / lần</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Bắt đầu tính chu kỳ từ ngày
                    </label>
                    <input
                      type="date"
                      value={recurrenceStart}
                      onChange={(e) => setRecurrenceStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Ngày kết thúc (Để trống = Lặp mãi)
                    </label>
                    <input
                      type="date"
                      value={recurrenceEnd}
                      onChange={(e) => setRecurrenceEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                    />
                  </div>
                </div>

                {/* If WEEKLY -> Pick weekdays */}
                {frequency === 'WEEKLY' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Chọn các thứ trong tuần diễn ra công việc:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((w) => {
                        const active = daysOfWeek.includes(w.value);
                        return (
                          <button
                            key={w.value}
                            type="button"
                            onClick={() => toggleDayOfWeek(w.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'
                            }`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* If MONTHLY -> Pick days of month */}
                {frequency === 'MONTHLY' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Chọn các ngày cố định trong tháng (1 - 31):
                    </label>
                    <div className="grid grid-cols-8 sm:grid-cols-11 gap-1.5">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                        const active = daysOfMonth.includes(dayNum);
                        return (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => toggleDayOfMonth(dayNum)}
                            className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                              active
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
                            }`}
                          >
                            {dayNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* B. CHẾ ĐỘ TỰ CHỌN NHIỀU NGÀY BẤT KỲ (MULTI_DATE) */}
            {scheduleType === 'MULTI_DATE' && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-4">
                {/* Mini Calendar Picker */}
                <div className="sm:col-span-7 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-slate-700">
                      Click chọn các ngày làm việc trên lịch:
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPickerYearMonth((prev) =>
                            prev.month === 0
                              ? { year: prev.year - 1, month: 11 }
                              : { year: prev.year, month: prev.month - 1 }
                          )
                        }
                        className="p-1 rounded hover:bg-slate-100"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-indigo-700 px-2">
                        Tháng {pickerYearMonth.month + 1}/{pickerYearMonth.year}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPickerYearMonth((prev) =>
                            prev.month === 11
                              ? { year: prev.year + 1, month: 0 }
                              : { year: prev.year, month: prev.month + 1 }
                          )
                        }
                        className="p-1 rounded hover:bg-slate-100"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
                    <div>T2</div>
                    <div>T3</div>
                    <div>T4</div>
                    <div>T5</div>
                    <div>T6</div>
                    <div>T7</div>
                    <div>CN</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {miniCalDays.map((dStr, i) => {
                      if (!dStr) return <div key={`empty_${i}`} className="h-8" />;
                      const isPicked = selectedDates.includes(dStr);
                      const dayNum = parseInt(dStr.split('-')[2], 10);
                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => toggleDateInMultiSelect(dStr)}
                          className={`h-8 rounded-lg text-xs font-bold transition ${
                            isPicked
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected dates list */}
                <div className="sm:col-span-5 flex flex-col justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">
                        Đã chọn ({selectedDates.length} ngày):
                      </span>
                      {selectedDates.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedDates([])}
                          className="text-[11px] text-rose-600 hover:underline font-medium"
                        >
                          Xóa hết
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {selectedDates.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold"
                        >
                          {formatDisplayDateVN(d)}
                          <button
                            type="button"
                            onClick={() => toggleDateInMultiSelect(d)}
                            className="text-indigo-400 hover:text-indigo-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {selectedDates.length === 0 && (
                        <span className="text-xs text-slate-400 italic">
                          Hãy click vào các ngày bất kỳ bên trái để chọn lịch làm việc.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* C. CHẾ ĐỘ 1 NGÀY CỐ ĐỊNH (SINGLE) */}
            {scheduleType === 'SINGLE' && (
              <div className="pt-2 border-t border-slate-200 flex items-center gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Chọn ngày diễn ra công việc:
                  </label>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: CẤU HÌNH TỰ ĐỘNG THÔNG BÁO TELEGRAM THEO GIỜ TỰ CHỌN */}
          <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  2. Hẹn Giờ Tự Động Bắn Thông Báo Vào Telegram
                </span>
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-bold text-sky-800">
                  Bật báo Telegram
                </span>
              </label>
            </div>

            {telegramEnabled && (
              <div className="space-y-4 pt-2 border-t border-sky-200/80">
                {/* Custom Exact Times Picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Các khung giờ tự chọn sẽ tự động bắn tin nhắn Telegram trong ngày làm việc:
                  </label>

                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    {notifyTimes.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold shadow-sm"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Đúng {t}</span>
                        <button
                          type="button"
                          onClick={() => removeNotifyTime(t)}
                          className="hover:text-sky-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}

                    <div className="inline-flex items-center gap-1.5 bg-white border border-sky-300 rounded-xl px-2 py-1">
                      <input
                        type="time"
                        value={customTimeInput}
                        onChange={(e) => setCustomTimeInput(e.target.value)}
                        className="text-xs font-bold text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => addCustomNotifyTime(customTimeInput)}
                        className="px-2.5 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-xs font-bold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Thêm giờ
                      </button>
                    </div>
                  </div>

                  {/* Quick time chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Thêm nhanh giờ báo:</span>
                    {QUICK_NOTIFY_TIMES.map((qt) => (
                      <button
                        key={qt}
                        type="button"
                        onClick={() => addCustomNotifyTime(qt)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                          notifyTimes.includes(qt)
                            ? 'bg-sky-100 text-sky-800 border-sky-400'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-sky-400'
                        }`}
                      >
                        + {qt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Before Start & Target Channel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-sky-200/60">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nhắc thêm trước giờ bắt đầu ({startTime}):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { min: 15, label: 'Trước 15 phút' },
                        { min: 30, label: 'Trước 30 phút' },
                        { min: 60, label: 'Trước 1 tiếng' },
                      ].map((item) => {
                        const active = notifyBeforeMinutes.includes(item.min);
                        return (
                          <button
                            key={item.min}
                            type="button"
                            onClick={() => toggleBeforeMinute(item.min)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                              active
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Kênh nhận thông báo Telegram:
                    </label>
                    <select
                      value={notifyTarget}
                      onChange={(e) => setNotifyTarget(e.target.value as NotifyTarget)}
                      className="w-full px-3 py-1.5 border border-sky-300 rounded-xl text-xs font-semibold bg-white"
                    >
                      <option value="PERSONAL">👤 Nhắn riêng vào Telegram của Nhân sự phụ trách</option>
                      <option value="GROUP">👥 Nhắn vào Group Telegram chung & Tag tên nhân sự</option>
                      <option value="BOTH">🔔 Cả hai (Nhắn riêng Nhân sự + Group chung)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description & Subtasks Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Ghi chú / Hướng dẫn thực hiện
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú chi tiết, link tài liệu, quy trình cần lưu ý (sẽ gửi kèm trong tin nhắn Telegram)..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                Checklist bước thực hiện ({subtasks.length})
              </label>
              <div className="flex gap-1.5 mb-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Thêm đầu việc con..."
                  className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700"
                >
                  + Thêm
                </button>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <span className="truncate text-slate-700">{sub.title}</span>
                    <button
                      type="button"
                      onClick={() => setSubtasks(subtasks.filter((s) => s.id !== sub.id))}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : initialTask ? 'Lưu cập nhật lịch' : 'Tạo Lịch Làm Việc'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
