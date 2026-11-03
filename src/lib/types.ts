export type UserRole = 'MANAGER' | 'STAFF';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  department: string;
  color: string;
  telegramChatId: string;
  telegramUsername?: string;
  active: boolean;
  createdAt: string;
}

export type TaskCategory =
  | 'TAX_ACCOUNTING'
  | 'CLIENT'
  | 'MEETING'
  | 'REPORT'
  | 'OPERATION'
  | 'MARKETING'
  | 'OTHER';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ScheduleType = 'SINGLE' | 'RECURRING' | 'MULTI_DATE';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number; // VD: 2 + DAILY = 2 ngày 1 lần
  daysOfWeek?: number[]; // 0 (CN) -> 6 (Thứ 7)
  daysOfMonth?: number[]; // 1 -> 31
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional)
}

export type OccurrenceState = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED';

export interface OccurrenceStatusRecord {
  status: OccurrenceState;
  updatedAt: string;
  completedAt?: string;
  note?: string;
  snoozedUntil?: string; // ISO string or HH:mm
}

export interface SubtaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export type NotifyTarget = 'PERSONAL' | 'GROUP' | 'BOTH';

export interface ScheduleTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  assigneeId: string;
  createdById: string;
  scheduleType: ScheduleType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  singleDate?: string; // YYYY-MM-DD
  selectedDates?: string[]; // Array of YYYY-MM-DD
  recurrence?: RecurrenceRule;
  telegramEnabled: boolean;
  notifyTimes: string[]; // Các giờ tự chọn trong ngày để bắn thông báo Telegram (VD: ["08:00", "14:00"])
  notifyBeforeMinutes: number[]; // Báo trước giờ bắt đầu X phút (VD: [15, 30])
  notifyTarget: NotifyTarget;
  remindIfOverdue: boolean;
  subtasks: SubtaskItem[];
  occurrenceStatuses: Record<string, OccurrenceStatusRecord>; // key = YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

export interface TaskOccurrenceInstance {
  taskId: string;
  date: string; // YYYY-MM-DD
  task: ScheduleTask;
  assignee?: Omit<User, 'password'>;
  status: OccurrenceState;
  statusRecord?: OccurrenceStatusRecord;
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  groupChatId: string;
  managerChatId: string;
  dailyDigestEnabled: boolean;
  dailyDigestTime: string; // HH:mm
  lastDailyDigestDate?: string; // YYYY-MM-DD
  webhookUrl?: string;
  autoWorkerEnabled: boolean;
}

export interface NotificationLog {
  id: string;
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeName: string;
  occurrenceDate: string; // YYYY-MM-DD
  notifyTimeSlot: string; // VD: "CUSTOM_08:30", "BEFORE_15M", "MANUAL", "SNOOZE"
  targetChatId: string;
  status: 'SENT' | 'FAILED';
  messagePreview: string;
  error?: string;
  telegramMessageId?: number;
  sentAt: string;
}

export interface DatabaseSchema {
  users: User[];
  tasks: ScheduleTask[];
  telegramConfig: TelegramConfig;
  notificationLogs: NotificationLog[];
  sentDeduplicationKeys: Record<string, string>; // key -> ISO timestamp to prevent duplicate sends in same slot
}
