import { test, expect, type Page } from '@playwright/test';
import { emptyWorkspace, uid } from '../src/domain/task';
test.use({ timezoneId: 'America/Sao_Paulo' });

// Mock only the native IPC boundary: real UI, validation and save orchestration run.
// These tests do not claim to exercise microphone hardware or Whisper inference.
async function nativeMock(page: Page, modelReady = true, transcript = 'Estudar React amanhã') {
  await page.clock.setFixedTime(new Date('2026-10-08T13:15:00Z'));
  const workspace = emptyWorkspace();
  workspace.projects = [{ id: uid(), name: 'Estudos', color: '#7c3aed' }];
  await page.addInitScript(
    ({ workspace, modelReady, transcript }) => {
      let data = workspace;
      let revision = 0;
      let failSave = false;
      let voice = {
        phase: 'idle',
        seconds: 0,
        progress: 0,
        text: '',
        error: null as string | null,
        modelReady,
      };
      window.addEventListener('voice-test-save-error', () => {
        failSave = true;
      });
      window.addEventListener('voice-test-no-mic', () => {
        voice = { ...voice, phase: 'error', error: 'Nenhum microfone encontrado.' };
      });
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          invoke: async (cmd: string, args: Record<string, any> = {}) => {
            if (cmd === 'load_workspace')
              return { data, revision, canUndo: false, warning: null, dataPath: 'test' };
            if (cmd === 'save_workspace') {
              if (failSave) {
                failSave = false;
                throw new Error('Falha simulada no disco');
              }
              data = args.data;
              revision++;
              localStorage.setItem('voice-saved', JSON.stringify(data));
              return { data, revision, canUndo: true, warning: null, dataPath: 'test' };
            }
            if (cmd === 'voice_status') return { ...voice };
            if (cmd === 'voice_begin') {
              voice = {
                ...voice,
                error: null,
                text: '',
                phase: args.download ? 'idle' : 'recording',
                modelReady: true,
              };
              return;
            }
            if (cmd === 'voice_stop') {
              voice = { ...voice, phase: 'review', text: transcript };
              return;
            }
            if (cmd === 'voice_cancel') {
              voice = { ...voice, phase: 'idle', text: '' };
              return;
            }
            throw new Error(`IPC inesperado: ${cmd}`);
          },
        },
      });
    },
    { workspace, modelReady, transcript },
  );
}
test('voz: instalar, revisar e salvar no projeto; falha no disco preserva texto', async ({
  page,
}) => {
  await nativeMock(page, false);
  await page.goto('/');
  await page.getByRole('button', { name: /^Estudos/ }).click();
  await page.getByRole('button', { name: 'Criar tarefa por voz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar tarefa por voz' });
  await expect(dialog).toContainText('Destino: Inbox · Estudos');
  await dialog.getByRole('button', { name: 'Instalar modelo' }).click();
  await dialog.getByRole('button', { name: 'Gravar', exact: true }).click();
  await expect(dialog).toContainText('Gravando');
  await dialog.getByRole('button', { name: 'Parar e transcrever' }).click();
  await expect(dialog.getByLabel('Revise o título da tarefa')).toHaveValue('Estudar React amanhã');
  await expect(page.locator('.task-card')).toHaveCount(0);
  await dialog.getByLabel('Revise o título da tarefa').fill('Revisar React');
  await page.screenshot({ path: 'docs/screenshots/voz.png' });
  await page.evaluate(() => window.dispatchEvent(new Event('voice-test-save-error')));
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Seu texto foi mantido');
  await expect(dialog.getByLabel('Revise o título da tarefa')).toHaveValue('Revisar React');
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voice-saved')!));
  expect(saved.tasks).toHaveLength(1);
  expect(saved.tasks[0].projectId).toBe(saved.projects[0].id);
  expect(saved.tasks[0].title).toBe('Revisar React');
  expect(saved.tasks[0].dueDate).toBe('2026-10-09');
  expect(saved.tasks[0].reminderAt).toBeNull();
});
test('voz: cancelar e recuperar ausência de microfone sem criar tarefa', async ({ page }) => {
  await nativeMock(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar tarefa por voz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar tarefa por voz' });
  await dialog.getByRole('button', { name: 'Gravar', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('voice-test-no-mic')));
  await expect(dialog.getByRole('alert')).toContainText('Nenhum microfone');
  await dialog.getByRole('button', { name: 'Gravar', exact: true }).click();
  await expect(dialog).toContainText('Gravando');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.task-card')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('voice-saved'))).toBeNull();
});
test('voz: navegador explica disponibilidade desktop', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar tarefa por voz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar tarefa por voz' });
  await expect(dialog).toContainText('disponível no aplicativo desktop');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
});

test('voz: interpreta início, prazo e antecedência; permite ajustar antes de salvar', async ({
  page,
}) => {
  await nativeMock(
    page,
    true,
    'Começar relatório amanhã e entregar dia 12 de outubro às 14h, me lembre 30 minutos antes',
  );
  await page.goto('/');
  await page.getByRole('button', { name: /^Estudos/ }).click();
  await page.getByRole('button', { name: 'Criar tarefa por voz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar tarefa por voz' });
  await dialog.getByRole('button', { name: 'Gravar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Parar e transcrever' }).click();
  await expect(dialog.getByLabel('Início sugerido')).toHaveValue('2026-10-09');
  await expect(dialog.getByLabel('Prazo sugerido')).toHaveValue('2026-10-12');
  await expect(dialog.getByLabel('Lembrete sugerido')).toHaveValue('2026-10-12T13:30');
  await dialog.getByLabel('Revise o título da tarefa').fill('Preparar relatório');
  await dialog.getByLabel('Início sugerido').fill('2026-10-10');
  await dialog.getByLabel('Lembrete sugerido').fill('2026-10-12T13:00');
  await page.screenshot({ path: 'docs/screenshots/voz-agendamento.png' });
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voice-saved')!));
  expect(saved.tasks[0]).toMatchObject({
    title: 'Preparar relatório',
    startDate: '2026-10-10',
    dueDate: '2026-10-12',
    reminderAt: '2026-10-12T16:00:00.000Z',
    notifiedAt: null,
    projectId: saved.projects[0].id,
  });
});

test('voz: rejeita lembrete passado, permite reinterpretar e limpar sem criar agendamento oculto', async ({
  page,
}) => {
  await nativeMock(page, true, 'Revisar hoje às 8');
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar tarefa por voz' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar tarefa por voz' });
  await dialog.getByRole('button', { name: 'Gravar', exact: true }).click();
  await dialog.getByRole('button', { name: 'Parar e transcrever' }).click();
  await expect(dialog.getByLabel('Lembrete sugerido')).toHaveValue('2026-10-08T08:00');
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('lembrete futuro');
  expect(await page.evaluate(() => localStorage.getItem('voice-saved'))).toBeNull();
  await dialog.getByLabel('Revise o título da tarefa').fill('Revisar amanhã às 9');
  await dialog.getByRole('button', { name: 'Interpretar título novamente' }).click();
  await expect(dialog.getByLabel('Lembrete sugerido')).toHaveValue('2026-10-09T09:00');
  await dialog.getByLabel('Início sugerido').fill('2026-10-12');
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('início deve preceder');
  await dialog.getByRole('button', { name: 'Limpar agendamento' }).click();
  await expect(dialog.getByLabel('Prazo sugerido')).toHaveValue('');
  await expect(dialog.getByLabel('Lembrete sugerido')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const task = await page.evaluate(() => JSON.parse(localStorage.getItem('voice-saved')!).tasks[0]);
  expect(task).toMatchObject({ dueDate: null, startDate: null, reminderAt: null });
});
