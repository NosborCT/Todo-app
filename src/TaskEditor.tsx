import { useState, useCallback } from 'react';
import { Plus, Trash2, Paperclip, Repeat2, ChevronDown } from 'lucide-react';
import {
  type Task,
  type Workspace,
  statuses,
  statusLabels,
  taskSchema,
  uid,
  now,
  safeName,
  parseDate,
} from './domain/task';
import { Dialog } from './components';
import { openAttachment } from './lib/storage';
export function TaskEditor({
  initial,
  workspace,
  isNew,
  busy,
  onSave,
  onDelete,
  onClose,
  saveError,
}: {
  initial: Task;
  workspace: Workspace;
  isNew: boolean;
  busy: boolean;
  onSave: (t: Task) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
  saveError: string;
}) {
  const [task, setTask] = useState(initial);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(!isNew);
  const [sub, setSub] = useState('');
  const [reading, setReading] = useState(false);
  const close = useCallback(onClose, [onClose]);
  const patch = (p: Partial<Task>) => setTask((t) => ({ ...t, ...p }));
  async function attach(files: FileList | null) {
    if (!files) return;
    setReading(true);
    try {
      const additions: Task['attachments'] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10485760) throw new Error('Cada anexo pode ter até 10 MB.');
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Não foi possível ler o anexo.'));
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.readAsDataURL(file);
        });
        additions.push({ id: uid(), name: safeName(file.name), data, size: file.size });
      }
      setTask((t) => ({ ...t, attachments: [...t.attachments, ...additions] }));
    } catch (e) {
      setError(String(e));
    } finally {
      setReading(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const candidate = {
      ...task,
      title: task.title.trim(),
      updatedAt: now(),
      completedAt: task.status === 'completed' ? task.completedAt || now() : null,
      archived: task.status === 'completed' && task.archived,
    };
    const parsed = taskSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (await onSave(parsed.data)) onClose();
  }
  const localReminder = task.reminderAt
    ? new Date(
        new Date(task.reminderAt).getTime() - new Date(task.reminderAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : '';
  return (
    <Dialog title={isNew ? 'Nova tarefa' : 'Detalhes da tarefa'} drawer={!isNew} onClose={close}>
      <form onSubmit={submit} className="editor-form">
        <div className="editor-scroll">
          <label>
            Título da tarefa <span className="required">*</span>
            <textarea
              autoFocus
              aria-label="Título da tarefa"
              required
              maxLength={240}
              value={task.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="O que você precisa fazer?"
              rows={isNew ? 2 : 3}
            />
          </label>
          <label>
            {isNew ? 'Status inicial' : 'Status'}
            <select
              value={task.status}
              onChange={(e) => patch({ status: e.target.value as Task['status'] })}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </label>
          {isNew && task.projectId && !expanded && (
            <p className="hint">
              Projeto:{' '}
              <strong>{workspace.projects.find((p) => p.id === task.projectId)?.name}</strong>
            </p>
          )}
          {isNew && (
            <button
              type="button"
              className="text-button expand"
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown size={15} />{' '}
              {expanded ? 'Menos opções' : 'Datas, prioridade e outros detalhes'}
            </button>
          )}
          {expanded && (
            <>
              <div className="form-grid">
                <label>
                  Prioridade
                  <select
                    value={task.priority}
                    onChange={(e) => patch({ priority: +e.target.value })}
                  >
                    <option value={0}>Sem prioridade</option>
                    <option value={1}>Baixa</option>
                    <option value={2}>Média</option>
                    <option value={3}>Alta</option>
                  </select>
                </label>
                <label>
                  Projeto
                  <select
                    value={task.projectId || ''}
                    onChange={(e) => patch({ projectId: e.target.value || null })}
                  >
                    <option value="">Sem projeto</option>
                    {workspace.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  Data de início
                  <input
                    type="date"
                    value={task.startDate || ''}
                    onChange={(e) => patch({ startDate: e.target.value || null })}
                  />
                </label>
                <label>
                  Prazo
                  <input
                    type="date"
                    value={task.dueDate || ''}
                    onChange={(e) =>
                      patch({
                        dueDate: e.target.value || null,
                        recurrence:
                          task.recurrence && e.target.value
                            ? { ...task.recurrence, monthDay: parseDate(e.target.value).getDate() }
                            : task.recurrence,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Lembrete
                <input
                  type="datetime-local"
                  value={localReminder}
                  onChange={(e) =>
                    patch({
                      reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      notifiedAt: null,
                    })
                  }
                />
              </label>
              <div className="section-label">
                <Repeat2 size={15} /> Repetição
              </div>
              <select
                aria-label="Repetição"
                value={task.recurrence?.unit || ''}
                onChange={(e) =>
                  patch({
                    recurrence: e.target.value
                      ? {
                          unit: e.target.value as 'day' | 'week' | 'month',
                          interval: 1,
                          weekdays: [],
                          monthDay: task.dueDate ? parseDate(task.dueDate).getDate() : 1,
                          until: null,
                        }
                      : null,
                  })
                }
              >
                <option value="">Não repetir</option>
                <option value="day">Diária / intervalo em dias</option>
                <option value="week">Semanal / dias personalizados</option>
                <option value="month">Mensal / intervalo em meses</option>
              </select>
              {task.recurrence && (
                <div className="soft-panel">
                  <div className="form-grid">
                    <label>
                      A cada
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={task.recurrence.interval}
                        onChange={(e) =>
                          patch({ recurrence: { ...task.recurrence!, interval: +e.target.value } })
                        }
                      />
                    </label>
                    <label>
                      Repetir até (opcional)
                      <input
                        type="date"
                        min={task.dueDate || undefined}
                        value={task.recurrence.until || ''}
                        onChange={(e) =>
                          patch({
                            recurrence: { ...task.recurrence!, until: e.target.value || null },
                          })
                        }
                      />
                    </label>
                  </div>
                  {task.recurrence.unit === 'week' && (
                    <div className="weekdays">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <button
                          aria-label={
                            ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][
                              i
                            ]
                          }
                          aria-pressed={task.recurrence!.weekdays.includes(i)}
                          type="button"
                          key={i}
                          className={task.recurrence!.weekdays.includes(i) ? 'selected' : ''}
                          onClick={() =>
                            patch({
                              recurrence: {
                                ...task.recurrence!,
                                weekdays: task.recurrence!.weekdays.includes(i)
                                  ? task.recurrence!.weekdays.filter((x) => x !== i)
                                  : [...task.recurrence!.weekdays, i],
                              },
                            })
                          }
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="hint">
                    A próxima ocorrência é criada ao concluir esta tarefa. Dias 29–31 se ajustam ao
                    último dia de meses menores.
                  </p>
                </div>
              )}
              <label>
                Notas
                <textarea
                  rows={4}
                  maxLength={50000}
                  value={task.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  placeholder="Ideias, contexto, próximos passos…"
                />
              </label>
              <div className="section-label">Tags</div>
              <div className="chips">
                {workspace.tags.length ? (
                  workspace.tags.map((tag) => (
                    <button
                      type="button"
                      aria-pressed={task.tags.includes(tag.id)}
                      className={`chip ${task.tags.includes(tag.id) ? 'selected' : ''}`}
                      key={tag.id}
                      onClick={() =>
                        patch({
                          tags: task.tags.includes(tag.id)
                            ? task.tags.filter((x) => x !== tag.id)
                            : [...task.tags, tag.id],
                        })
                      }
                    >
                      #{tag.name}
                    </button>
                  ))
                ) : (
                  <span className="hint">Crie tags em Configurações.</span>
                )}
              </div>
              <div className="section-label">
                Subtarefas{' '}
                <span className="count">
                  {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </span>
              </div>
              {task.subtasks.map((s) => (
                <div className="subtask" key={s.id}>
                  <input
                    type="checkbox"
                    aria-label={`Concluir ${s.title}`}
                    checked={s.done}
                    onChange={(e) =>
                      patch({
                        subtasks: task.subtasks.map((x) =>
                          x.id === s.id ? { ...x, done: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  <span>{s.title}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Excluir subtarefa ${s.title}`}
                    onClick={() => patch({ subtasks: task.subtasks.filter((x) => x.id !== s.id) })}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="inline-form">
                <input
                  aria-label="Nova subtarefa"
                  placeholder="Adicionar subtarefa"
                  value={sub}
                  maxLength={240}
                  onChange={(e) => setSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (sub.trim()) {
                        patch({
                          subtasks: [
                            ...task.subtasks,
                            { id: uid(), title: sub.trim(), done: false },
                          ],
                        });
                        setSub('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  className="secondary"
                  aria-label="Adicionar subtarefa"
                  disabled={!sub.trim()}
                  onClick={() => {
                    patch({
                      subtasks: [...task.subtasks, { id: uid(), title: sub.trim(), done: false }],
                    });
                    setSub('');
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="section-label">
                <Paperclip size={15} /> Anexos
              </div>
              {task.attachments.map((a) => (
                <div key={a.id} className="subtask">
                  <button
                    type="button"
                    className="text-button attachment-name"
                    disabled={isNew || !initial.attachments.some((x) => x.id === a.id)}
                    onClick={() => openAttachment(task.id, a).catch((e) => setError(String(e)))}
                  >
                    {a.name}
                  </button>
                  <small>{Math.ceil(a.size / 1024)} KB</small>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remover ${a.name}`}
                    onClick={() =>
                      patch({ attachments: task.attachments.filter((x) => x.id !== a.id) })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <label className="file-label">
                <Paperclip size={14} />
                {reading ? 'Lendo arquivos…' : 'Adicionar arquivos · até 10 MB cada'}
                <input
                  type="file"
                  multiple
                  disabled={reading}
                  onChange={(e) => {
                    void attach(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {!isNew && (
                <div className="metadata">
                  <div>
                    Criada em <span>{new Date(task.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <div>
                    Última atualização{' '}
                    <span>{new Date(task.updatedAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              )}
            </>
          )}
          {(error || saveError) && (
            <p className="field-error" role="alert">
              {error || saveError}
            </p>
          )}
        </div>
        <footer className="editor-footer">
          <button
            disabled={busy || reading || !task.title.trim()}
            className="primary"
            type="submit"
          >
            {busy ? 'Salvando…' : isNew ? 'Criar tarefa' : 'Salvar alterações'}
          </button>
          {!isNew ? (
            <button disabled={busy} type="button" className="danger text-button" onClick={onDelete}>
              Excluir tarefa
            </button>
          ) : (
            <button type="button" className="text-button" onClick={onClose}>
              Cancelar
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  );
}
