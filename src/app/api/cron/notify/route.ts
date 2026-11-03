import { NextRequest, NextResponse } from 'next/server';
import { runNotificationScheduler } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * Endpoint dành cho:
 * 1. Vercel Cron / cron-job.org / GitHub Actions gọi định kỳ mỗi 1-5 phút (GET hoặc POST)
 * 2. Web App heartbeat tự động gọi khi đang mở trình duyệt
 */
export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}

async function handleCronTrigger(req: NextRequest) {
  try {
    // Nếu biến môi trường CRON_SECRET được cấu hình trên Vercel thì kiểm tra bảo mật
    const configuredSecret = process.env.CRON_SECRET;
    if (configuredSecret && configuredSecret.trim() !== '') {
      const authHeader = req.headers.get('authorization');
      const querySecret = new URL(req.url).searchParams.get('secret');
      const isInternalBrowser = req.headers.get('x-internal-heartbeat') === '1';

      if (
        !isInternalBrowser &&
        authHeader !== `Bearer ${configuredSecret}` &&
        querySecret !== configuredSecret
      ) {
        return NextResponse.json({ error: 'Unauthorized Cron Call' }, { status: 401 });
      }
    }

    const result = await runNotificationScheduler();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Cron execution failed',
      },
      { status: 500 }
    );
  }
}
