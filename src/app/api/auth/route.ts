import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, sanitizeUser, writeDb } from '@/lib/db';
import {
  createSessionToken,
  getCurrentUser,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    authenticated: !!user,
    user,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, password, name, color } = body;

    if (action === 'logout') {
      cookies().delete(SESSION_COOKIE_NAME);
      return NextResponse.json({ ok: true });
    }

    // ĐĂNG KÝ TÀI KHOẢN MỚI (Mặc định luôn là tài khoản cá nhân riêng biệt - role STAFF)
    if (action === 'register') {
      const cleanUsername = String(username || '').trim().toLowerCase();
      const cleanPassword = String(password || '').trim();
      const cleanName = String(name || '').trim() || cleanUsername;

      if (!cleanUsername || !cleanPassword) {
        return NextResponse.json(
          { error: 'Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu' },
          { status: 400 }
        );
      }

      if (cleanUsername.length < 3) {
        return NextResponse.json(
          { error: 'Tên đăng nhập cần có ít nhất 3 ký tự' },
          { status: 400 }
        );
      }

      if (cleanPassword.length < 4) {
        return NextResponse.json(
          { error: 'Mật khẩu cần có ít nhất 4 ký tự' },
          { status: 400 }
        );
      }

      const db = await readDb();
      const exists = db.users.some(
        (u) => u.username.toLowerCase() === cleanUsername
      );
      if (exists) {
        return NextResponse.json(
          { error: 'Tên đăng nhập này đã được sử dụng, vui lòng chọn tên khác' },
          { status: 400 }
        );
      }

      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        username: cleanUsername,
        password: cleanPassword,
        name: cleanName,
        role: 'STAFF',
        department: '',
        color: color || '#4F46E5',
        telegramChatId: '',
        telegramUsername: '',
        active: true,
        createdAt: new Date().toISOString(),
      };

      db.users.push(newUser);
      await writeDb(db);

      const token = createSessionToken(newUser);
      cookies().set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 14,
      });

      return NextResponse.json({
        ok: true,
        user: sanitizeUser(newUser),
      });
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập tên đăng nhập và mật khẩu' },
        { status: 400 }
      );
    }

    const db = await readDb();
    const user = db.users.find(
      (u) =>
        u.active &&
        u.username.toLowerCase() === String(username).trim().toLowerCase() &&
        u.password === String(password)
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Tên đăng nhập hoặc mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    const token = createSessionToken(user);
    cookies().set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 14, // 14 ngày
    });

    return NextResponse.json({
      ok: true,
      user: sanitizeUser(user),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi xử lý đăng nhập' },
      { status: 500 }
    );
  }
}
