import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import { getVietnamDateTime, minutesToTimeStr } from '@/lib/recurrence';
import { escapeHtml, sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * Telegram Webhook Endpoint (/api/telegram/webhook)
 * Nhận sự kiện trực tiếp từ Telegram 24/7 trên Vercel khi:
 * 1. Nhân sự bấm nút [✅ Đã hoàn thành], [⏳ Đang xử lý], hoặc [⏰ Nhắc lại 15p] dưới tin nhắn Telegram
 * 2. Nhân sự nhắn /start hoặc /myid cho Bot để lấy Chat ID tự động
 */
export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const db = await readDb();
    const botToken = db.telegramConfig.botToken;

    if (!botToken) {
      return NextResponse.json({ ok: true });
    }

    // 1. Xử lý khi người dùng bấm nút Inline Button dưới tin nhắn nhắc việc
    if (update.callback_query) {
      const cb = update.callback_query;
      const dataStr = String(cb.data || '');
      const [action, taskId, occurrenceDate] = dataStr.split('|');

      const task = db.tasks.find((t) => t.id === taskId);
      if (task && occurrenceDate) {
        if (!task.occurrenceStatuses) {
          task.occurrenceStatuses = {};
        }
        const nowVN = getVietnamDateTime();
        let feedbackText = '';

        if (action === 'done') {
          task.occurrenceStatuses[occurrenceDate] = {
            status: 'DONE',
            updatedAt: nowVN.iso,
            completedAt: nowVN.iso,
          };
          feedbackText = `✅ Đã xác nhận HOÀN THÀNH công việc "${task.title}" (Ngày ${occurrenceDate}) lúc ${nowVN.timeStr}!`;
        } else if (action === 'prog') {
          task.occurrenceStatuses[occurrenceDate] = {
            ...task.occurrenceStatuses[occurrenceDate],
            status: 'IN_PROGRESS',
            updatedAt: nowVN.iso,
          };
          feedbackText = `⏳ Đã chuyển trạng thái "${task.title}" sang ĐANG XỬ LÝ!`;
        } else if (action === 'snooze15') {
          const snoozeTimeStr = minutesToTimeStr(nowVN.minutesOfDay + 15);
          task.occurrenceStatuses[occurrenceDate] = {
            status: task.occurrenceStatuses[occurrenceDate]?.status || 'TODO',
            updatedAt: nowVN.iso,
            snoozedUntil: snoozeTimeStr,
          };
          feedbackText = `⏰ Đã hẹn nhắc lại công việc "${task.title}" vào lúc ${snoozeTimeStr}!`;
        }

        task.updatedAt = nowVN.iso;
        await writeDb(db);

        // Trả lời popup callback trên Telegram
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: cb.id,
            text: feedbackText,
            show_alert: false,
          }),
        });

        // Gửi tin nhắn phản hồi xác nhận vào khung chat
        const chatId = cb.message?.chat?.id;
        if (chatId && feedbackText) {
          await sendTelegramMessage({
            botToken,
            chatId: String(chatId),
            text: `<b>${escapeHtml(feedbackText)}</b>`,
          });
        }
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Xử lý khi nhân sự nhắn /start hoặc /myid cho Bot
    if (update.message?.text) {
      const text = String(update.message.text).trim();
      const chat = update.message.chat;
      if (chat?.id && (text.startsWith('/start') || text.startsWith('/myid'))) {
        const chatIdStr = String(chat.id);
        const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || 'Bạn';

        const matchedUser = db.users.find((u) => u.telegramChatId === chatIdStr);

        const replyLines = [
          `👋 Xin chào <b>${escapeHtml(fullName)}</b>!`,
          `🤖 Đây là <b>Bot Nhắc Lịch Tự Động</b>.`,
          ``,
          `🆔 <b>Telegram Chat ID của bạn là:</b> <code>${chatIdStr}</code>`,
          matchedUser
            ? `✅ Đã liên kết với tài khoản: <b>${escapeHtml(matchedUser.name)}</b>.`
            : `💡 Hãy copy mã Chat ID này dán vào mục "Kết nối Telegram" trên Web (hoặc bấm nút "Quét tài khoản vừa nhắn Bot" trên Web) để tự động nhận lịch nhắc việc.`,
        ];

        await sendTelegramMessage({
          botToken,
          chatId: chatIdStr,
          text: replyLines.join('\n'),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: true });
  }
}
