import { describe, expect, it } from 'vitest';
import {
  addDays,
  completeTask,
  emptyFilters,
  filterSchema,
  emptyWorkspace,
  newTask,
  nextOccurrence,
  safeName,
  selectTasks,
  timerRemaining,
  workspaceSchema,
  type Recurrence,
} from '../src/domain/task';
const rule = (patch: Partial<Recurrence> = {}): Recurrence => ({
  unit: 'day',
  interval: 1,
  weekdays: [],
  monthDay: 31,
  until: null,
  ...patch,
});
describe('recorrência em datas locais', () => {
  it.each([
    ['2026-12-31', '2027-01-01'],
    ['2024-02-28', '2024-02-29'],
    ['2025-02-28', '2025-03-01'],
  ])('diária %s → %s', (start, end) => expect(nextOccurrence(start, rule())).toBe(end));
  it('aceita intervalos diários personalizados', () =>
    expect(nextOccurrence('2026-10-06', rule({ interval: 3 }))).toBe('2026-10-09'));
  it('preserva a âncora mensal ao atravessar fevereiro', () => {
    const r = rule({ unit: 'month' });
    expect(nextOccurrence('2026-01-31', r)).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', r)).toBe('2026-03-31');
  });
  it('respeita ano bissexto e intervalo mensal', () => {
    expect(nextOccurrence('2024-01-31', rule({ unit: 'month' }))).toBe('2024-02-29');
    expect(nextOccurrence('2026-11-30', rule({ unit: 'month', interval: 3, monthDay: 30 }))).toBe(
      '2027-02-28',
    );
  });
  it('repete semanalmente no mesmo dia sem seleção explícita', () =>
    expect(nextOccurrence('2026-10-06', rule({ unit: 'week' }))).toBe('2026-10-13'));
  it('seleciona dias dentro da semana e atravessa o domingo', () => {
    const r = rule({ unit: 'week', weekdays: [1, 3, 5] });
    expect(nextOccurrence('2026-10-05', r)).toBe('2026-10-07');
    expect(nextOccurrence('2026-10-09', r)).toBe('2026-10-12');
  });
  it('mantém semanas alternadas após múltiplas ocorrências', () => {
    const r = rule({ unit: 'week', interval: 2, weekdays: [1, 3] });
    expect(nextOccurrence('2026-10-05', r)).toBe('2026-10-07');
    expect(nextOccurrence('2026-10-07', r)).toBe('2026-10-19');
  });
  it('limite final é inclusivo', () => {
    expect(nextOccurrence('2026-10-06', rule({ until: '2026-10-07' }))).toBe('2026-10-07');
    expect(nextOccurrence('2026-10-07', rule({ until: '2026-10-07' }))).toBeNull();
  });
  it('rejeita intervalos inválidos e datas impossíveis', () => {
    expect(() => nextOccurrence('2026-02-30', rule())).toThrow();
    expect(() => nextOccurrence('2026-02-28', rule({ interval: 0 }))).toThrow();
  });
  it('não desloca a data em transições de horário de verão', () =>
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09'));
});
describe('transformações e validação', () => {
  it('conclui, mantém histórico e gera a próxima ocorrência uma única vez', () => {
    const w = emptyWorkspace();
    const task = {
      ...newTask('Mensal'),
      dueDate: '2026-01-31',
      startDate: '2026-01-30',
      recurrence: rule({ unit: 'month' }),
      subtasks: [{ id: 'sub-1', title: 'Parte', done: true }],
    };
    w.tasks = [task];
    const next = completeTask(w, task.id);
    expect(w.tasks).toHaveLength(1);
    expect(next.tasks).toHaveLength(2);
    expect(next.tasks[0].dueDate).toBe('2026-02-28');
    expect(next.tasks[0].startDate).toBe('2026-02-27');
    expect(next.tasks[0].subtasks[0].done).toBe(false);
    expect(next.tasks[1].completedAt).not.toBeNull();
    expect(completeTask(next, task.id).tasks).toHaveLength(2);
    const reopened = structuredClone(next);
    reopened.tasks[1].status = 'pending';
    reopened.tasks[1].completedAt = null;
    expect(completeTask(reopened, task.id).tasks).toHaveLength(2);
  });
  it('inclui atrasadas em Hoje, futuras em Próximas e separa o arquivo', () => {
    const w = emptyWorkspace();
    w.tasks = [
      { ...newTask('Atrasada'), dueDate: '2026-10-01' },
      { ...newTask('Futura'), startDate: '2026-10-10' },
      { ...newTask('Arquivada', 'completed'), archived: true },
    ];
    expect(selectTasks(w, 'today', emptyFilters, '2026-10-06').map((t) => t.title)).toEqual([
      'Atrasada',
    ]);
    expect(selectTasks(w, 'upcoming', emptyFilters, '2026-10-06').map((t) => t.title)).toEqual([
      'Futura',
    ]);
    expect(selectTasks(w, 'archive', emptyFilters)).toHaveLength(1);
  });
  it('exportação e importação preservam anexos e registros', () => {
    const w = emptyWorkspace();
    w.tasks = [
      { ...newTask('Anexo'), attachments: [{ id: 'a', name: 'nota.txt', size: 3, data: 'YWJj' }] },
    ];
    expect(workspaceSchema.parse(JSON.parse(JSON.stringify(w)))).toEqual(w);
  });
  it('rejeita versão, IDs duplicados, título vazio e referência ausente', () => {
    const w = emptyWorkspace();
    expect(workspaceSchema.safeParse({ ...w, version: 2 }).success).toBe(false);
    const t = newTask('');
    expect(workspaceSchema.safeParse({ ...w, tasks: [t] }).success).toBe(false);
    t.title = 'Ok';
    expect(workspaceSchema.safeParse({ ...w, tasks: [t, t] }).success).toBe(false);
    expect(
      workspaceSchema.safeParse({ ...w, tasks: [{ ...t, projectId: 'missing' }] }).success,
    ).toBe(false);
  });
  it('sanitiza nomes de anexos', () =>
    expect(safeName('../uma:nota?.txt')).toBe('.._uma_nota_.txt'));
});

describe('timer persistido', () => {
  it('limita um tick anterior ao início à duração da sessão', () => {
    const instant = Date.now();
    const timer = {
      taskId: null,
      endAt: new Date(instant + 1500000).toISOString(),
      remaining: 1500,
      duration: 1500,
    };
    expect(timerRemaining(timer, 1500, instant - 999)).toBe(1500);
    expect(timerRemaining(timer, 1500, instant + 30000)).toBe(1470);
    expect(timerRemaining(timer, 1500, instant + 1600000)).toBe(0);
  });
  it('mantém o restante ao pausar e rejeita exceder a duração', () => {
    expect(
      timerRemaining({ taskId: null, endAt: null, remaining: 900, duration: 1500 }, 1500),
    ).toBe(900);
    expect(
      workspaceSchema.safeParse({
        ...emptyWorkspace(),
        timer: { taskId: null, endAt: null, remaining: 1501, duration: 1500 },
      }).success,
    ).toBe(false);
  });
});

describe('filtros de datas locais', () => {
  const w = emptyWorkspace();
  w.tasks = [
    { ...newTask('Antes'), dueDate: '2026-10-05', startDate: '2026-10-01' },
    { ...newTask('Primeiro dia'), dueDate: '2026-10-06', startDate: '2026-10-02' },
    { ...newTask('Último dia'), dueDate: '2026-10-10', startDate: '2026-10-06' },
    { ...newTask('Depois'), dueDate: '2026-10-11', startDate: null },
    newTask('Sem data'),
  ];
  it('inclui as duas bordas e exclui tarefas sem prazo', () => {
    expect(
      selectTasks(w, 'all', { ...emptyFilters, dateFrom: '2026-10-06', dateTo: '2026-10-10' }).map(
        (t) => t.title,
      ),
    ).toEqual(['Primeiro dia', 'Último dia']);
  });
  it('aceita limites abertos e o mesmo dia nas duas bordas', () => {
    expect(selectTasks(w, 'all', { ...emptyFilters, dateTo: '2026-10-06' })).toHaveLength(2);
    expect(selectTasks(w, 'all', { ...emptyFilters, dateFrom: '2026-10-10' })).toHaveLength(2);
    expect(
      selectTasks(w, 'all', { ...emptyFilters, dateFrom: '2026-10-06', dateTo: '2026-10-06' }),
    ).toHaveLength(1);
    expect(selectTasks(w, 'all', emptyFilters)).toHaveLength(5);
  });
  it('filtra início independentemente do prazo e combina com busca', () => {
    expect(
      selectTasks(w, 'all', {
        ...emptyFilters,
        dateField: 'startDate',
        dateFrom: '2026-10-06',
        dateTo: '2026-10-06',
        query: 'último',
      }).map((t) => t.title),
    ).toEqual(['Último dia']);
  });
  it('normaliza filtros antigos sem restringir datas', () => {
    expect(
      filterSchema.parse({ query: '', status: '', projectId: '', tagId: '', priority: '' }),
    ).toEqual(emptyFilters);
  });
  it('rejeita datas inexistentes e intervalos invertidos', () => {
    expect(filterSchema.safeParse({ ...emptyFilters, dateFrom: '2026-02-30' }).success).toBe(false);
    expect(
      filterSchema.safeParse({ ...emptyFilters, dateFrom: '2026-10-10', dateTo: '2026-10-06' })
        .success,
    ).toBe(false);
  });
});
