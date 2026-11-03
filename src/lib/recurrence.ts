import { ScheduleTask, TaskOccurrenceInstance, User } from './types';

/**
 * Lấy ngày và giờ hiện tại chuẩn theo múi giờ Việt Nam (Asia/Ho_Chi_Minh - UTC+7)
 * Đảm bảo khi chạy trên Vercel (máy chủ UTC) vẫn khớp đúng từng phút giờ Việt Nam.
 */
export function getVietnamDateTime(dateObj: Date = new Date()): {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  minutesOfDay: number;
  dayOfWeek: number;
  iso: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(dateObj);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const hour = map.hour === '24' ? '00' : map.hour;
  const minute = map.minute;

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;
  const minutesOfDay = parseInt(hour, 10) * 60 + parseInt(minute, 10);

  const utcMidnight = parseDateUTC(dateStr);
  const dayOfWeek = utcMidnight.getUTCDay();

  return {
    dateStr,
    timeStr,
    minutesOfDay,
    dayOfWeek,
    iso: dateObj.toISOString(),
  };
}

export function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0, 0));
}

export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateStr(dateStr: string, days: number): string {
  const dt = parseDateUTC(dateStr);
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDateUTC(dt);
}

export function diffDaysUTC(startDateStr: string, endDateStr: string): number {
  const d1 = parseDateUTC(startDateStr).getTime();
  const d2 = parseDateUTC(endDateStr).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getMondayOfUTCWeek(dateStr: string): Date {
  const dt = parseDateUTC(dateStr);
  const day = dt.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt;
}

export function timeStrToMinutes(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTimeStr(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Kiểm tra một công việc (SINGLE, MULTI_DATE, hoặc RECURRING) có diễn ra vào ngày dateStr (YYYY-MM-DD) hay không
 */
export function doesTaskOccurOnDate(task: ScheduleTask, dateStr: string): boolean {
  if (!dateStr) return false;

  if (task.scheduleType === 'SINGLE') {
    return task.singleDate === dateStr;
  }

  if (task.scheduleType === 'MULTI_DATE') {
    return Array.isArray(task.selectedDates) && task.selectedDates.includes(dateStr);
  }

  if (task.scheduleType === 'RECURRING' && task.recurrence) {
    const rule = task.recurrence;
    if (!rule.startDate) return false;
    if (dateStr < rule.startDate) return false;
    if (rule.endDate && rule.endDate.trim() !== '' && dateStr > rule.endDate) return false;

    const interval = Math.max(1, Number(rule.interval) || 1);

    if (rule.frequency === 'DAILY') {
      const diff = diffDaysUTC(rule.startDate, dateStr);
      return diff >= 0 && diff % interval === 0;
    }

    if (rule.frequency === 'WEEKLY') {
      const targetDate = parseDateUTC(dateStr);
      const targetDow = targetDate.getUTCDay();
      const startDow = parseDateUTC(rule.startDate).getUTCDay();

      const allowedDays =
        Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0
          ? rule.daysOfWeek
          : [startDow];

      if (!allowedDays.includes(targetDow)) {
        return false;
      }

      const startMonday = getMondayOfUTCWeek(rule.startDate).getTime();
      const targetMonday = getMondayOfUTCWeek(dateStr).getTime();
      const weeksDiff = Math.round((targetMonday - startMonday) / (1000 * 60 * 60 * 24 * 7));

      return weeksDiff >= 0 && weeksDiff % interval === 0;
    }

    if (rule.frequency === 'MONTHLY') {
      const targetDate = parseDateUTC(dateStr);
      const startDate = parseDateUTC(rule.startDate);

      const targetDayOfMonth = targetDate.getUTCDate();
      const startDayOfMonth = startDate.getUTCDate();

      const allowedMonthDays =
        Array.isArray(rule.daysOfMonth) && rule.daysOfMonth.length > 0
          ? rule.daysOfMonth
          : [startDayOfMonth];

      if (!allowedMonthDays.includes(targetDayOfMonth)) {
        return false;
      }

      const monthsDiff =
        (targetDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
        (targetDate.getUTCMonth() - startDate.getUTCMonth());

      return monthsDiff >= 0 && monthsDiff % interval === 0;
    }
  }

  return false;
}

/**
 * Sinh danh sách các buổi làm việc (TaskOccurrenceInstance) trong khoảng [startDateStr, endDateStr]
 */
export function getOccurrencesInRange(
  tasks: ScheduleTask[],
  startDateStr: string,
  endDateStr: string,
  usersMap: Record<string, Omit<User, 'password'>>
): TaskOccurrenceInstance[] {
  const results: TaskOccurrenceInstance[] = [];
  const totalDays = diffDaysUTC(startDateStr, endDateStr);
  if (totalDays < 0 || totalDays > 400) return results;

  for (let i = 0; i <= totalDays; i++) {
    const currentDateStr = addDaysToDateStr(startDateStr, i);
    for (const task of tasks) {
      if (doesTaskOccurOnDate(task, currentDateStr)) {
        const statusRecord = task.occurrenceStatuses?.[currentDateStr];
        results.push({
          taskId: task.id,
          date: currentDateStr,
          task,
          assignee: usersMap[task.assigneeId],
          status: statusRecord?.status || 'TODO',
          statusRecord,
        });
      }
    }
  }

  results.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.task.startTime || '00:00').localeCompare(b.task.startTime || '00:00');
  });

  return results;
}

const DOW_LABELS: Record<number, string> = {
  1: 'T2',
  2: 'T3',
  3: 'T4',
  4: 'T5',
  5: 'T6',
  6: 'T7',
  0: 'CN',
};

export function formatDisplayDateVN(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatScheduleSummary(task: ScheduleTask): string {
  if (task.scheduleType === 'SINGLE') {
    return `Ngày ${formatDisplayDateVN(task.singleDate)}`;
  }

  if (task.scheduleType === 'MULTI_DATE') {
    const dates = task.selectedDates || [];
    if (dates.length === 0) return 'Chưa chọn ngày';
    if (dates.length <= 2) {
      return `Ngày tự chọn: ${dates.map(formatDisplayDateVN).join(', ')}`;
    }
    return `${dates.length} ngày tự chọn (${dates.slice(0, 2).map(formatDisplayDateVN).join(', ')}...)`;
  }

  if (task.scheduleType === 'RECURRING' && task.recurrence) {
    const r = task.recurrence;
    const interval = Math.max(1, Number(r.interval) || 1);

    if (r.frequency === 'DAILY') {
      return interval === 1 ? 'Định kỳ hàng ngày' : `Định kỳ ${interval} ngày / lần`;
    }

    if (r.frequency === 'WEEKLY') {
      const days =
        r.daysOfWeek && r.daysOfWeek.length > 0
          ? r.daysOfWeek.map((d) => DOW_LABELS[d] || '').join(', ')
          : '';
      const prefix = interval === 1 ? 'Hàng tuần' : `${interval} tuần / lần`;
      return days ? `${prefix} (${days})` : prefix;
    }

    if (r.frequency === 'MONTHLY') {
      const days =
        r.daysOfMonth && r.daysOfMonth.length > 0
          ? `Ngày ${r.daysOfMonth.join(', ')}`
          : '';
      const prefix = interval === 1 ? 'Hàng tháng' : `${interval} tháng / lần`;
      return days ? `${prefix} (${days})` : prefix;
    }
  }

  return 'Lịch làm việc';
}
