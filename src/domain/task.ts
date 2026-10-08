import { z } from 'zod';

export const statuses = ['inbox', 'pending', 'progress', 'someday', 'completed'] as const;
export const statusLabels: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  pending: 'Pendentes',
  progress: 'Em progresso',
  someday: 'Algum dia',
  completed: 'Concluídas',
};
export type TaskStatus = (typeof statuses)[number];
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Identificador inválido.');
const title = z.string().trim().min(1, 'Informe um título.').max(240, 'Use até 240 caracteres.');
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00`);
    return !isNaN(d.getTime()) && localDate(d) === v;
  }, 'Data inválida');
const timestamp = z.string().datetime({ offset: true });
export const recurrenceSchema = z.object({
  unit: z.enum(['day', 'week', 'month']),
  interval: z.number().int().min(1).max(365),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  monthDay: z.number().int().min(1).max(31),
  until: date.nullable(),
});
export const taskSchema = z
  .object({
    id,
    title,
    status: z.enum(statuses),
    notes: z.string().max(50000),
    priority: z.number().int().min(0).max(3),
    projectId: id.nullable(),
    tags: z.array(id).max(100),
    startDate: date.nullable(),
    dueDate: date.nullable(),
    reminderAt: timestamp.nullable(),
    notifiedAt: timestamp.nullable(),
    recurrence: recurrenceSchema.nullable(),
    subtasks: z.array(z.object({ id, title, done: z.boolean() })).max(500),
    attachments: z
      .array(
        z.object({
          id,
          name: z.string().min(1).max(160),
          data: z.string().max(14000000),
          size: z.number().int().min(0).max(10485760),
        }),
      )
      .max(20),
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: timestamp.nullable(),
    archived: z.boolean(),
    seriesId: id.nullable(),
  })
  .refine(
    (t) => !t.startDate || !t.dueDate || t.startDate <= t.dueDate,
    'A data de início deve preceder o prazo.',
  )
  .refine((t) => !t.recurrence || !!t.dueDate, 'Uma tarefa recorrente precisa de prazo.')
  .refine(
    (t) => (t.status === 'completed') === (t.completedAt !== null),
    'Conclusão inconsistente.',
  );
export const filterSchema = z
  .object({
    query: z.string().max(500),
    status: z.string().max(30),
    projectId: z.string().max(100),
    tagId: z.string().max(100),
    priority: z.string().max(1),
    dateField: z.enum(['dueDate', 'startDate']).default('dueDate'),
    dateFrom: z.union([date, z.literal('')]).default(''),
    dateTo: z.union([date, z.literal('')]).default(''),
  })
  .refine(
    (f) => !f.dateFrom || !f.dateTo || f.dateFrom <= f.dateTo,
    'A data inicial do filtro deve preceder a final.',
  );
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    tasks: z.array(taskSchema).max(20000),
    projects: z
      .array(z.object({ id, name: title, color: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
      .max(1000),
    tags: z.array(z.object({ id, name: title })).max(1000),
    habits: z
      .array(
        z.object({
          id,
          title,
          weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
          logs: z.array(date).max(100000),
          createdAt: timestamp,
        }),
      )
      .max(1000),
    filters: z.array(z.object({ id, name: title, criteria: filterSchema })).max(100),
    sessions: z
      .array(
        z.object({
          id,
          taskId: id.nullable(),
          title: z.string().max(240),
          seconds: z.number().int().min(1).max(86400),
          endedAt: timestamp,
        }),
      )
      .max(100000),
    settings: z.object({
      theme: z.enum(['light', 'dark']),
      notifications: z.boolean(),
      focusMinutes: z.number().int().min(1).max(180),
    }),
    timer: z
      .object({
        taskId: id.nullable(),
        endAt: timestamp.nullable(),
        remaining: z.number().int().min(0).max(10800),
        duration: z.number().int().min(60).max(10800),
      })
      .refine((t) => t.remaining <= t.duration, 'Tempo restante inválido.')
      .nullable(),
  })
  .superRefine((w, ctx) => {
    for (const key of ['tasks', 'projects', 'tags', 'habits', 'filters', 'sessions'] as const) {
      if (new Set(w[key].map((x) => x.id)).size !== w[key].length)
        ctx.addIssue({ code: 'custom', message: `IDs duplicados em ${key}.` });
    }
    for (const task of w.tasks) {
      if (task.projectId && !w.projects.some((p) => p.id === task.projectId))
        ctx.addIssue({ code: 'custom', message: 'Projeto inexistente.' });
      if (task.tags.some((t) => !w.tags.some((tag) => tag.id === t)))
        ctx.addIssue({ code: 'custom', message: 'Tag inexistente.' });
    }
  });
export type Task = z.infer<typeof taskSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type Filters = z.infer<typeof filterSchema>;
export const emptyFilters: Filters = {
  query: '',
  status: '',
  projectId: '',
  tagId: '',
  priority: '',
  dateField: 'dueDate',
  dateFrom: '',
  dateTo: '',
};
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const parseDate = (s: string) => new Date(`${s}T12:00:00`);
export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function emptyWorkspace(): Workspace {
  return {
    version: 1,
    tasks: [],
    projects: [],
    tags: [],
    habits: [],
    filters: [],
    sessions: [],
    settings: { theme: 'light', notifications: false, focusMinutes: 25 },
    timer: null,
  };
}
export function newTask(title = '', status: TaskStatus = 'inbox'): Task {
  return {
    id: uid(),
    title,
    status,
    notes: '',
    priority: 0,
    projectId: null,
    tags: [],
    startDate: null,
    dueDate: null,
    reminderAt: null,
    notifiedAt: null,
    recurrence: null,
    subtasks: [],
    attachments: [],
    createdAt: now(),
    updatedAt: now(),
    completedAt: status === 'completed' ? now() : null,
    archived: false,
    seriesId: null,
  };
}
export const safeName = (name: string) =>
  name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 150) || 'anexo';
export const prettyDate = (s: string) =>
  parseDate(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
export function timerRemaining(
  timer: Workspace['timer'],
  fallback: number,
  instant = Date.now(),
): number {
  if (!timer) return fallback;
  return timer.endAt
    ? Math.min(timer.duration, Math.max(0, Math.ceil((Date.parse(timer.endAt) - instant) / 1000)))
    : timer.remaining;
}

// Date-only arithmetic at local noon avoids UTC date shifts and DST midnight gaps.
// Monthly rules retain the original day (Jan 31 → Feb 28 → Mar 31).
export function nextOccurrence(current: string, rule: Recurrence): string | null {
  recurrenceSchema.parse(rule);
  date.parse(current);
  let next: string;
  if (rule.unit === 'day') next = addDays(current, rule.interval);
  else if (rule.unit === 'month') {
    const d = parseDate(current);
    d.setDate(1);
    d.setMonth(d.getMonth() + rule.interval);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(rule.monthDay, last));
    next = localDate(d);
  } else {
    const currentDay = parseDate(current).getDay();
    const weekdays = rule.weekdays.length ? rule.weekdays : [currentDay];
    const offset = (currentDay + 6) % 7;
    let found = '';
    for (let n = 1; n <= rule.interval * 7 + 7; n++) {
      const candidate = addDays(current, n);
      const weeks = Math.floor((offset + n) / 7);
      if (weeks % rule.interval === 0 && weekdays.includes(parseDate(candidate).getDay())) {
        found = candidate;
        break;
      }
    }
    if (!found) throw new Error('Não foi possível calcular a próxima ocorrência.');
    next = found;
  }
  return rule.until && next > rule.until ? null : next;
}
export function completeTask(w: Workspace, id: string): Workspace {
  const result = structuredClone(w);
  const task = result.tasks.find((t) => t.id === id);
  if (!task || task.status === 'completed') return result;
  task.status = 'completed';
  task.completedAt = now();
  task.updatedAt = now();
  if (task.recurrence && task.dueDate) {
    const next = nextOccurrence(task.dueDate, task.recurrence);
    if (next) {
      const seriesId = task.seriesId || task.id;
      task.seriesId = seriesId;
      if (!result.tasks.some((t) => t.seriesId === seriesId && t.dueDate === next)) {
        const copy: Task = {
          ...structuredClone(task),
          id: uid(),
          seriesId,
          status: 'pending',
          dueDate: next,
          completedAt: null,
          createdAt: now(),
          updatedAt: now(),
          archived: false,
          notifiedAt: null,
          subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
        };
        const days = Math.round(
          (parseDate(next).getTime() - parseDate(task.dueDate).getTime()) / 86400000,
        );
        if (task.startDate) copy.startDate = addDays(task.startDate, days);
        if (task.reminderAt) {
          const d = new Date(task.reminderAt);
          d.setDate(d.getDate() + days);
          copy.reminderAt = d.toISOString();
        }
        result.tasks.unshift(copy);
      }
    }
  }
  return result;
}
export function selectTasks(
  w: Workspace,
  view: string,
  filters: Filters,
  today = localDate(),
): Task[] {
  const q = filters.query.toLocaleLowerCase('pt-BR');
  return w.tasks
    .filter((t) => {
      if (view === 'archive' ? !t.archived : t.archived) return false;
      if (
        view === 'today' &&
        (t.status === 'completed' ||
          !((t.dueDate && t.dueDate <= today) || (t.startDate && t.startDate <= today)))
      )
        return false;
      if (
        view === 'upcoming' &&
        (t.status === 'completed' ||
          !((t.dueDate && t.dueDate > today) || (t.startDate && t.startDate > today)))
      )
        return false;
      if (statuses.includes(view as TaskStatus) && t.status !== view) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && String(t.priority) !== filters.priority) return false;
      if (filters.projectId && t.projectId !== filters.projectId) return false;
      if (filters.tagId && !t.tags.includes(filters.tagId)) return false;
      if (filters.dateFrom || filters.dateTo) {
        const value = t[filters.dateField];
        if (
          !value ||
          (filters.dateFrom && value < filters.dateFrom) ||
          (filters.dateTo && value > filters.dateTo)
        )
          return false;
      }
      return `${t.title} ${t.notes} ${t.subtasks.map((s) => s.title).join(' ')} ${w.tags
        .filter((tag) => t.tags.includes(tag.id))
        .map((tag) => tag.name)
        .join(' ')}`
        .toLocaleLowerCase('pt-BR')
        .includes(q);
    })
    .sort(
      (a, b) =>
        Number(a.status === 'completed') - Number(b.status === 'completed') ||
        b.priority - a.priority ||
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
        b.createdAt.localeCompare(a.createdAt),
    );
}
