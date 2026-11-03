import { NextRequest, NextResponse } from 'next/server';
import { readDb, sanitizeUser, writeDb } from '@/lib/db';
import {
  canUserAccessTask,
  filterTasksForUser,
  getCurrentUser,
} from '@/lib/auth';
import {
  addDaysToDateStr,
  getOccurrencesInRange,
  getVietnamDateTime,
} from '@/lib/recurrence';
import {
  OccurrenceState,
  ScheduleTask,
  User,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const db = await readDb();
  const { searchParams } = new URL(req.url);
  const assigneeFilter = searchParams.get('assigneeId');
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  const nowVN = getVietnamDateTime();
  const rangeStart = startDateParam || addDaysToDateStr(nowVN.dateStr, -35);
  const rangeEnd = endDateParam || addDaysToDateStr(nowVN.dateStr, 65);

  // Phân quyền nghiêm ngặt:
  // - MANAGER: Xem toàn bộ hoặc lọc theo nhân viên
  // - STAFF: Chỉ lấy đúng công việc của bản thân (assigneeId === currentUser.id)
  const visibleTasks = filterTasksForUser(db.tasks, currentUser, assigneeFilter);

  const visibleUsers =
    currentUser.role === 'MANAGER'
      ? db.users.filter((u) => u.active).map(sanitizeUser)
      : [currentUser];

  const usersMap: Record<string, Omit<User, 'password'>> = {};
  for (const u of db.users) {
    usersMap[u.id] = sanitizeUser(u);
  }

  const occurrences = getOccurrencesInRange(
    visibleTasks,
    rangeStart,
    rangeEnd,
    usersMap
  );

  return NextResponse.json({
    currentUser,
    tasks: visibleTasks,
    occurrences,
    users: visibleUsers,
    serverTimeVN: nowVN,
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = await readDb();
    const nowVN = getVietnamDateTime();

    // Nếu là STAFF thì chỉ được phép gán việc cho chính mình
    const resolvedAssigneeId =
      currentUser.role === 'MANAGER' && body.assigneeId
        ? String(body.assigneeId)
        : currentUser.id;

    const newTask: ScheduleTask = {
      id: `tsk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: String(body.title || '').trim(),
      description: String(body.description || '').trim(),
      category: body.category || 'OTHER',
      priority: body.priority || 'MEDIUM',
      assigneeId: resolvedAssigneeId,
      createdById: currentUser.id,
      scheduleType: body.scheduleType || 'SINGLE',
      startTime: body.startTime || '09:00',
      endTime: body.endTime || '10:30',
      singleDate: body.singleDate || nowVN.dateStr,
      selectedDates: Array.isArray(body.selectedDates)
        ? Array.from(new Set<string>(body.selectedDates.map(String))).sort()
        : [nowVN.dateStr],
      recurrence: body.recurrence || {
        frequency: 'DAILY',
        interval: 2,
        startDate: nowVN.dateStr,
      },
      telegramEnabled: body.telegramEnabled !== false,
      notifyTimes: Array.isArray(body.notifyTimes)
        ? Array.from(new Set<string>(body.notifyTimes.filter(Boolean).map(String))).sort()
        : ['08:30'],
      notifyBeforeMinutes: Array.isArray(body.notifyBeforeMinutes)
        ? body.notifyBeforeMinutes.map(Number).filter((n: number) => !isNaN(n) && n >= 0)
        : [15],
      notifyTarget: body.notifyTarget || 'PERSONAL',
      remindIfOverdue: !!body.remindIfOverdue,
      subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
      occurrenceStatuses: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!newTask.title) {
      return NextResponse.json(
        { error: 'Tiêu đề công việc không được để trống' },
        { status: 400 }
      );
    }

    db.tasks.unshift(newTask);
    await writeDb(db);

    return NextResponse.json({ ok: true, task: newTask });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi tạo lịch làm việc' },
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
    const db = await readDb();
    const taskIndex = db.tasks.findIndex((t) => t.id === body.id || t.id === body.taskId);

    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Không tìm thấy công việc' }, { status: 404 });
    }

    const existingTask = db.tasks[taskIndex];
    if (!canUserAccessTask(existingTask, currentUser)) {
      return NextResponse.json(
        { error: 'Bạn không có quyền chỉnh sửa công việc của nhân sự khác' },
        { status: 403 }
      );
    }

    // 1. Cập nhật trạng thái của 1 buổi làm việc cụ thể (Occurrence theo ngày YYYY-MM-DD)
    if (body.action === 'update_occurrence') {
      const dateStr = String(body.date || '');
      const newStatus = (body.status || 'TODO') as OccurrenceState;
      if (!existingTask.occurrenceStatuses) {
        existingTask.occurrenceStatuses = {};
      }
      existingTask.occurrenceStatuses[dateStr] = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        completedAt: newStatus === 'DONE' ? new Date().toISOString() : undefined,
        note: body.note ?? existingTask.occurrenceStatuses[dateStr]?.note,
      };
      existingTask.updatedAt = new Date().toISOString();
      db.tasks[taskIndex] = existingTask;
      await writeDb(db);
      return NextResponse.json({ ok: true, task: existingTask });
    }

    // 2. Cập nhật tích chọn Subtask (Checklist con)
    if (body.action === 'toggle_subtask') {
      const subtaskId = String(body.subtaskId || '');
      existingTask.subtasks = (existingTask.subtasks || []).map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );
      existingTask.updatedAt = new Date().toISOString();
      db.tasks[taskIndex] = existingTask;
      await writeDb(db);
      return NextResponse.json({ ok: true, task: existingTask });
    }

    // 3. Cập nhật toàn bộ thông tin công việc
    const updatedAssigneeId =
      currentUser.role === 'MANAGER' && body.assigneeId
        ? String(body.assigneeId)
        : existingTask.assigneeId;

    const updatedTask: ScheduleTask = {
      ...existingTask,
      title: body.title !== undefined ? String(body.title).trim() : existingTask.title,
      description:
        body.description !== undefined
          ? String(body.description).trim()
          : existingTask.description,
      category: body.category || existingTask.category,
      priority: body.priority || existingTask.priority,
      assigneeId: updatedAssigneeId,
      scheduleType: body.scheduleType || existingTask.scheduleType,
      startTime: body.startTime || existingTask.startTime,
      endTime: body.endTime || existingTask.endTime,
      singleDate: body.singleDate ?? existingTask.singleDate,
      selectedDates: Array.isArray(body.selectedDates)
        ? Array.from(new Set<string>(body.selectedDates.map(String))).sort()
        : existingTask.selectedDates,
      recurrence: body.recurrence || existingTask.recurrence,
      telegramEnabled:
        body.telegramEnabled !== undefined
          ? Boolean(body.telegramEnabled)
          : existingTask.telegramEnabled,
      notifyTimes: Array.isArray(body.notifyTimes)
        ? Array.from(new Set<string>(body.notifyTimes.filter(Boolean).map(String))).sort()
        : existingTask.notifyTimes,
      notifyBeforeMinutes: Array.isArray(body.notifyBeforeMinutes)
        ? body.notifyBeforeMinutes.map(Number)
        : existingTask.notifyBeforeMinutes,
      notifyTarget: body.notifyTarget || existingTask.notifyTarget,
      remindIfOverdue:
        body.remindIfOverdue !== undefined
          ? Boolean(body.remindIfOverdue)
          : existingTask.remindIfOverdue,
      subtasks: Array.isArray(body.subtasks) ? body.subtasks : existingTask.subtasks,
      updatedAt: new Date().toISOString(),
    };

    db.tasks[taskIndex] = updatedTask;
    await writeDb(db);

    return NextResponse.json({ ok: true, task: updatedTask });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi cập nhật công việc' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Thiếu ID công việc' }, { status: 400 });
  }

  const db = await readDb();
  const task = db.tasks.find((t) => t.id === id);
  if (!task) {
    return NextResponse.json({ error: 'Không tìm thấy công việc' }, { status: 404 });
  }

  if (!canUserAccessTask(task, currentUser)) {
    return NextResponse.json(
      { error: 'Bạn không có quyền xóa công việc này' },
      { status: 403 }
    );
  }

  db.tasks = db.tasks.filter((t) => t.id !== id);
  await writeDb(db);

  return NextResponse.json({ ok: true });
}
