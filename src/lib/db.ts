import fs from 'fs';
import path from 'path';
import { DatabaseSchema, ScheduleTask, User } from './types';
import { addDaysToDateStr, getVietnamDateTime } from './recurrence';

const LOCAL_DATA_DIR = path.join(process.cwd(), 'data');
const LOCAL_DB_FILE = path.join(LOCAL_DATA_DIR, 'database.json');
const TMP_DB_FILE = '/tmp/work-schedule-database.json';

declare global {
  // eslint-disable-next-line no-var
  var __workScheduleMemoryDb: DatabaseSchema | undefined;
}

function createInitialSeedData(): DatabaseSchema {
  const { dateStr: today } = getVietnamDateTime();
  const tomorrow = addDaysToDateStr(today, 1);
  const in2Days = addDaysToDateStr(today, 2);
  const in3Days = addDaysToDateStr(today, 3);
  const in5Days = addDaysToDateStr(today, 5);
  const in7Days = addDaysToDateStr(today, 7);
  const yesterday = addDaysToDateStr(today, -1);

  const users: User[] = [
    {
      id: 'usr_manager_1',
      username: 'admin',
      password: '123456',
      name: 'Vũ Hoàng',
      role: 'MANAGER',
      department: '',
      color: '#4F46E5',
      telegramChatId: process.env.TELEGRAM_MANAGER_CHAT_ID || '',
      telegramUsername: '',
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const tasks: ScheduleTask[] = [
    {
      id: 'tsk_rec_2days',
      title: 'Tập luyện thể thao & Kiểm tra mục tiêu định kỳ',
      description:
        'Thực hiện lịch định kỳ 2 ngày 1 lần và tự động nhắc nhở qua Telegram.',
      category: 'MARKETING',
      priority: 'HIGH',
      assigneeId: 'usr_manager_1',
      createdById: 'usr_manager_1',
      scheduleType: 'RECURRING',
      startTime: '08:30',
      endTime: '09:30',
      recurrence: {
        frequency: 'DAILY',
        interval: 2,
        startDate: today,
      },
      telegramEnabled: true,
      notifyTimes: ['08:00', '08:30'],
      notifyBeforeMinutes: [15],
      notifyTarget: 'PERSONAL',
      remindIfOverdue: true,
      subtasks: [
        { id: 'sub_1', title: 'Chuẩn bị trước 15 phút', completed: true },
        { id: 'sub_2', title: 'Hoàn thành mục tiêu trong ngày', completed: false },
      ],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_multidate_personal',
      title: 'Tổng kết kế hoạch cá nhân & Thanh toán hóa đơn',
      description: 'Lịch tự chọn theo các ngày cụ thể trong tháng.',
      category: 'OPERATION',
      priority: 'MEDIUM',
      assigneeId: 'usr_manager_1',
      createdById: 'usr_manager_1',
      scheduleType: 'MULTI_DATE',
      startTime: '14:00',
      endTime: '15:30',
      selectedDates: [today, in2Days, in5Days, in7Days],
      telegramEnabled: true,
      notifyTimes: ['13:30'],
      notifyBeforeMinutes: [30],
      notifyTarget: 'PERSONAL',
      remindIfOverdue: false,
      subtasks: [],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return {
    users,
    tasks,
    telegramConfig: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
      groupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || '',
      managerChatId: process.env.TELEGRAM_MANAGER_CHAT_ID || '',
      dailyDigestEnabled: true,
      dailyDigestTime: '07:30',
      autoWorkerEnabled: true,
    },
    notificationLogs: [],
    sentDeduplicationKeys: {},
  };
}

function getKvCredentials(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url, token };
  }
  return null;
}

function getGistCredentials(): { gistId: string; token: string } | null {
  const gistId = (process.env.GITHUB_GIST_ID || '').trim();
  const token = (process.env.GITHUB_STORAGE_TOKEN || '').trim();
  if (gistId && token) {
    return { gistId, token };
  }
  return null;
}

const KV_KEY = 'work_schedule_app_db_v1';

export async function readDb(): Promise<DatabaseSchema> {
  // 1. Hỗ trợ Cloud KV / Upstash Redis trên Vercel nếu đã kết nối
  const kv = getKvCredentials();
  if (kv) {
    try {
      const res = await fetch(`${kv.url}/get/${KV_KEY}`, {
        headers: { Authorization: `Bearer ${kv.token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          global.__workScheduleMemoryDb = parsed;
          return parsed;
        }
      }
    } catch (err) {
      console.error('KV read error:', err);
    }
  }

  // 2. Hỗ trợ Cloud Storage qua Private GitHub Gist (Hoạt động vĩnh viễn trên Vercel Serverless)
  const gist = getGistCredentials();
  if (gist) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gist.gistId}`, {
        headers: {
          Authorization: `Bearer ${gist.token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'WorkSchedule-App',
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const fileObj = data?.files?.['database.json'];
        if (fileObj) {
          let rawContent = fileObj.content;
          if (fileObj.truncated && fileObj.raw_url) {
            const rawRes = await fetch(fileObj.raw_url, { cache: 'no-store' });
            rawContent = await rawRes.text();
          }
          if (rawContent) {
            const parsed = JSON.parse(rawContent) as DatabaseSchema;
            global.__workScheduleMemoryDb = parsed;
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('Gist cloud storage read error:', err);
    }
  }

  // 3. Ưu tiên đọc từ /tmp hoặc bộ nhớ RAM trước (để trên Vercel không bị đè bởi file tĩnh read-only)
  try {
    if (fs.existsSync(TMP_DB_FILE)) {
      const raw = fs.readFileSync(TMP_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      global.__workScheduleMemoryDb = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }

  if (global.__workScheduleMemoryDb) {
    return global.__workScheduleMemoryDb;
  }

  // 4. Đọc từ file local (data/database.json) khi chạy máy cá nhân
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      global.__workScheduleMemoryDb = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }

  // 5. Khởi tạo dữ liệu mẫu lần đầu
  const initial = createInitialSeedData();
  await writeDb(initial);
  return initial;
}

export async function writeDb(db: DatabaseSchema): Promise<void> {
  global.__workScheduleMemoryDb = db;
  const serialized = JSON.stringify(db, null, 2);

  // 1. Lưu lên Cloud KV / Upstash Redis nếu có
  const kv = getKvCredentials();
  if (kv) {
    try {
      await fetch(`${kv.url}/set/${KV_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${kv.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(db),
      });
    } catch (err) {
      console.error('KV write error:', err);
    }
  }

  // 2. Lưu lên Cloud Storage qua Private GitHub Gist (Đảm bảo lưu vĩnh viễn trên Vercel)
  const gist = getGistCredentials();
  if (gist) {
    try {
      await fetch(`https://api.github.com/gists/${gist.gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${gist.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'WorkSchedule-App',
        },
        body: JSON.stringify({
          files: {
            'database.json': {
              content: serialized,
            },
          },
        }),
      });
    } catch (err) {
      console.error('Gist cloud storage write error:', err);
    }
  }

  // 3. Luôn ghi bản sao vào /tmp để tốc độ truy xuất tức thì
  try {
    fs.writeFileSync(TMP_DB_FILE, serialized, 'utf-8');
  } catch {
    // ignore
  }

  // 4. Lưu vào file local data/database.json (khi chạy ở máy local)
  if (!process.env.VERCEL) {
    try {
      if (!fs.existsSync(LOCAL_DATA_DIR)) {
        fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LOCAL_DB_FILE, serialized, 'utf-8');
    } catch {
      // ignore
    }
  }
}

export function sanitizeUser(user: User): Omit<User, 'password'> {
  const { password: _p, ...rest } = user;
  return rest;
}
