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
      name: 'Vũ Hoàng (Quản lý)',
      role: 'MANAGER',
      department: 'Ban Giám Đốc',
      color: '#4F46E5',
      telegramChatId: process.env.TELEGRAM_MANAGER_CHAT_ID || '',
      telegramUsername: 'vuhoang_admin',
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_staff_trang',
      username: 'trang',
      password: '123456',
      name: 'Trang (Kế toán trưởng)',
      role: 'STAFF',
      department: 'Phòng Kế toán & Thuế',
      color: '#059669',
      telegramChatId: '',
      telegramUsername: 'trang_ketoan',
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_staff_minh',
      username: 'minh',
      password: '123456',
      name: 'Minh Anh (Chuyên viên Thuế)',
      role: 'STAFF',
      department: 'Phòng Kế toán SME & HKD',
      color: '#D97706',
      telegramChatId: '',
      telegramUsername: 'minhanh_tax',
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_staff_khanh',
      username: 'khanh',
      password: '123456',
      name: 'Quốc Khánh (Marketing & CSKH)',
      role: 'STAFF',
      department: 'Phòng Marketing & Kinh doanh',
      color: '#E11D48',
      telegramChatId: '',
      telegramUsername: 'quockhanh_mkt',
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  const tasks: ScheduleTask[] = [
    {
      id: 'tsk_rec_2days',
      title: 'Kiểm tra & đối chiếu hóa đơn điện tử đầu vào/ra trên TCT',
      description:
        'Đăng nhập hệ thống Hóa đơn điện tử Tổng cục Thuế, rà soát hóa đơn mới phát sinh của nhóm khách hàng SME và cảnh báo sai sót kịp thời.',
      category: 'TAX_ACCOUNTING',
      priority: 'HIGH',
      assigneeId: 'usr_staff_minh',
      createdById: 'usr_manager_1',
      scheduleType: 'RECURRING',
      startTime: '09:00',
      endTime: '10:30',
      recurrence: {
        frequency: 'DAILY',
        interval: 2, // 2 ngày 1 lần
        startDate: yesterday,
      },
      telegramEnabled: true,
      notifyTimes: ['08:30', '09:00'],
      notifyBeforeMinutes: [15],
      notifyTarget: 'PERSONAL',
      remindIfOverdue: true,
      subtasks: [
        { id: 'sub_1', title: 'Tải bảng kê XML/Excel hóa đơn mua vào - bán ra', completed: true },
        { id: 'sub_2', title: 'Kiểm tra trạng thái MST nhà cung cấp', completed: false },
        { id: 'sub_3', title: 'Cập nhật file theo dõi & báo cáo khách hàng', completed: false },
      ],
      occurrenceStatuses: {
        [yesterday]: {
          status: 'DONE',
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_rec_weekly_trang',
      title: 'Rà soát hồ sơ kê khai thuế & duyệt tờ khai định kỳ',
      description:
        'Kiểm tra chéo số liệu sổ sách kế toán, duyệt hồ sơ hoàn thuế / giải trình cơ quan thuế cho các doanh nghiệp trọng điểm.',
      category: 'TAX_ACCOUNTING',
      priority: 'URGENT',
      assigneeId: 'usr_staff_trang',
      createdById: 'usr_manager_1',
      scheduleType: 'RECURRING',
      startTime: '14:00',
      endTime: '16:00',
      recurrence: {
        frequency: 'WEEKLY',
        interval: 1,
        daysOfWeek: [1, 3, 5], // Thứ 2, Thứ 4, Thứ 6
        startDate: yesterday,
      },
      telegramEnabled: true,
      notifyTimes: ['08:00', '13:45'],
      notifyBeforeMinutes: [15],
      notifyTarget: 'BOTH',
      remindIfOverdue: true,
      subtasks: [
        { id: 'sub_t1', title: 'Duyệt bảng cân đối phát sinh các công ty SME', completed: false },
        { id: 'sub_t2', title: 'Kiểm tra công văn giải trình thuế tồn đọng', completed: false },
      ],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_multidate_khanh',
      title: 'Lên lịch bài viết & Báo cáo chuyển đổi chiến dịch Marketing',
      description:
        'Tổng hợp chỉ số Leads từ kênh Facebook/TikTok/Website, cập nhật danh sách khách hàng tiềm năng cần tư vấn kế toán.',
      category: 'MARKETING',
      priority: 'MEDIUM',
      assigneeId: 'usr_staff_khanh',
      createdById: 'usr_manager_1',
      scheduleType: 'MULTI_DATE',
      startTime: '10:30',
      endTime: '11:45',
      selectedDates: [today, in2Days, in5Days, in7Days],
      telegramEnabled: true,
      notifyTimes: ['10:00', '16:00'],
      notifyBeforeMinutes: [30],
      notifyTarget: 'PERSONAL',
      remindIfOverdue: false,
      subtasks: [
        { id: 'sub_k1', title: 'Xuất báo cáo chi phí & CPL từng chiến dịch', completed: true },
        { id: 'sub_k2', title: 'Bàn giao danh sách SĐT khách mới cho bộ phận tư vấn', completed: false },
      ],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_single_manager',
      title: 'Họp điều phối công việc & Đánh giá KPI toàn công ty',
      description:
        'Rà soát tiến độ công việc các phòng ban, tháo gỡ vướng mắc hồ sơ khách hàng và chốt mục tiêu tuần mới.',
      category: 'MEETING',
      priority: 'HIGH',
      assigneeId: 'usr_manager_1',
      createdById: 'usr_manager_1',
      scheduleType: 'SINGLE',
      startTime: '15:30',
      endTime: '17:00',
      singleDate: today,
      telegramEnabled: true,
      notifyTimes: ['08:00', '15:15'],
      notifyBeforeMinutes: [15],
      notifyTarget: 'GROUP',
      remindIfOverdue: true,
      subtasks: [
        { id: 'sub_m1', title: 'Tổng hợp báo cáo tiến độ từ hệ thống lịch', completed: true },
        { id: 'sub_m2', title: 'Phân bổ đầu việc ưu tiên tuần tới', completed: false },
      ],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_rec_3days_minh',
      title: 'Chăm sóc & Nhắc lịch nộp chứng từ cho Hộ Kinh Doanh',
      description:
        'Liên hệ các Hộ kinh doanh / KOLs gửi sao kê ngân hàng và chứng từ chi phí định kỳ 3 ngày/lần.',
      category: 'CLIENT',
      priority: 'MEDIUM',
      assigneeId: 'usr_staff_minh',
      createdById: 'usr_manager_1',
      scheduleType: 'RECURRING',
      startTime: '15:00',
      endTime: '16:30',
      recurrence: {
        frequency: 'DAILY',
        interval: 3, // 3 ngày 1 lần
        startDate: today,
      },
      telegramEnabled: true,
      notifyTimes: ['14:45'],
      notifyBeforeMinutes: [15],
      notifyTarget: 'PERSONAL',
      remindIfOverdue: false,
      subtasks: [],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_single_tomorrow_trang',
      title: 'Làm việc với Đoàn kiểm tra thuế & Bảo vệ số liệu khách hàng',
      description: 'Chuẩn bị đầy đủ sổ cái, tờ khai quyết toán và chứng từ gốc để giải trình trực tiếp.',
      category: 'TAX_ACCOUNTING',
      priority: 'URGENT',
      assigneeId: 'usr_staff_trang',
      createdById: 'usr_manager_1',
      scheduleType: 'SINGLE',
      startTime: '08:30',
      endTime: '11:30',
      singleDate: tomorrow,
      telegramEnabled: true,
      notifyTimes: ['07:30', '08:15'],
      notifyBeforeMinutes: [15],
      notifyTarget: 'BOTH',
      remindIfOverdue: true,
      subtasks: [
        { id: 'sub_tr1', title: 'In bộ hồ sơ quyết toán & bảng giải trình', completed: false },
        { id: 'sub_tr2', title: 'Kiểm tra giấy ủy quyền đại diện làm việc', completed: true },
      ],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'tsk_single_in3days_khanh',
      title: 'Quay video chia sẻ kiến thức Thuế HKD & KOLs cùng Kế toán trưởng',
      description: 'Chuẩn bị kịch bản, thiết bị ánh sáng và mic thu âm cho buổi quay 5 video ngắn.',
      category: 'MARKETING',
      priority: 'HIGH',
      assigneeId: 'usr_staff_khanh',
      createdById: 'usr_manager_1',
      scheduleType: 'SINGLE',
      startTime: '13:30',
      endTime: '16:30',
      singleDate: in3Days,
      telegramEnabled: true,
      notifyTimes: ['09:00', '13:00'],
      notifyBeforeMinutes: [30],
      notifyTarget: 'BOTH',
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
