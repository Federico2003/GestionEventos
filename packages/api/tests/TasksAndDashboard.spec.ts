import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { TaskEntity } from '../src/domain/entities/TaskAndAgenda';
import { getOverdueTasks } from '../src/domain/services/TaskService';
import { signTestToken } from './fakes/tokens';

const secret = 'tasks-secret';

function task(id: string, dueDate: string, status: TaskEntity['status'] = 'todo'): TaskEntity {
  return new TaskEntity({ id, eventId: 'e-1', title: `Tarea ${id}`, dueDate, status });
}

describe('Tareas — getOverdueTasks y completeTask', () => {
  const now = new Date('2026-11-16T12:00:00Z');

  it('detecta solo tareas no concluidas con fecha límite anterior a hoy, ordenadas', () => {
    const tasks = [
      task('t1', '2026-11-10'),
      task('t2', '2026-11-01', 'in_progress'),
      task('t3', '2026-11-05', 'completed'),
      task('t4', '2026-11-04', 'cancelled'),
      task('t5', '2026-11-20')
    ];
    expect(getOverdueTasks(tasks, now).map((t) => t.id)).toEqual(['t2', 't1']);
    expect(getOverdueTasks([], now)).toEqual([]);
  });

  it('completar una tarea sella completed_at y la saca de las vencidas', () => {
    const late = task('t1', '2026-11-10');
    late.completeTask(now);
    expect(late.status).toBe('completed');
    expect(late.completedAt).toBe(now.toISOString());
    expect(getOverdueTasks([late], now)).toEqual([]);
  });
});

describe('API — tareas del evento y dashboard ejecutivo', () => {
  async function headers(role: 'admin' | 'organizer' | 'client', userId: string) {
    const token = await signTestToken({ userId, role }, secret);
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  it('GET /events/:id/tasks devuelve tareas, vencidas y progreso', async () => {
    const app = createApp({ jwtSecret: secret });
    const h = await headers('organizer', 'u-org');

    await app.request('/api/v1/events/evt-1/tasks', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: 'Confirmar florista', dueDate: '2020-01-01', priority: 'urgent' })
    });

    const res = await app.request('/api/v1/events/evt-1/tasks', { headers: h });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks.length).toBeGreaterThan(0);
    expect(body.overdue.some((t: { title: string }) => t.title === 'Confirmar florista')).toBe(true);
    expect(typeof body.progress).toBe('number');
  });

  it('el dashboard refleja en tiempo real las tareas atrasadas y los próximos eventos', async () => {
    const app = createApp({ jwtSecret: secret });
    const h = await headers('organizer', 'u-org');

    const before = await (await app.request('/api/v1/dashboard', { headers: h })).json();
    expect(Array.isArray(before.upcomingEvents)).toBe(true);
    expect(typeof before.activeEvents).toBe('number');

    await app.request('/api/v1/events/evt-1/tasks', {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ title: 'Pago atrasado de anticipo', dueDate: '2020-01-01' })
    });

    const after = await (await app.request('/api/v1/dashboard', { headers: h })).json();
    expect(after.overdueTasks).toBe(before.overdueTasks + 1);
  });
});
