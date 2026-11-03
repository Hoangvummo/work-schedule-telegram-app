import {
  DatabaseSchema,
  NotificationLog,
  ScheduleTask,
  User,
} from './types';
import {
  doesTaskOccurOnDate,
  formatDisplayDateVN,
  formatScheduleSummary,
  getVietnamDateTime,
  minutesToTimeStr,
  timeStrToMinutes,
} from './recurrence';
import { readDb, writeDb } from './db';

const PRIORITY_LABELS: Record<string, string> = {
  LOW: '🟢 Thấp',
  MEDIUM: '🔵 Trung bình',
  HIGH: '🟠 Cao',
  URGENT: '🔴 Khẩn cấp',
};

const CATEGORY_LABELS: Record<string, string> = {
  TAX_ACCOUNTING: '📊 Kế toán - Thuế',
  CLIENT: '🤝 Khách hàng',
  MEETING: '📅 Họp nội bộ',
  REPORT: '📑 Báo cáo',
  OPERATION: '⚙️ Vận hành',
  MARKETING: '📣 Marketing',
  OTHER: '📌 Khác',
};

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramMessage(params: {
  botToken: string;
  chatId: string;
  text: string;
  replyMarkup?: Record<string, unknown>;
}): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const { botToken, chatId, text, replyMarkup } = params;
  if (!botToken || ! botToken.trim()) {
    return { ok: false, error: 'Chưa cấu hình Telegram Bot Token' };
  }
  if (!chatId || !chatId.trim()) {
    return { ok: false, error: 'Chưa cấu hình Telegram Chat ID người nhận' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error: data?.description || `HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      messageId: data.result?.message_id,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Lỗi kết nối Telegram API',
    };
  }
}

export function buildTaskNotificationHtml(params: {
  task: ScheduleTask;
  occurrenceDate: string;
  assignee?: User;
  slotLabel: string;
}): { text: string; replyMarkup: Record<string, unknown> } {
  const { task, occurrenceDate, assignee, slotLabel } = params;
  const assigneeMention = assignee?.telegramUsername
    ? `${escapeHtml(assignee.name)} (@${escapeHtml(assignee.telegramUsername.replace(/^@/, ''))})`
    : escapeHtml(assignee?.name || 'Chưa phân công');

  const lines: string[] = [
    `🔔 <b>NHẮC LỊCH LÀM VIỆC</b> <i>(${escapeHtml(slotLabel)})</i>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>Công việc:</b> ${escapeHtml(task.title)}`,
    `👤 <b>Phụ trách:</b> ${assigneeMention}`,
    `🕒 <b>Thời gian:</b> ${escapeHtml(task.startTime)} - ${escapeHtml(task.endTime)} | Ngày <b>${formatDisplayDateVN(occurrenceDate)}</b>`,
    `🔄 <b>Loại lịch:</b> ${escapeHtml(formatScheduleSummary(task))}`,
    `🏷 <b>Danh mục:</b> ${CATEGORY_LABELS[task.category] || 'Khác'} | <b>Ưu tiên:</b> ${PRIORITY_LABELS[task.priority] || task.priority}`,
  ];

  if (task.description && task.description.trim()) {
    lines.push(`📝 <b>Ghi chú:</b> ${escapeHtml(task.description.trim())}`);
  }

  if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
    lines.push(`\n<b>📋 Checklist đầu việc:</b>`);
    for (const sub of task.subtasks) {
      lines.push(`${sub.completed ? '✅' : '⬜'} ${escapeHtml(sub.title)}`);
    }
  }

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: '✅ Đã hoàn thành',
          callback_data: `done|${task.id}|${occurrenceDate}`,
        },
        {
          text: '⏳ Đang xử lý',
          callback_data: `prog|${task.id}|${occurrenceDate}`,
        },
      ],
      [
        {
          text: '⏰ Nhắc lại sau 15 phút',
          callback_data: `snooze15|${task.id}|${occurrenceDate}`,
        },
      ],
    ],
  };

  return {
    text: lines.join('\n'),
    replyMarkup,
  };
}

export function resolveTargetChatIds(
  task: ScheduleTask,
  assignee: User | undefined,
  db: DatabaseSchema
): string[] {
  const targets = new Set<string>();
  const personalChatId = assignee?.telegramChatId?.trim();
  const groupChatId = db.telegramConfig.groupChatId?.trim();
  const managerChatId = db.telegramConfig.managerChatId?.trim();

  if (task.notifyTarget === 'PERSONAL') {
    if (personalChatId) targets.add(personalChatId);
    else if (managerChatId) targets.add(managerChatId);
  } else if (task.notifyTarget === 'GROUP') {
    if (groupChatId) targets.add(groupChatId);
    else if (personalChatId) targets.add(personalChatId);
  } else {
    // BOTH
    if (personalChatId) targets.add(personalChatId);
    if (groupChatId) targets.add(groupChatId);
  }

  // Fallback nếu nhân sự chưa điền Chat ID riêng nhưng Quản lý đã điền Chat ID
  if (targets.size === 0 && managerChatId) {
    targets.add(managerChatId);
  }
  if (targets.size === 0 && groupChatId) {
    targets.add(groupChatId);
  }

  return Array.from(targets);
}

/**
 * Gửi thông báo cho 1 công việc cụ thể ngay lập tức (dùng cho cả Scheduler tự động & nút Bắn thông báo ngay)
 */
export async function dispatchTaskNotification(params: {
  db: DatabaseSchema;
  task: ScheduleTask;
  occurrenceDate: string;
  slotKey: string;
  slotLabel: string;
  overrideChatId?: string;
}): Promise<NotificationLog[]> {
  const { db, task, occurrenceDate, slotKey, slotLabel, overrideChatId } = params;
  const assignee = db.users.find((u) => u.id === task.assigneeId);
  const chatIds = overrideChatId
    ? [overrideChatId]
    : resolveTargetChatIds(task, assignee, db);

  const { text, replyMarkup } = buildTaskNotificationHtml({
    task,
    occurrenceDate,
    assignee,
    slotLabel,
  });

  const createdLogs: NotificationLog[] = [];

  if (chatIds.length === 0) {
    const failedLog: NotificationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      assigneeName: assignee?.name || 'N/A',
      occurrenceDate,
      notifyTimeSlot: slotKey,
      targetChatId: 'CHƯA_CẤU_HÌNH',
      status: 'FAILED',
      messagePreview: task.title,
      error: 'Nhân sự hoặc nhóm chưa có Telegram Chat ID',
      sentAt: new Date().toISOString(),
    };
    db.notificationLogs.unshift(failedLog);
    createdLogs.push(failedLog);
    return createdLogs;
  }

  for (const chatId of chatIds) {
    const res = await sendTelegramMessage({
      botToken: db.telegramConfig.botToken,
      chatId,
      text,
      replyMarkup,
    });

    const logItem: NotificationLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: task.id,
      taskTitle: task.title,
      assigneeId: task.assigneeId,
      assigneeName: assignee?.name || 'N/A',
      occurrenceDate,
      notifyTimeSlot: slotKey,
      targetChatId: chatId,
      status: res.ok ? 'SENT' : 'FAILED',
      messagePreview: `${slotLabel} -> ${task.title}`,
      error: res.error,
      telegramMessageId: res.messageId,
      sentAt: new Date().toISOString(),
    };

    db.notificationLogs.unshift(logItem);
    createdLogs.push(logItem);
  }

  // Giữ tối đa 200 log gần nhất
  if (db.notificationLogs.length > 200) {
    db.notificationLogs = db.notificationLogs.slice(0, 200);
  }

  return createdLogs;
}

/**
 * Tiến trình quét lịch & bắn thông báo Telegram tự động theo giờ tự chọn
 * Được gọi bởi:
 * 1. /api/cron/notify (Cronjob trên Vercel / GitHub Actions / cron-job.org)
 * 2. Background heartbeat khi mở Web App
 */
export async function runNotificationScheduler(options?: {
  forceSendTaskId?: string;
  forceDate?: string;
}): Promise<{
  checkedAt: string;
  vietnamDate: string;
  vietnamTime: string;
  sentCount: number;
  failedCount: number;
  logs: NotificationLog[];
}> {
  const db = await readDb();
  const nowVN = getVietnamDateTime();
  const today = options?.forceDate || nowVN.dateStr;
  const currentMinutes = nowVN.minutesOfDay;
  const triggeredLogs: NotificationLog[] = [];

  if (!db.sentDeduplicationKeys) {
    db.sentDeduplicationKeys = {};
  }

  // Trường hợp bấm nút "Bắn Telegram ngay" cho 1 công việc cụ thể
  if (options?.forceSendTaskId) {
    const task = db.tasks.find((t) => t.id === options.forceSendTaskId);
    if (task) {
      const logs = await dispatchTaskNotification({
        db,
        task,
        occurrenceDate: today,
        slotKey: `MANUAL_${nowVN.timeStr}`,
        slotLabel: `Gửi thủ công lúc ${nowVN.timeStr}`,
      });
      triggeredLogs.push(...logs);
      await writeDb(db);
    }
    return {
      checkedAt: nowVN.iso,
      vietnamDate: today,
      vietnamTime: nowVN.timeStr,
      sentCount: triggeredLogs.filter((l) => l.status === 'SENT').length,
      failedCount: triggeredLogs.filter((l) => l.status === 'FAILED').length,
      logs: triggeredLogs,
    };
  }

  // Nếu chưa cấu hình Bot Token thì không quét tự động
  if (!db.telegramConfig.botToken || !db.telegramConfig.botToken.trim()) {
    return {
      checkedAt: nowVN.iso,
      vietnamDate: today,
      vietnamTime: nowVN.timeStr,
      sentCount: 0,
      failedCount: 0,
      logs: [],
    };
  }

  let dbChanged = false;

  // Quét tất cả công việc diễn ra trong ngày hôm nay (theo giờ VN)
  for (const task of db.tasks) {
    if (!task.telegramEnabled) continue;
    if (!doesTaskOccurOnDate(task, today)) continue;

    const occRecord = task.occurrenceStatuses?.[today];
    if (occRecord?.status === 'DONE' || occRecord?.status === 'SKIPPED') {
      continue;
    }

    // 1. Kiểm tra các GIỜ TỰ CHỌN (task.notifyTimes - VD: ["08:00", "13:45"])
    for (const customTime of task.notifyTimes || []) {
      const targetMinutes = timeStrToMinutes(customTime);
      const diff = currentMinutes - targetMinutes;
      // Cửa sổ khớp 12 phút để đảm bảo cron chạy mỗi 1-5 phút trên Vercel không bao giờ bỏ sót
      if (diff >= 0 && diff <= 12) {
        const dedupKey = `${task.id}__${today}__CUSTOM_${customTime}`;
        if (!db.sentDeduplicationKeys[dedupKey]) {
          db.sentDeduplicationKeys[dedupKey] = nowVN.iso;
          dbChanged = true;
          const logs = await dispatchTaskNotification({
            db,
            task,
            occurrenceDate: today,
            slotKey: `CUSTOM_${customTime}`,
            slotLabel: `Giờ hẹn tự chọn ${customTime}`,
          });
          triggeredLogs.push(...logs);
        }
      }
    }

    // 2. Kiểm tra thông báo TRƯỚC GIỜ BẮT ĐẦU (task.notifyBeforeMinutes - VD: [15, 30])
    const startMinutes = timeStrToMinutes(task.startTime);
    for (const beforeMin of task.notifyBeforeMinutes || []) {
      const triggerMinutes = startMinutes - beforeMin;
      const diff = currentMinutes - triggerMinutes;
      if (diff >= 0 && diff <= 12) {
        const dedupKey = `${task.id}__${today}__BEFORE_${beforeMin}M`;
        if (!db.sentDeduplicationKeys[dedupKey]) {
          db.sentDeduplicationKeys[dedupKey] = nowVN.iso;
          dbChanged = true;
          const logs = await dispatchTaskNotification({
            db,
            task,
            occurrenceDate: today,
            slotKey: `BEFORE_${beforeMin}M`,
            slotLabel: `Trước giờ bắt đầu ${beforeMin} phút (${minutesToTimeStr(triggerMinutes)})`,
          });
          triggeredLogs.push(...logs);
        }
      }
    }

    // 3. Kiểm tra lịch hẹn nhắc lại (Snooze)
    if (occRecord?.snoozedUntil) {
      const snoozeMinutes = timeStrToMinutes(occRecord.snoozedUntil);
      const diff = currentMinutes - snoozeMinutes;
      if (diff >= 0 && diff <= 15) {
        const dedupKey = `${task.id}__${today}__SNOOZE_${occRecord.snoozedUntil}`;
        if (!db.sentDeduplicationKeys[dedupKey]) {
          db.sentDeduplicationKeys[dedupKey] = nowVN.iso;
          delete occRecord.snoozedUntil;
          dbChanged = true;
          const logs = await dispatchTaskNotification({
            db,
            task,
            occurrenceDate: today,
            slotKey: `SNOOZE_${nowVN.timeStr}`,
            slotLabel: `Nhắc lại theo yêu cầu (${nowVN.timeStr})`,
          });
          triggeredLogs.push(...logs);
        }
      }
    }
  }

  // 4. Kiểm tra Bản tin tổng hợp lịch buổi sáng (Daily Digest)
  if (db.telegramConfig.dailyDigestEnabled && db.telegramConfig.dailyDigestTime) {
    const digestMinutes = timeStrToMinutes(db.telegramConfig.dailyDigestTime);
    const diff = currentMinutes - digestMinutes;
    if (diff >= 0 && diff <= 15 && db.telegramConfig.lastDailyDigestDate !== today) {
      db.telegramConfig.lastDailyDigestDate = today;
      dbChanged = true;

      const todaysTasks = db.tasks.filter((t) => doesTaskOccurOnDate(t, today));
      if (todaysTasks.length > 0) {
        // Gửi bản tổng hợp chung cho Quản lý / Group
        const targetChat =
          db.telegramConfig.groupChatId?.trim() || db.telegramConfig.managerChatId?.trim();
        if (targetChat) {
          const summaryLines = [
            `☀️ <b>TỔNG HỢP LỊCH LÀM VIỆC HÔM NAY (${formatDisplayDateVN(today)})</b>`,
            `━━━━━━━━━━━━━━━━━━━━`,
            `Tổng số công việc trong ngày: <b>${todaysTasks.length} việc</b>\n`,
          ];
          for (const t of todaysTasks) {
            const u = db.users.find((usr) => usr.id === t.assigneeId);
            summaryLines.push(
              `• <b>[${escapeHtml(t.startTime)}]</b> ${escapeHtml(t.title)} — <i>${escapeHtml(u?.name || '')}</i>`
            );
          }
          await sendTelegramMessage({
            botToken: db.telegramConfig.botToken,
            chatId: targetChat,
            text: summaryLines.join('\n'),
          });
        }
      }
    }
  }

  if (dbChanged) {
    await writeDb(db);
  }

  return {
    checkedAt: nowVN.iso,
    vietnamDate: today,
    vietnamTime: nowVN.timeStr,
    sentCount: triggeredLogs.filter((l) => l.status === 'SENT').length,
    failedCount: triggeredLogs.filter((l) => l.status === 'FAILED').length,
    logs: triggeredLogs,
  };
}

/**
 * Quét danh sách các tài khoản/nhóm vừa nhắn tin cho Bot Telegram (getUpdates)
 * Giúp Quản lý lấy Chat ID của nhân sự chỉ bằng 1 cú click chuột
 */
export async function discoverRecentTelegramChats(botToken: string): Promise<{
  ok: boolean;
  botInfo?: { id: number; username: string; firstName: string };
  chats: Array<{
    chatId: string;
    title: string;
    username?: string;
    type: string;
    lastMessage?: string;
  }>;
  error?: string;
}> {
  if (!botToken || !botToken.trim()) {
    return { ok: false, chats: [], error: 'Vui lòng nhập Bot Token trước' };
  }

  try {
    const meRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
    const meData = await meRes.json();
    if (!meRes.ok || !meData.ok) {
      return {
        ok: false,
        chats: [],
        error: meData?.description || 'Bot Token không hợp lệ',
      };
    }

    const botInfo = {
      id: meData.result.id,
      username: meData.result.username,
      firstName: meData.result.first_name,
    };

    const upRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getUpdates?limit=50`);
    const upData = await upRes.json();

    const chatMap = new Map<
      string,
      { chatId: string; title: string; username?: string; type: string; lastMessage?: string }
    >();

    if (upData.ok && Array.isArray(upData.result)) {
      for (const update of upData.result) {
        const msg = update.message || update.edited_message || update. callback_query?.message;
        const chat = msg?.chat || update.my_chat_member?.chat;
        if (chat && chat.id) {
          const chatIdStr = String(chat.id);
          const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ');
          const title = chat.title || fullName || chat.username || `Chat ${chatIdStr}`;
          chatMap.set(chatIdStr, {
            chatId: chatIdStr,
            title,
            username: chat.username,
            type: chat.type,
            lastMessage: msg?.text || '',
          });
        }
      }
    }

    return {
      ok: true,
      botInfo,
      chats: Array.from(chatMap.values()),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      chats: [],
      error: err instanceof Error ? err.message : 'Không thể kết nối Telegram API',
    };
  }
}
