import crypto from 'crypto';
import { cookies } from 'next/headers';
import { readDb, sanitizeUser } from './db';
import { ScheduleTask, User } from './types';

export const SESSION_COOKIE_NAME = 'ws_session_token';
const SECRET_KEY = process.env.AUTH_SECRET || 'work-schedule-leta-secret-key-2026-vercel';

interface TokenPayload {
  userId: string;
  username: string;
  role: string;
  exp: number;
}

export function createSessionToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    const expectedSig = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(data)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<Omit<User, 'password'> | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = verifySessionToken(token);
    if (!payload) return null;

    const db = await readDb();
    const user = db.users.find((u) => u.id === payload.userId && u.active);
    if (!user) return null;

    return sanitizeUser(user);
  } catch {
    return null;
  }
}

/**
 * RBAC: Quản lý (MANAGER) xem được toàn bộ lịch của mọi nhân viên.
 * Nhân sự (STAFF) chỉ được phép xem và thao tác trên lịch của chính mình.
 */
export function filterTasksForUser(
  tasks: ScheduleTask[],
  user: Omit<User, 'password'>,
  requestedAssigneeId?: string | null
): ScheduleTask[] {
  if (user.role === 'MANAGER') {
    if (requestedAssigneeId && requestedAssigneeId !== 'ALL') {
      return tasks.filter((t) => t.assigneeId === requestedAssigneeId);
    }
    return tasks;
  }
  // STAFF: Chỉ xem được công việc của chính mình
  return tasks.filter((t) => t.assigneeId === user.id);
}

export function canUserAccessTask(task: ScheduleTask, user: Omit<User, 'password'>): boolean {
  if (user.role === 'MANAGER') return true;
  return task.assigneeId === user.id;
}
