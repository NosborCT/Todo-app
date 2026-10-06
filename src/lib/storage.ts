import { invoke, isTauri } from '@tauri-apps/api/core';
import { emptyWorkspace, workspaceSchema, type Workspace } from '../domain/task';
export type Loaded = {
  data: Workspace;
  revision: number;
  canUndo: boolean;
  warning: string | null;
  dataPath: string;
};
const KEY = 'chrono-browser-preview-v1';
function previewLoad(): Loaded {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const stored = JSON.parse(raw);
    return {
      ...stored,
      data: workspaceSchema.parse(stored.data),
      dataPath: 'Prévia no navegador — armazenamento separado',
      warning: null,
    };
  }
  return {
    data: emptyWorkspace(),
    revision: 0,
    canUndo: false,
    warning: null,
    dataPath: 'Prévia no navegador — armazenamento separado',
  };
}
export const desktop = isTauri();
export async function loadWorkspace(): Promise<Loaded> {
  return desktop ? invoke('load_workspace') : previewLoad();
}
export async function saveWorkspace(
  data: Workspace,
  revision: number,
  importing = false,
): Promise<Loaded> {
  const valid = workspaceSchema.parse(data);
  if (desktop) return invoke('save_workspace', { data: valid, revision, importing });
  const old = previewLoad();
  if (old.revision !== revision) throw new Error('Dados alterados em outra janela. Recarregue.');
  const next = { ...old, data: valid, revision: revision + 1, canUndo: true };
  localStorage.setItem(`${KEY}-undo`, JSON.stringify(old.data));
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
export async function undoWorkspace(): Promise<Loaded> {
  if (desktop) return invoke('undo_workspace');
  const raw = localStorage.getItem(`${KEY}-undo`);
  if (!raw) throw new Error('Nada para desfazer.');
  const current = previewLoad();
  const next = {
    ...current,
    data: workspaceSchema.parse(JSON.parse(raw)),
    revision: current.revision + 1,
    canUndo: false,
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  localStorage.removeItem(`${KEY}-undo`);
  return next;
}
export function download(name: string, bytes: BlobPart, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export async function exportWorkspace(data: Workspace) {
  if (desktop) return invoke<string | null>('export_workspace');
  download('chrono-export.json', JSON.stringify(data, null, 2));
  return 'Downloads';
}
export async function backupWorkspace() {
  if (!desktop) throw new Error('Backups automáticos estão disponíveis no aplicativo desktop.');
  return invoke<string>('backup_workspace');
}
export async function notify(title: string, body: string, request = false) {
  if (!desktop) return false;
  const api = await import('@tauri-apps/plugin-notification');
  let granted = await api.isPermissionGranted();
  if (!granted && request) granted = (await api.requestPermission()) === 'granted';
  if (!granted) return false;
  api.sendNotification({ title, body });
  return true;
}
export async function openAttachment(
  taskId: string,
  attachment: Workspace['tasks'][number]['attachments'][number],
) {
  if (desktop) return invoke('open_attachment', { taskId, attachmentId: attachment.id });
  const bytes = Uint8Array.from(atob(attachment.data), (c) => c.charCodeAt(0));
  download(attachment.name, bytes, 'application/octet-stream');
}
