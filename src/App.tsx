import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Clock3,
  Mic,
  Plus,
  Search,
  LayoutGrid,
  Inbox,
  Sun,
  CalendarDays,
  CircleDashed,
  Circle,
  CircleCheck,
  Archive,
  Timer,
  Sprout,
  Settings,
  Moon,
  List,
  Columns3,
  SlidersHorizontal,
  ArrowUpRight,
  Folder,
  Hash,
  Bookmark,
  Undo2,
  Menu,
  X,
  Trash2,
  Pencil,
  Repeat2,
  Flag,
  Paperclip,
  CheckCheck,
  RefreshCw,
  ChevronRight,
  Command,
} from 'lucide-react';
import {
  type Task,
  type TaskStatus,
  type Filters,
  statuses,
  statusLabels,
  newTask,
  emptyWorkspace,
  emptyFilters,
  selectTasks,
  completeTask,
  localDate,
  prettyDate,
  now,
  uid,
} from './domain/task';
import {
  loadWorkspace,
  saveWorkspace,
  undoWorkspace,
  desktop,
  notify,
  type Loaded,
} from './lib/storage';
import { TaskEditor } from './TaskEditor';
import { VoiceCapture } from './VoiceCapture';
import { CalendarView, HabitsView, FocusView, SettingsView, type Mutate } from './Views';
import { Dialog, Empty } from './components';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/500.css';
import './App.css';
const navigation = [
  { id: 'all', label: 'Todas as tarefas', icon: LayoutGrid },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'today', label: 'Hoje', icon: Sun },
  { id: 'upcoming', label: 'Próximas', icon: CalendarDays },
  { id: 'pending', label: 'Pendentes', icon: CircleDashed },
  { id: 'progress', label: 'Em progresso', icon: Circle },
  { id: 'someday', label: 'Algum dia', icon: Clock3 },
  { id: 'completed', label: 'Concluídas', icon: CircleCheck },
];
const tools = [
  { id: 'calendar', label: 'Calendário', icon: CalendarDays },
  { id: 'habits', label: 'Hábitos', icon: Sprout },
  { id: 'focus', label: 'Foco', icon: Timer },
];
const subtitles: Record<string, string> = {
  all: 'Um lugar para organizar tudo o que importa.',
  inbox: 'Capture agora. Organize quando estiver pronto.',
  today: 'Menos distrações. Mais espaço para o que importa hoje.',
  upcoming: 'Prepare os próximos passos, no seu ritmo.',
  pending: 'Tudo pronto para dar o primeiro passo.',
  progress: 'Seu trabalho está em movimento.',
  someday: 'Boas ideias também precisam de um lugar.',
  completed: 'Cada conclusão é um passo à frente.',
  archive: 'Seu histórico, sempre por perto.',
  calendar: 'Encontre espaço para suas prioridades.',
  habits: 'Consistência começa com pequenas ações.',
  focus: 'Uma tarefa. Sua atenção inteira.',
  settings: 'Deixe o Chrono do seu jeito.',
};
export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = useRef<Loaded | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [view, setView] = useState('all');
  const [viewName, setViewName] = useState('');
  const [mode, setMode] = useState<'list' | 'board'>('list');
  const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
  const [showFilters, setShowFilters] = useState(false);
  const [editor, setEditor] = useState<{ task: Task; isNew: boolean } | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [palette, setPalette] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [saveFilter, setSaveFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [quick, setQuick] = useState('');
  const [voice, setVoice] = useState<{ projectId: string | null } | null>(null);
  const [tick, setTick] = useState(Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const quickRef = useRef<HTMLInputElement>(null);
  const accept = useCallback((result: Loaded) => {
    current.current = result;
    setLoaded(result);
    if (result.warning) setError(result.warning);
  }, []);
  const report = useCallback((message: string, isError = false) => {
    if (isError) setError(message);
    else setToast(message);
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      accept(await loadWorkspace());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [accept]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(id);
  }, [toast]);
  const w = loaded?.data || emptyWorkspace();
  useEffect(() => {
    document.documentElement.dataset.theme = w.settings.theme;
  }, [w.settings.theme]);
  const mutate: Mutate = useCallback(
    async (fn, message = 'Alterações salvas.', importing = false) => {
      if (lock.current || !current.current) return false;
      lock.current = true;
      setBusy(true);
      try {
        const old = current.current;
        const data = fn(structuredClone(old.data));
        const result = await saveWorkspace(data, old.revision, importing);
        accept(result);
        if (message) setToast(message);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [accept],
  );
  const undo = useCallback(async () => {
    if (lock.current || !current.current?.canUndo) return;
    lock.current = true;
    setBusy(true);
    try {
      accept(await undoWorkspace());
      setToast('Última alteração desfeita.');
    } catch (e) {
      setError(String(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [accept]);
  const navigate = useCallback((id: string) => {
    setView(id);
    setViewName('');
    setFilters({ ...emptyFilters });
    setSidebar(false);
    setPalette(false);
  }, []);
  const activeProjectId = w.projects.find((p) => p.id === filters.projectId)?.id ?? null;
  const create = useCallback(
    (status: TaskStatus = 'inbox', date?: string) => {
      const task = newTask('', status);
      task.projectId = activeProjectId;
      if (date) task.dueDate = date;
      setEditor({ task, isNew: true });
    },
    [activeProjectId],
  );
  const closeEditor = useCallback(() => setEditor(null), []);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (document.querySelector('[role="dialog"]')) return;
      const typing = (e.target as HTMLElement).matches(
        'input,textarea,select,[contenteditable=true]',
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
        setPaletteQuery('');
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setSidebar((s) => !s);
        return;
      }
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        void undo();
      } else if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        create();
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === 'q') {
        e.preventDefault();
        quickRef.current?.focus();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [create, undo]);
  const notifying = useRef(false);
  useEffect(() => {
    if (!loaded || lock.current || notifying.current) return;
    const data = current.current!.data;
    const ended = data.timer?.endAt && Date.parse(data.timer.endAt) <= tick;
    const reminders = data.tasks.filter(
      (t) =>
        t.status !== 'completed' &&
        !t.archived &&
        t.reminderAt &&
        !t.notifiedAt &&
        Date.parse(t.reminderAt) <= tick,
    );
    if (!ended && !reminders.length) return;
    notifying.current = true;
    void (async () => {
      try {
        const title = ended
          ? 'Sessão de foco concluída'
          : `${reminders.length} lembrete${reminders.length > 1 ? 's' : ''}`;
        const body = ended
          ? 'Bom trabalho. Faça uma pausa.'
          : reminders.map((t) => t.title).join(', ');
        const saved = await mutate((s) => {
          if (ended && s.timer) {
            const task = s.tasks.find((t) => t.id === s.timer!.taskId);
            s.sessions.push({
              id: uid(),
              taskId: s.timer.taskId,
              title: task?.title || 'Sessão livre',
              seconds: s.timer.duration,
              endedAt: s.timer.endAt!,
            });
            s.timer = { ...s.timer, endAt: null, remaining: s.timer.duration };
          }
          s.tasks = s.tasks.map((t) =>
            reminders.some((x) => x.id === t.id) ? { ...t, notifiedAt: now() } : t,
          );
          return s;
        }, `${title}: ${body}`);
        if (saved && data.settings.notifications) {
          try {
            if (!(await notify(title, body)))
              setError(
                'Notificação do sistema indisponível. O lembrete foi mostrado no aplicativo.',
              );
          } catch {
            setError(
              'Não foi possível enviar a notificação. O alerta interno continua disponível.',
            );
          }
        }
      } finally {
        notifying.current = false;
      }
    })();
  }, [tick, loaded, mutate]);
  const changeStatus = (task: Task, status: TaskStatus) =>
    mutate(
      (s) => {
        if (status === 'completed') return completeTask(s, task.id);
        s.tasks = s.tasks.map((t) =>
          t.id === task.id
            ? { ...t, status, completedAt: null, archived: false, updatedAt: now() }
            : t,
        );
        return s;
      },
      status === 'completed' ? 'Tarefa concluída. Bom trabalho!' : 'Tarefa movida.',
    );
  const deleteTask = async (id: string) => {
    if (
      await mutate(
        (s) => ({
          ...s,
          tasks: s.tasks.filter((t) => t.id !== id),
          timer: s.timer?.taskId === id ? null : s.timer,
        }),
        'Tarefa excluída. Você pode desfazer.',
      )
    )
      setEditor(null);
  };
  async function storeTask(task: Task) {
    return mutate(
      (s) => {
        const old = s.tasks.find((t) => t.id === task.id);
        const completing = task.status === 'completed' && old?.status !== 'completed';
        const saved = completing
          ? { ...task, status: 'pending' as TaskStatus, completedAt: null }
          : task;
        s.tasks = old ? s.tasks.map((t) => (t.id === task.id ? saved : t)) : [saved, ...s.tasks];
        return completing ? completeTask(s, task.id) : s;
      },
      editor?.isNew ? 'Tarefa criada.' : 'Tarefa atualizada.',
    );
  }
  const taskViews = !['calendar', 'habits', 'focus', 'settings'].includes(view);
  const tasks = selectTasks(w, view, filters);
  const today = localDate(new Date(tick));
  const heading =
    viewName ||
    [
      ...navigation,
      ...tools,
      { id: 'settings', label: 'Configurações' },
      { id: 'archive', label: 'Arquivo' },
    ].find((n) => n.id === view)?.label ||
    'Todas as tarefas';
  const activeFilters = [
    filters.query,
    filters.status,
    filters.projectId,
    filters.tagId,
    filters.priority,
    filters.dateFrom || filters.dateTo,
  ].filter(Boolean).length;
  const invalidDateRange = !!(
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom > filters.dateTo
  );
  function taskCard(task: Task, board = false) {
    const project = w.projects.find((p) => p.id === task.projectId);
    return (
      <article
        key={task.id}
        draggable={board && !busy}
        onDragStart={(e) => e.dataTransfer.setData('text/chrono-task', task.id)}
        className={`task-card ${board ? 'board-card' : ''} ${task.status === 'completed' ? 'completed' : ''}`}
      >
        <input
          type="checkbox"
          aria-label={`Concluir ${task.title}`}
          checked={task.status === 'completed'}
          disabled={busy}
          onChange={() => changeStatus(task, task.status === 'completed' ? 'pending' : 'completed')}
        />
        <div className="task-content">
          <div className="task-title-line">
            <button className="task-title" onClick={() => setEditor({ task, isNew: false })}>
              {task.title}
            </button>
            {!board && <span className={`badge ${task.status}`}>{statusLabels[task.status]}</span>}
          </div>
          <div className="task-meta">
            {task.dueDate ? (
              <span
                className={task.dueDate < today && task.status !== 'completed' ? 'overdue' : ''}
              >
                <CalendarDays size={12} />
                {prettyDate(task.dueDate)}
              </span>
            ) : (
              <span>
                {task.status === 'completed' ? 'Concluída' : 'Atualizada'}{' '}
                {new Date(task.completedAt || task.updatedAt).toLocaleDateString('pt-BR')}
              </span>
            )}
            {project && (
              <span>
                <span className="project-dot" style={{ background: project.color }} />
                {project.name}
              </span>
            )}
            {task.priority > 0 && (
              <span className={`priority-${task.priority}`}>
                <Flag size={12} />
                {['', 'Baixa', 'Média', 'Alta'][task.priority]}
              </span>
            )}
            {task.recurrence && (
              <span title="Tarefa recorrente">
                <Repeat2 size={13} />
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span>
                <CheckCheck size={13} />
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
            {task.attachments.length > 0 && (
              <span>
                <Paperclip size={12} />
                {task.attachments.length}
              </span>
            )}
            {task.tags.map((id) => {
              const tag = w.tags.find((x) => x.id === id);
              return tag ? (
                <span className="tag-label" key={id}>
                  #{tag.name}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div className="task-actions">
          <select
            aria-label={`Mover ${task.title}`}
            value={task.status}
            disabled={busy}
            onChange={(e) => changeStatus(task, e.target.value as TaskStatus)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          {task.status === 'completed' && (
            <button
              className="icon-button"
              aria-label={`${task.archived ? 'Desarquivar' : 'Arquivar'} ${task.title}`}
              onClick={() =>
                mutate(
                  (s) => ({
                    ...s,
                    tasks: s.tasks.map((t) =>
                      t.id === task.id ? { ...t, archived: !t.archived } : t,
                    ),
                  }),
                  task.archived ? 'Tarefa desarquivada.' : 'Tarefa arquivada.',
                )
              }
            >
              <Archive size={15} />
            </button>
          )}
          <button
            className="icon-button edit-action"
            aria-label={`Editar ${task.title}`}
            onClick={() => setEditor({ task, isNew: false })}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button delete-action"
            aria-label={`Excluir ${task.title}`}
            onClick={() => deleteTask(task.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </article>
    );
  }
  if (loading)
    return (
      <div className="boot-screen">
        <div className="brand-icon">
          <Clock3 />
        </div>
        <h1>Chrono</h1>
        <p>Preparando seu espaço…</p>
        <div className="loading-bar" />
      </div>
    );
  if (!loaded)
    return (
      <div className="boot-screen">
        <h1>Não foi possível abrir seus dados</h1>
        <p role="alert">{error}</p>
        <button className="primary" onClick={reload}>
          <RefreshCw size={16} />
          Tentar novamente
        </button>
        <p>Se o banco estiver danificado, restaure uma cópia seguindo o README.</p>
      </div>
    );
  return (
    <div className="app-shell">
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label="Fechar navegação"
          onClick={() => setSidebar(false)}
        />
      )}
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <Clock3 size={23} />
          </div>
          <div>
            <strong>
              Chrono<span className="brand-period">.</span>
            </strong>
            <small>Seu tempo, com intenção</small>
          </div>
          <button
            className="icon-button theme-button"
            aria-label="Alternar tema"
            onClick={() =>
              mutate(
                (s) => ({
                  ...s,
                  settings: {
                    ...s.settings,
                    theme: s.settings.theme === 'light' ? 'dark' : 'light',
                  },
                }),
                'Tema atualizado.',
              )
            }
          >
            {w.settings.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
        <button className="primary new-task" onClick={() => create()}>
          <Plus size={18} />
          Nova tarefa<kbd>N</kbd>
        </button>
        <nav aria-label="Navegação principal">
          <span className="nav-heading">WORKSPACE</span>
          {navigation.map((n) => {
            const Icon = n.icon;
            const count = selectTasks(w, n.id, emptyFilters, today).length;
            return (
              <button
                className={`nav-item ${view === n.id && !viewName ? 'active' : ''}`}
                key={n.id}
                onClick={() => navigate(n.id)}
              >
                <Icon size={17} />
                <span>{n.label}</span>
                {count > 0 && <span className="count">{count}</span>}
              </button>
            );
          })}
          <div className="nav-divider" />
          {tools.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id ? 'active' : ''}`}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
              {n.id === 'focus' && w.timer?.endAt && <span className="live-dot" />}
            </button>
          ))}
          <div className="nav-heading with-action">
            PROJETOS
            <button
              className="icon-button"
              aria-label="Gerenciar projetos"
              onClick={() => navigate('settings')}
            >
              <Plus size={14} />
            </button>
          </div>
          {w.projects.length ? (
            w.projects.map((p) => (
              <button
                className={`nav-item ${filters.projectId === p.id ? 'active' : ''}`}
                key={p.id}
                onClick={() => {
                  navigate('all');
                  setViewName(p.name);
                  setFilters({ ...emptyFilters, projectId: p.id });
                }}
              >
                <span className="project-dot" style={{ background: p.color }} />
                <span>{p.name}</span>
                <span className="count">
                  {w.tasks.filter((t) => t.projectId === p.id && t.status !== 'completed').length}
                </span>
              </button>
            ))
          ) : (
            <button className="nav-item nav-muted" onClick={() => navigate('settings')}>
              <Folder size={16} />
              <span>Criar um projeto</span>
              <Plus size={13} />
            </button>
          )}
          {!!w.tags.length && (
            <>
              <span className="nav-heading">TAGS</span>
              {w.tags.map((t) => (
                <button
                  className={`nav-item ${filters.tagId === t.id ? 'active' : ''}`}
                  key={t.id}
                  onClick={() => {
                    navigate('all');
                    setFilters({ ...emptyFilters, tagId: t.id });
                    setViewName(`#${t.name}`);
                  }}
                >
                  <Hash size={16} />
                  <span>{t.name}</span>
                </button>
              ))}
            </>
          )}
          {!!w.filters.length && (
            <>
              <span className="nav-heading">FILTROS SALVOS</span>
              {w.filters.map((f) => (
                <button
                  className={`nav-item ${viewName === f.name ? 'active' : ''}`}
                  key={f.id}
                  onClick={() => {
                    navigate('all');
                    setFilters(f.criteria);
                    setViewName(f.name);
                  }}
                >
                  <Bookmark size={16} />
                  <span>{f.name}</span>
                </button>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${view === 'archive' ? 'active' : ''}`}
            onClick={() => navigate('archive')}
          >
            <Archive size={17} />
            <span>Arquivo</span>
          </button>
          <button
            className={`nav-item ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings size={17} />
            <span>Configurações</span>
          </button>
          <button
            className="keyboard-hint"
            onClick={() => {
              setPalette(true);
              setPaletteQuery('');
            }}
          >
            <span className="live-dot" />
            Tudo salvo localmente<kbd>⌘ K</kbd>
          </button>
          {!desktop && <span className="preview-label">Prévia web · dados separados</span>}
        </div>
      </aside>
      <main className="workspace" aria-busy={busy}>
        <div className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir navegação"
              onClick={() => setSidebar(!sidebar)}
            >
              <Menu size={19} />
            </button>
            <span>Meu espaço</span>
            <ChevronRight size={13} />
            <strong>{heading}</strong>
          </div>
          <div className="topbar-right">
            <span className="today-date">
              {new Date(tick).toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: 'numeric',
                month: 'long',
              })}
            </span>
            <button
              className="icon-button"
              title="Desfazer última alteração (Ctrl+Z)"
              aria-label="Desfazer última alteração"
              disabled={!loaded.canUndo || busy}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Abrir busca de comandos"
              onClick={() => {
                setPalette(true);
                setPaletteQuery('');
              }}
            >
              <Command size={17} />
            </button>
            <span className="avatar">C</span>
          </div>
        </div>
        <div className="workspace-inner">
          <header className="page-header">
            <div>
              <div className="heading-line">
                <h1>{heading}</h1>
                {taskViews && <span className="count header-count">{tasks.length} tarefas</span>}
              </div>
              <p>{subtitles[view]}</p>
            </div>
            {taskViews && (
              <div className="header-actions">
                <div className="segmented">
                  <button
                    aria-pressed={mode === 'list'}
                    className={mode === 'list' ? 'selected' : ''}
                    onClick={() => setMode('list')}
                  >
                    <List size={15} />
                    Lista
                  </button>
                  <button
                    aria-pressed={mode === 'board'}
                    className={mode === 'board' ? 'selected' : ''}
                    onClick={() => setMode('board')}
                  >
                    <Columns3 size={15} />
                    Kanban
                  </button>
                </div>
                <button className="primary" onClick={() => create()}>
                  <Plus size={17} />
                  Adicionar
                </button>
              </div>
            )}
          </header>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={reload}>Recarregar</button>
              <button aria-label="Dispensar erro" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {taskViews ? (
            <>
              {view !== 'archive' && (
                <form
                  className="quick-capture"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!quick.trim()) return;
                    const task = newTask(quick.trim());
                    task.projectId = activeProjectId;
                    if (
                      await mutate(
                        (s) => ({ ...s, tasks: [task, ...s.tasks] }),
                        'Tarefa capturada na Inbox.',
                      )
                    )
                      setQuick('');
                  }}
                >
                  <Plus size={20} />
                  <input
                    ref={quickRef}
                    aria-label="Captura rápida"
                    placeholder="O que você precisa fazer? Capture uma ideia na Inbox…"
                    maxLength={240}
                    value={quick}
                    onChange={(e) => setQuick(e.target.value)}
                  />
                  <kbd>Enter ↵</kbd>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Criar tarefa por voz"
                    title="Criar tarefa por voz"
                    disabled={busy}
                    onClick={() => setVoice({ projectId: activeProjectId })}
                  >
                    <Mic size={19} />
                  </button>
                  <button disabled={!quick.trim() || busy} className="primary">
                    Capturar
                  </button>
                </form>
              )}
              <div className="list-toolbar">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    ref={searchRef}
                    aria-label="Buscar tarefas"
                    placeholder="Buscar tarefas…"
                    value={filters.query}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  />
                  <kbd>/</kbd>
                </div>
                <div className="toolbar-right">
                  <button
                    className={`secondary ${activeFilters ? 'filter-active' : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <SlidersHorizontal size={15} />
                    Filtros{activeFilters > 0 && <span className="count">{activeFilters}</span>}
                  </button>
                  {activeFilters > 0 && (
                    <button
                      className="text-button"
                      onClick={() => {
                        setFilters({ ...emptyFilters });
                        setViewName('');
                      }}
                    >
                      Limpar
                    </button>
                  )}
                  <span className="sort-label">
                    Prioridade e prazo <ArrowUpRight size={13} />
                  </span>
                </div>
              </div>
              {showFilters && (
                <div className="filter-panel">
                  <select
                    aria-label="Filtrar status"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">Todos os status</option>
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar projeto"
                    value={filters.projectId}
                    onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
                  >
                    <option value="">Todos os projetos</option>
                    {w.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar tag"
                    value={filters.tagId}
                    onChange={(e) => setFilters({ ...filters, tagId: e.target.value })}
                  >
                    <option value="">Todas as tags</option>
                    {w.tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Filtrar prioridade"
                    value={filters.priority}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  >
                    <option value="">Todas as prioridades</option>
                    <option value="3">Alta</option>
                    <option value="2">Média</option>
                    <option value="1">Baixa</option>
                    <option value="0">Sem prioridade</option>
                  </select>
                  <div className="date-filter-row">
                    <label>
                      Filtrar por data de
                      <select
                        aria-label="Tipo de data"
                        value={filters.dateField}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            dateField: e.target.value as Filters['dateField'],
                          })
                        }
                      >
                        <option value="dueDate">Prazo</option>
                        <option value="startDate">Início</option>
                      </select>
                    </label>
                    <label>
                      De
                      <input
                        aria-label="Data de"
                        type="date"
                        value={filters.dateFrom}
                        max={filters.dateTo || '9999-12-31'}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      />
                    </label>
                    <label>
                      Até
                      <input
                        aria-label="Data até"
                        type="date"
                        value={filters.dateTo}
                        min={filters.dateFrom || undefined}
                        max="9999-12-31"
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      />
                    </label>
                    {(filters.dateFrom || filters.dateTo) && (
                      <button
                        className="text-button"
                        onClick={() => setFilters({ ...filters, dateFrom: '', dateTo: '' })}
                      >
                        Limpar datas
                      </button>
                    )}
                    <span className="hint">
                      Limites inclusivos; tarefas sem a data escolhida ficam fora do intervalo.
                    </span>
                    {invalidDateRange && (
                      <span className="field-error" role="alert">
                        A data “De” deve ser anterior ou igual à data “Até”.
                      </span>
                    )}
                  </div>
                  <button
                    className="secondary"
                    disabled={invalidDateRange}
                    onClick={() => {
                      setSaveFilter(true);
                      setFilterName('');
                    }}
                  >
                    <Bookmark size={15} />
                    Salvar filtro
                  </button>
                </div>
              )}
              {view === 'today' && (
                <div className="today-summary">
                  <div>
                    <Sun size={22} />
                    <span>
                      Seu dia, com clareza.
                      <small>
                        {tasks.length
                          ? `${tasks.length} tarefas para seguir em frente.`
                          : 'Você está em dia. Aproveite o espaço.'}
                      </small>
                    </span>
                  </div>
                  <button className="text-button" onClick={() => navigate('focus')}>
                    Entrar em foco <ArrowUpRight size={15} />
                  </button>
                </div>
              )}
              {mode === 'board' ? (
                <div className="kanban">
                  {statuses.map((status) => (
                    <section
                      className="kanban-column"
                      key={status}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const task = w.tasks.find(
                          (t) => t.id === e.dataTransfer.getData('text/chrono-task'),
                        );
                        if (task && task.status !== status) void changeStatus(task, status);
                      }}
                    >
                      <header>
                        <span className={`status-dot ${status}`} />
                        <h2>{statusLabels[status]}</h2>
                        <span className="count">
                          {tasks.filter((t) => t.status === status).length}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Nova tarefa em ${statusLabels[status]}`}
                          onClick={() => create(status)}
                        >
                          <Plus size={16} />
                        </button>
                      </header>
                      {tasks.filter((t) => t.status === status).map((t) => taskCard(t, true))}
                      <button className="column-add" onClick={() => create(status)}>
                        <Plus size={14} />
                        Adicionar tarefa
                      </button>
                    </section>
                  ))}
                </div>
              ) : tasks.length ? (
                <>
                  <div className="list-caption">
                    <span>
                      {view === 'completed' || view === 'archive'
                        ? 'SEU HISTÓRICO'
                        : 'SUAS TAREFAS'}
                    </span>
                    <span>{tasks.filter((t) => t.status === 'completed').length} concluídas</span>
                  </div>
                  <div className="task-list">{tasks.map((t) => taskCard(t))}</div>
                  <div className="list-end">
                    <span />
                    <span>Tudo começa com um pequeno passo.</span>
                    <span />
                  </div>
                </>
              ) : (
                <Empty
                  title={
                    activeFilters
                      ? 'Nenhuma tarefa encontrada'
                      : view === 'completed'
                        ? 'Suas conquistas vão aparecer aqui'
                        : view === 'archive'
                          ? 'Histórico organizado, mente livre'
                          : view === 'today'
                            ? 'Um dia com espaço para respirar'
                            : 'Espaço para o seu próximo passo'
                  }
                  text={
                    activeFilters
                      ? 'Experimente outro termo ou ajuste os filtros.'
                      : 'Capture uma tarefa, organize suas prioridades e siga no seu ritmo.'
                  }
                >
                  {!activeFilters && view !== 'archive' && (
                    <button className="secondary" onClick={() => create()}>
                      <Plus size={16} />
                      Criar uma tarefa
                    </button>
                  )}
                </Empty>
              )}
            </>
          ) : view === 'calendar' ? (
            <CalendarView
              w={w}
              onEdit={(t) => setEditor({ task: t, isNew: false })}
              onNew={(date) => create('pending', date)}
            />
          ) : view === 'habits' ? (
            <HabitsView w={w} mutate={mutate} />
          ) : view === 'focus' ? (
            <FocusView w={w} mutate={mutate} tick={tick} />
          ) : (
            <SettingsView w={w} mutate={mutate} path={loaded.dataPath} report={report} />
          )}
        </div>
        <footer className="workspace-footer">
          <span>
            <span className="live-dot" />
            {busy ? 'Salvando…' : 'Seu espaço está atualizado'}
          </span>
          <span>Feito para o seu ritmo.</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={18} />
          <span>{toast}</span>
          {loaded.canUndo && <button onClick={undo}>Desfazer</button>}
          <button aria-label="Fechar mensagem" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {voice && (
        <VoiceCapture
          projectName={w.projects.find((p) => p.id === voice.projectId)?.name}
          onClose={() => setVoice(null)}
          onSave={async (draft) => {
            const task = { ...newTask(draft.title), ...draft };
            task.projectId = voice.projectId;
            return mutate((s) => ({ ...s, tasks: [task, ...s.tasks] }), 'Tarefa criada por voz.');
          }}
        />
      )}
      {editor && (
        <TaskEditor
          key={editor.task.id}
          initial={editor.task}
          workspace={w}
          isNew={editor.isNew}
          busy={busy}
          onSave={storeTask}
          saveError={error}
          onDelete={() => deleteTask(editor.task.id)}
          onClose={closeEditor}
        />
      )}
      {saveFilter && (
        <Dialog title="Salvar filtro" onClose={() => setSaveFilter(false)}>
          <form
            className="dialog-body"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  (s) => ({
                    ...s,
                    filters: [
                      ...s.filters,
                      { id: uid(), name: filterName.trim(), criteria: filters },
                    ],
                  }),
                  'Filtro salvo.',
                )
              )
                setSaveFilter(false);
            }}
          >
            <label>
              Nome
              <input
                autoFocus
                required
                maxLength={240}
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                placeholder="Ex.: Trabalho prioritário"
              />
            </label>
            <button className="primary" disabled={!filterName.trim()}>
              Salvar filtro
            </button>
          </form>
        </Dialog>
      )}
      {palette && (
        <Dialog title="Ir para…" onClose={() => setPalette(false)}>
          <div className="palette-search">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Pesquisar comandos e tarefas"
              placeholder="Busque uma tarefa ou navegue pelo Chrono…"
              value={paletteQuery}
              onChange={(e) => setPaletteQuery(e.target.value)}
            />
            <kbd>ESC</kbd>
          </div>
          <div className="palette-results">
            <button
              onClick={() => {
                setPalette(false);
                create();
              }}
            >
              <Plus size={18} />
              Nova tarefa<kbd>N</kbd>
            </button>
            {[...navigation, ...tools, { id: 'settings', label: 'Configurações', icon: Settings }]
              .filter((n) => n.label.toLowerCase().includes(paletteQuery.toLowerCase()))
              .map((n) => (
                <button key={n.id} onClick={() => navigate(n.id)}>
                  <n.icon size={18} />
                  {n.label}
                  <ChevronRight size={14} />
                </button>
              ))}
            {paletteQuery &&
              w.tasks
                .filter((t) => t.title.toLowerCase().includes(paletteQuery.toLowerCase()))
                .slice(0, 12)
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setPalette(false);
                      setEditor({ task: t, isNew: false });
                    }}
                  >
                    <CircleCheck size={18} />
                    {t.title}
                  </button>
                ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}
