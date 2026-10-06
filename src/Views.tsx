import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Trash2,
  Download,
  Upload,
  Database,
  ShieldCheck,
  Bell,
  FolderOpen,
  Tag,
  Play,
  Pause,
  RotateCcw,
  Target,
} from 'lucide-react';
import {
  type Workspace,
  type Task,
  localDate,
  addDays,
  parseDate,
  prettyDate,
  uid,
  now,
  workspaceSchema,
  timerRemaining,
} from './domain/task';
import { Empty, Dialog } from './components';
import { backupWorkspace, desktop, exportWorkspace, notify } from './lib/storage';
export type Mutate = (
  fn: (w: Workspace) => Workspace,
  message?: string,
  importing?: boolean,
) => Promise<boolean>;
export function CalendarView({
  w,
  onEdit,
  onNew,
}: {
  w: Workspace;
  onEdit: (t: Task) => void;
  onNew: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return localDate(d);
  });
  const d = parseDate(month);
  const first = addDays(month, -(d.getDay() + 6) % 7);
  const today = localDate();
  const shift = (n: number) => {
    const next = parseDate(month);
    next.setMonth(next.getMonth() + n);
    setMonth(localDate(next));
  };
  return (
    <section className="calendar">
      <div className="calendar-toolbar">
        <h2>{d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
        <div>
          <button className="secondary" onClick={() => setMonth(`${today.slice(0, 7)}-01`)}>
            Hoje
          </button>
          <button className="icon-button" aria-label="Mês anterior" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button className="icon-button" aria-label="Próximo mês" onClick={() => shift(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((s) => (
          <div key={s} className="weekday-heading">
            {s}
          </div>
        ))}
        {Array.from({ length: 42 }, (_, i) => addDays(first, i)).map((day) => (
          <div
            key={day}
            className={`calendar-day ${day.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''}`}
          >
            <button
              aria-label={`Nova tarefa em ${day}`}
              className={`day-number ${day === today ? 'today' : ''}`}
              onClick={() => onNew(day)}
            >
              {parseDate(day).getDate()}
            </button>
            {w.tasks
              .filter(
                (t) => !t.archived && (t.dueDate === day || (!t.dueDate && t.startDate === day)),
              )
              .map((t) => (
                <button
                  className={`calendar-task ${t.status === 'completed' ? 'done' : ''}`}
                  key={t.id}
                  onClick={() => onEdit(t)}
                >
                  <span className={`status-dot ${t.status}`} />
                  {t.title}
                </button>
              ))}
          </div>
        ))}
      </div>
      <p className="hint">
        Clique em um dia para criar uma tarefa. O calendário mostra o prazo, ou o início quando não
        há prazo. Próximas recorrências aparecem após a conclusão atual.
      </p>
    </section>
  );
}
export function HabitsView({ w, mutate }: { w: Workspace; mutate: Mutate }) {
  const [title, setTitle] = useState('');
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [week, setWeek] = useState(0);
  const today = localDate();
  const start = addDays(today, -6 + week * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <>
      <div className="panel habit-create">
        <div>
          <h2>Pequenos passos. Todos os dias.</h2>
          <p className="muted">Construa uma rotina que funciona para você.</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim() || !days.length) return;
            if (
              await mutate(
                (s) => ({
                  ...s,
                  habits: [
                    ...s.habits,
                    { id: uid(), title: title.trim(), weekdays: days, logs: [], createdAt: now() },
                  ],
                }),
                'Hábito criado.',
              )
            )
              setTitle('');
          }}
        >
          <div className="inline-form">
            <input
              aria-label="Nome do hábito"
              placeholder="Ex.: Ler por 20 minutos"
              value={title}
              maxLength={240}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
            <button className="primary" disabled={!title.trim() || !days.length}>
              <Plus size={16} />
              Criar hábito
            </button>
          </div>
          <div className="weekdays">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((s, i) => (
              <button
                type="button"
                key={i}
                aria-pressed={days.includes(i)}
                className={days.includes(i) ? 'selected' : ''}
                onClick={() =>
                  setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])
                }
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      </div>
      <div className="section-heading">
        <h2>Seu acompanhamento</h2>
        <div className="inline-form">
          <button
            className="icon-button"
            aria-label="Semana anterior"
            onClick={() => setWeek(week - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="muted">
            {prettyDate(start)} — {prettyDate(dates[6])}
          </span>
          <button
            className="icon-button"
            aria-label="Próxima semana"
            disabled={week === 0}
            onClick={() => setWeek(week + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {!w.habits.length ? (
        <Empty
          title="Uma rotina começa com um hábito"
          text="Adicione seu primeiro hábito e acompanhe sua consistência aqui."
        />
      ) : (
        <div className="habit-table">
          <div className="habit-row heading">
            <span>Hábito</span>
            {dates.map((d) => (
              <span key={d}>
                {parseDate(d).toLocaleDateString('pt-BR', { weekday: 'short' })}
                <small>{parseDate(d).getDate()}</small>
              </span>
            ))}
            <span />
          </div>
          {w.habits.map((h) => (
            <div className="habit-row" key={h.id}>
              <div>
                <strong>{h.title}</strong>
                <small>{h.logs.length} registros no histórico</small>
              </div>
              {dates.map((day) => {
                const enabled =
                  h.weekdays.includes(parseDate(day).getDay()) &&
                  day <= today &&
                  day >= localDate(new Date(h.createdAt));
                return (
                  <button
                    key={day}
                    aria-label={`${h.title}, ${day}`}
                    aria-pressed={h.logs.includes(day)}
                    disabled={!enabled}
                    className={`habit-check ${h.logs.includes(day) ? 'checked' : ''}`}
                    onClick={() =>
                      mutate(
                        (s) => ({
                          ...s,
                          habits: s.habits.map((x) =>
                            x.id === h.id
                              ? {
                                  ...x,
                                  logs: x.logs.includes(day)
                                    ? x.logs.filter((d) => d !== day)
                                    : [...x.logs, day],
                                }
                              : x,
                          ),
                        }),
                        'Hábito atualizado.',
                      )
                    }
                  >
                    {h.logs.includes(day) ? <Check size={16} /> : enabled ? '·' : '—'}
                  </button>
                );
              })}
              <button
                className="icon-button"
                aria-label={`Excluir hábito ${h.title}`}
                onClick={() =>
                  mutate(
                    (s) => ({ ...s, habits: s.habits.filter((x) => x.id !== h.id) }),
                    'Hábito excluído.',
                  )
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
export function FocusView({ w, mutate, tick }: { w: Workspace; mutate: Mutate; tick: number }) {
  const timer = w.timer;
  const remaining = timerRemaining(timer, w.settings.focusMinutes * 60, tick);
  const duration = timer?.duration ?? w.settings.focusMinutes * 60;
  const task = w.tasks.find((t) => t.id === timer?.taskId);
  const today = localDate();
  const sessions = w.sessions.filter((s) => localDate(new Date(s.endedAt)) === today);
  const running = !!timer?.endAt;
  return (
    <div className="focus-layout">
      <div className="panel focus-panel">
        <span className="eyebrow">
          <span className="violet-dot" /> UM PASSO DE CADA VEZ
        </span>
        <h2>Hora de se concentrar.</h2>
        <p className="muted">Escolha uma tarefa. Dê espaço ao que importa.</p>
        <select
          aria-label="Tarefa em foco"
          disabled={running}
          value={timer?.taskId || ''}
          onChange={(e) =>
            mutate(
              (s) => ({
                ...s,
                timer: {
                  taskId: e.target.value || null,
                  endAt: null,
                  remaining: duration,
                  duration,
                },
              }),
              'Tarefa de foco selecionada.',
            )
          }
        >
          <option value="">Sessão livre</option>
          {w.tasks
            .filter((t) => t.status !== 'completed' && !t.archived)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
        </select>
        <div
          className="timer-ring"
          style={{ '--progress': `${100 * (1 - remaining / duration)}%` } as React.CSSProperties}
        >
          <div>
            <span className="timer-digits">
              {String(Math.floor(remaining / 60)).padStart(2, '0')}
              <span>:</span>
              {String(remaining % 60).padStart(2, '0')}
            </span>
            <span className="timer-caption">
              {running ? 'MANTENHA O FOCO' : 'SEU TEMPO, SUA ATENÇÃO'}
            </span>
          </div>
        </div>
        <div className="focus-controls">
          <button
            className="secondary"
            aria-label="Reiniciar timer"
            onClick={() =>
              mutate(
                (s) => ({
                  ...s,
                  timer: {
                    taskId: timer?.taskId || null,
                    endAt: null,
                    remaining: duration,
                    duration,
                  },
                }),
                'Timer reiniciado.',
              )
            }
          >
            <RotateCcw size={18} />
          </button>
          <button
            className="primary"
            onClick={() =>
              mutate(
                (s) => ({
                  ...s,
                  timer: {
                    taskId: timer?.taskId || null,
                    endAt: running
                      ? null
                      : new Date(Date.now() + (remaining || duration) * 1000).toISOString(),
                    remaining: running ? timerRemaining(timer, duration) : remaining || duration,
                    duration,
                  },
                }),
                running ? 'Sessão pausada.' : 'Foco iniciado.',
              )
            }
          >
            {running ? <Pause size={18} /> : <Play size={18} />}{' '}
            {running ? 'Pausar' : 'Iniciar foco'}
          </button>
        </div>
        <div className="duration-options">
          {[15, 25, 45, 60].map((n) => (
            <button
              disabled={running}
              key={n}
              className={duration === n * 60 ? 'selected' : ''}
              onClick={() =>
                mutate(
                  (s) => ({
                    ...s,
                    settings: { ...s.settings, focusMinutes: n },
                    timer: {
                      taskId: timer?.taskId || null,
                      endAt: null,
                      remaining: n * 60,
                      duration: n * 60,
                    },
                  }),
                  'Duração atualizada.',
                )
              }
            >
              {n} min
            </button>
          ))}
        </div>
        <p className="hint">{task ? `Em foco: ${task.title}` : 'Sem pressa. Uma coisa por vez.'}</p>
      </div>
      <aside>
        <div className="panel focus-summary">
          <Target size={23} className="violet" />
          <h3>Seu foco hoje</h3>
          <strong>
            {Math.round(sessions.reduce((n, s) => n + s.seconds, 0) / 60)} <small>min</small>
          </strong>
          <p>{sessions.length} sessões concluídas</p>
        </div>
        <div className="panel session-list">
          <h3>Histórico de sessões</h3>
          {w.sessions.length ? (
            w.sessions
              .slice()
              .reverse()
              .slice(0, 30)
              .map((s) => (
                <div key={s.id}>
                  <span>
                    {s.title || 'Sessão livre'}
                    <small>{new Date(s.endedAt).toLocaleString('pt-BR')}</small>
                  </span>
                  <b>{Math.round(s.seconds / 60)}m</b>
                </div>
              ))
          ) : (
            <p className="hint">Sua primeira sessão completa aparecerá aqui.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
export function SettingsView({
  w,
  mutate,
  path,
  report,
}: {
  w: Workspace;
  mutate: Mutate;
  path: string;
  report: (message: string, error?: boolean) => void;
}) {
  const [project, setProject] = useState('');
  const [tag, setTag] = useState('');
  const [incoming, setIncoming] = useState<Workspace | null>(null);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 52428800) throw new Error('Arquivo maior que 50 MB.');
      const data = workspaceSchema.parse(JSON.parse(await file.text()));
      setIncoming(data);
    } catch (e) {
      report(`Importação recusada: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>
          <ShieldCheck size={20} /> Seu espaço, seus dados
        </h2>
        <p className="muted">Tudo fica neste computador. Sem conta, sem rastreamento.</p>
        <div className="data-path">
          <Database size={18} />
          <code>{path}</code>
        </div>
        <div className="settings-actions">
          <button
            className="secondary"
            onClick={async () => {
              try {
                const result = await exportWorkspace(w);
                if (result) report(`Exportação salva em ${result}`);
              } catch (e) {
                report(String(e), true);
              }
            }}
          >
            <Download size={16} />
            Exportar JSON
          </button>
          <label className="secondary upload-button">
            <Upload size={16} />
            Importar JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="secondary"
            disabled={!desktop}
            onClick={async () => {
              try {
                report(`Backup criado: ${await backupWorkspace()}`);
              } catch (e) {
                report(String(e), true);
              }
            }}
          >
            <Database size={16} />
            Criar backup
          </button>
        </div>
        <p className="hint">
          No desktop, um backup diário é feito ao abrir e antes das alterações. Os 30 backups
          diários mais recentes são mantidos. Backups manuais e anteriores à importação são
          preservados.
        </p>
      </section>
      <section className="panel">
        <h2>
          <Bell size={20} /> Preferências
        </h2>
        <div className="preference">
          <div>
            <strong>Tema escuro</strong>
            <p className="hint">Menos luz, a mesma clareza.</p>
          </div>
          <input
            aria-label="Tema escuro"
            type="checkbox"
            checked={w.settings.theme === 'dark'}
            onChange={(e) =>
              mutate(
                (s) => ({
                  ...s,
                  settings: { ...s.settings, theme: e.target.checked ? 'dark' : 'light' },
                }),
                'Tema atualizado.',
              )
            }
          />
        </div>
        <div className="preference">
          <div>
            <strong>Notificações desktop</strong>
            <p className="hint">Lembretes e término das sessões de foco.</p>
          </div>
          <input
            aria-label="Notificações desktop"
            type="checkbox"
            checked={w.settings.notifications}
            onChange={async (e) => {
              const enabled = e.target.checked;
              try {
                if (enabled && !(await notify('Chrono', 'Notificações ativadas.', true))) {
                  report(
                    'Notificações indisponíveis ou permissão negada. Os alertas internos continuam ativos.',
                    true,
                  );
                  return;
                }
                await mutate(
                  (s) => ({ ...s, settings: { ...s.settings, notifications: enabled } }),
                  'Preferência salva.',
                );
              } catch (e) {
                report(String(e), true);
              }
            }}
          />
        </div>
        <p className="hint">
          Mantenha o aplicativo aberto para receber lembretes. Ao reabrir, lembretes vencidos são
          recuperados. No Windows, notificações nativas devem ser verificadas na versão instalada.
        </p>
      </section>
      <section className="panel">
        <h2>
          <FolderOpen size={20} /> Projetos
        </h2>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              project.trim() &&
              (await mutate(
                (s) => ({
                  ...s,
                  projects: [...s.projects, { id: uid(), name: project.trim(), color: '#7c3aed' }],
                }),
                'Projeto criado.',
              ))
            )
              setProject('');
          }}
        >
          <input
            placeholder="Nome do projeto"
            aria-label="Nome do projeto"
            maxLength={240}
            required
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <button className="primary" aria-label="Criar projeto">
            <Plus size={16} />
          </button>
        </form>
        {w.projects.map((p) => (
          <div className="management-row" key={p.id}>
            <span>
              <span className="violet-dot" />
              {p.name}
            </span>
            <button
              className="icon-button"
              aria-label={`Excluir projeto ${p.name}`}
              onClick={() =>
                mutate(
                  (s) => ({
                    ...s,
                    projects: s.projects.filter((x) => x.id !== p.id),
                    tasks: s.tasks.map((t) =>
                      t.projectId === p.id ? { ...t, projectId: null } : t,
                    ),
                  }),
                  'Projeto removido; tarefas preservadas.',
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>
          <Tag size={20} /> Tags
        </h2>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              tag.trim() &&
              (await mutate(
                (s) => ({ ...s, tags: [...s.tags, { id: uid(), name: tag.trim() }] }),
                'Tag criada.',
              ))
            )
              setTag('');
          }}
        >
          <input
            placeholder="Nome da tag"
            aria-label="Nome da tag"
            maxLength={240}
            required
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
          <button className="primary" aria-label="Criar tag">
            <Plus size={16} />
          </button>
        </form>
        {w.tags.map((t) => (
          <div className="management-row" key={t.id}>
            <span>#{t.name}</span>
            <button
              className="icon-button"
              aria-label={`Excluir tag ${t.name}`}
              onClick={() =>
                mutate(
                  (s) => ({
                    ...s,
                    tags: s.tags.filter((x) => x.id !== t.id),
                    tasks: s.tasks.map((task) => ({
                      ...task,
                      tags: task.tags.filter((x) => x !== t.id),
                    })),
                  }),
                  'Tag removida.',
                )
              }
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </section>
      {!!w.filters.length && (
        <section className="panel">
          <h2>Filtros salvos</h2>
          {w.filters.map((f) => (
            <div className="management-row" key={f.id}>
              <span>{f.name}</span>
              <button
                className="icon-button"
                aria-label={`Excluir filtro ${f.name}`}
                onClick={() =>
                  mutate(
                    (s) => ({ ...s, filters: s.filters.filter((x) => x.id !== f.id) }),
                    'Filtro excluído.',
                  )
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </section>
      )}
      {incoming && (
        <Dialog title="Importar workspace" onClose={() => setIncoming(null)}>
          <div className="dialog-body">
            <p>
              O arquivo contém <strong>{incoming.tasks.length} tarefas</strong>,{' '}
              {incoming.habits.length} hábitos e {incoming.projects.length} projetos.
            </p>
            <p>
              A importação substituirá os dados atuais. No desktop, um backup será criado antes da
              troca. Você também poderá desfazer.
            </p>
            <div className="settings-actions">
              <button className="secondary" onClick={() => setIncoming(null)}>
                Cancelar
              </button>
              <button
                className="primary"
                onClick={async () => {
                  if (
                    await mutate(
                      () => ({
                        ...incoming,
                        timer: incoming.timer ? { ...incoming.timer, endAt: null } : null,
                      }),
                      'Importação concluída.',
                      true,
                    )
                  )
                    setIncoming(null);
                }}
              >
                Confirmar importação
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
