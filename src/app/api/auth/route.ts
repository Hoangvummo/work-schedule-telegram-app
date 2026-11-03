import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, sanitizeUser } from '@/lib/db';
import {
  createSessionToken,
  getCurrentUser,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  const db = await readDb();

  // Trả về danh sách tài khoản (chỉ tên + role + username, ẩn mật khẩu) để hỗ trợ màn hình đăng nhập
  const availableAccounts = db.users
    .filter((u) => u.active)
    .map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      department: u.department,
      color: u.color,
    }));

  return NextResponse.json({
    authenticated: !!user,
    user,
    availableAccounts,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, password } = body;

    if (action === 'logout') {
      cookies().delete(SESSION_COOKIE_NAME);
      return NextResponse.json({ ok: true });
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
