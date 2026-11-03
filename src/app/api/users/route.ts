import { NextRequest, NextResponse } from 'next/server';
import { readDb, sanitizeUser, writeDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const db = await readDb();
  if (currentUser.role === 'MANAGER') {
    return NextResponse.json({
      users: db.users.map(sanitizeUser),
    });
  }

  // STAFF chỉ được xem thông tin tài khoản của chính mình
  return NextResponse.json({
    users: [currentUser],
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Chỉ Quản lý mới có quyền thêm tài khoản nhân sự' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '123456').trim();
    const name = String(body.name || '').trim();

    if (!username || !name) {
      return NextResponse.json(
        { error: 'Tên đăng nhập và Họ tên nhân sự không được để trống' },
        { status: 400 }
      );
    }

    const db = await readDb();
    if (db.users.some((u) => u.username.toLowerCase() === username)) {
      return NextResponse.json(
        { error: `Tên đăng nhập "${username}" đã tồn tại` },
        { status: 400 }
      );
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      username,
      password,
      name,
      role: body.role === 'MANAGER' ? 'MANAGER' : 'STAFF',
      department: String(body.department || 'Nhân sự').trim(),
      color: body.color || '#2563EB',
      telegramChatId: String(body.telegramChatId || '').trim(),
      telegramUsername: String(body.telegramUsername || '').trim().replace(/^@/, ''),
      active: true,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await writeDb(db);

    return NextResponse.json({
      ok: true,
      user: sanitizeUser(newUser),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi thêm nhân sự' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const targetId = String(body.id || currentUser.id);

    // STAFF chỉ được sửa thông tin Telegram / mật khẩu của chính mình
    if (currentUser.role !== 'MANAGER' && targetId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Bạn không có quyền sửa tài khoản của người khác' },
        { status: 403 }
      );
    }

    const db = await readDb();
    const idx = db.users.findIndex((u) => u.id === targetId);
    if (idx === -1) {
      return NextResponse.json({ error: 'Không tìm thấy nhân sự' }, { status: 404 });
    }

    const target = db.users[idx];

    if (currentUser.role === 'MANAGER') {
      if (body.name !== undefined) target.name = String(body.name).trim();
      if (body.department !== undefined) target.department = String(body.department).trim();
      if (body.role !== undefined) target.role = body.role === 'MANAGER' ? 'MANAGER' : 'STAFF';
      if (body.color !== undefined) target.color = String(body.color);
      if (body.active !== undefined) target.active = Boolean(body.active);
    }

    if (body.telegramChatId !== undefined) {
      target.telegramChatId = String(body.telegramChatId).trim();
    }
    if (body.telegramUsername !== undefined) {
      target.telegramUsername = String(body.telegramUsername).trim().replace(/^@/, '');
    }
    if (body.password && String(body.password).trim() !== '') {
      target.password = String(body.password).trim();
    }

    db.users[idx] = target;
    await writeDb(db);

    return NextResponse.json({
      ok: true,
      user: sanitizeUser(target),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi cập nhật nhân sự' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'MANAGER') {
    return NextResponse.json(
      { error: 'Chỉ Quản lý mới có quyền xóa nhân sự' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Thiếu ID nhân sự' }, { status: 400 });
  }

  if (id === currentUser.id) {
    return NextResponse.json(
      { error: 'Không thể tự xóa tài khoản Quản lý đang đăng nhập' },
      { status: 400 }
    );
  }

  const db = await readDb();
  db.users = db.users.filter((u) => u.id !== id);
  await writeDb(db);

  return NextResponse.json({ ok: true });
}
