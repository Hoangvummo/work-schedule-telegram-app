import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { canUserAccessTask, getCurrentUser } from '@/lib/auth';
import {
  discoverRecentTelegramChats,
  runNotificationScheduler,
  sendTelegramMessage,
} from '@/lib/telegram';
import { getVietnamDateTime } from '@/lib/recurrence';

export const dynamic = 'force-dynamic';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const db = await readDb();

  // STAFF chỉ xem được lịch sử thông báo của các việc giao cho mình
  const visibleLogs =
    currentUser.role === 'MANAGER'
      ? db.notificationLogs
      : db.notificationLogs.filter((l) => l.assigneeId === currentUser.id);

  // Ẩn bớt Bot Token nếu là STAFF
  const config =
    currentUser.role === 'MANAGER'
      ? db.telegramConfig
      : {
          ...db.telegramConfig,
          botToken: db.telegramConfig.botToken ? '******** (Đã cấu hình bởi Quản lý)' : '',
        };

  return NextResponse.json({
    config,
    hasBotToken: Boolean(db.telegramConfig.botToken && db.telegramConfig.botToken.trim()),
    logs: visibleLogs.slice(0, 60),
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const db = await readDb();

    // 1. Lưu cấu hình Telegram (Chỉ Quản lý)
    if (action === 'save_config') {
      if (currentUser.role !== 'MANAGER') {
        return NextResponse.json(
          { error: 'Chỉ Quản lý mới có quyền thay đổi cấu hình Bot hệ thống' },
          { status: 403 }
        );
      }

      db.telegramConfig = {
        ...db.telegramConfig,
        botToken:
          body.botToken !== undefined
            ? String(body.botToken).trim()
            : db.telegramConfig.botToken,
        groupChatId:
          body.groupChatId !== undefined
            ? String(body.groupChatId).trim()
            : db.telegramConfig.groupChatId,
        managerChatId:
          body.managerChatId !== undefined
            ? String(body.managerChatId).trim()
            : db.telegramConfig.managerChatId,
        dailyDigestEnabled:
          body.dailyDigestEnabled !== undefined
            ? Boolean(body.dailyDigestEnabled)
            : db.telegramConfig.dailyDigestEnabled,
        dailyDigestTime:
          body.dailyDigestTime !== undefined
            ? String(body.dailyDigestTime).trim()
            : db.telegramConfig.dailyDigestTime,
        autoWorkerEnabled:
          body.autoWorkerEnabled !== undefined
            ? Boolean(body.autoWorkerEnabled)
            : db.telegramConfig.autoWorkerEnabled,
        webhookUrl:
          body.webhookUrl !== undefined
            ? String(body.webhookUrl).trim()
            : db.telegramConfig.webhookUrl,
      };

      await writeDb(db);
      return NextResponse.json({ ok: true, config: db.telegramConfig });
    }

    // 2. Quét danh sách người dùng vừa nhắn /start cho Bot
    if (action === 'discover_chats') {
      const tokenToUse =
        currentUser.role === 'MANAGER' && body.botToken
          ? String(body.botToken).trim()
          : db.telegramConfig.botToken;

      const result = await discoverRecentTelegramChats(tokenToUse);
      if (result.ok && result.botInfo && currentUser.role === 'MANAGER') {
        db.telegramConfig.botUsername = result.botInfo.username;
        if (body.botToken) {
          db.telegramConfig.botToken = String(body.botToken).trim();
        }
        await writeDb(db);
      }
      return NextResponse.json(result);
    }

    // 3. Gửi tin nhắn Test kết nối Telegram
    if (action === 'test_message') {
      const tokenToUse =
        currentUser.role === 'MANAGER' && body.botToken
          ? String(body.botToken).trim()
          : db.telegramConfig.botToken;

      const targetChatId =
        String(body.chatId || '').trim() ||
        currentUser.telegramChatId ||
        db.telegramConfig.managerChatId ||
        db.telegramConfig.groupChatId;

      const nowVN = getVietnamDateTime();
      const testHtml = [
        `✅ <b>KIỂM TRA KẾT NỐI TELEGRAM THÀNH CÔNG!</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `👤 <b>Người gửi test:</b> ${currentUser.name}`,
        `🕒 <b>Giờ hệ thống (VN):</b> ${nowVN.timeStr} - ${nowVN.dateStr}`,
        `🚀 <b>Trạng thái:</b> Hệ thống Lịch làm việc đã sẵn sàng tự động bắn thông báo theo giờ hẹn!`,
      ].join('\n');

      const res = await sendTelegramMessage({
        botToken: tokenToUse,
        chatId: targetChatId,
        text: testHtml,
      });

      return NextResponse.json(res);
    }

    // 4. Bắn thông báo ngay lập tức cho 1 công việc (Manual Trigger)
    if (action === 'send_task_now') {
      const taskId = String(body.taskId || '');
      const task = db.tasks.find((t) => t.id === taskId);
      if (!task) {
        return NextResponse.json({ error: 'Không tìm thấy công việc' }, { status: 404 });
      }
      if (!canUserAccessTask(task, currentUser)) {
        return NextResponse.json({ error: 'Không có quyền truy cập' }, { status: 403 });
      }

      const result = await runNotificationScheduler({
        forceSendTaskId: taskId,
        forceDate: body.date,
      });

      return NextResponse.json({
        ok: result.sentCount > 0,
        ...result,
      });
    }

    // 5. Cài đặt Telegram Webhook 1-click khi chạy trên Vercel
    if (action === 'set_webhook') {
      if (currentUser.role !== 'MANAGER') {
        return NextResponse.json({ error: 'Chỉ Quản lý được phép cài Webhook' }, { status: 403 });
      }
      const tokenToUse = String(body.botToken || db.telegramConfig.botToken || '').trim();
      const webhookUrl = String(body.webhookUrl || '').trim();

      if (!tokenToUse || !webhookUrl) {
        return NextResponse.json(
          { ok: false, error: 'Thiếu Bot Token hoặc URL Webhook Vercel' },
          { status: 400 }
        );
      }

      const res = await fetch(
        `https://api.telegram.org/bot${tokenToUse}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );
      const data = await res.json();
      if (data.ok) {
        db.telegramConfig.webhookUrl = webhookUrl;
        await writeDb(db);
      }
      return NextResponse.json({
        ok: Boolean(data.ok),
        description: data.description,
      });
    }

    return NextResponse.json({ error: 'Action không hợp lệ' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý Telegram API' },
      { status: 500 }
    );
  }
}
