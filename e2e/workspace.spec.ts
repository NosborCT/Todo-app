import { test, expect } from '@playwright/test';
import { emptyWorkspace, newTask, localDate, addDays } from '../src/domain/task';

test('capturar, editar, concluir, desfazer, persistir, exportar e importar', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Todas as tarefas', exact: true })).toBeVisible();
  await page.getByLabel('Captura rápida').fill('Planejar a semana');
  await page.getByLabel('Captura rápida').press('Enter');
  await expect(page.getByRole('button', { name: 'Planejar a semana', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Planejar a semana', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Detalhes da tarefa' });
  await drawer.getByLabel('Título da tarefa', { exact: true }).fill('Planejar semana com calma');
  await drawer.getByLabel('Prazo', { exact: true }).fill(localDate());
  await drawer.getByLabel('Notas', { exact: true }).fill('Escolher três prioridades.');
  await drawer.getByLabel('Nova subtarefa', { exact: true }).fill('Revisar agenda');
  await drawer.getByLabel('Nova subtarefa', { exact: true }).press('Enter');
  await drawer.locator('input[type=file]').setInputFiles({
    name: 'nota.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Meu plano local'),
  });
  await expect(drawer.getByRole('button', { name: 'nota.txt', exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(drawer).not.toBeVisible();
  await page.getByRole('button', { name: /^Hoje/ }).click();
  await expect(
    page.getByRole('button', { name: 'Planejar semana com calma', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Concluir Planejar semana com calma', { exact: true }).click();
  await page.getByRole('button', { name: /^Concluídas/ }).click();
  await expect(
    page.getByLabel('Concluir Planejar semana com calma', { exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Desfazer última alteração', exact: true }).click();
  await page.getByRole('button', { name: /^Todas as tarefas/ }).click();
  await expect(
    page.getByLabel('Concluir Planejar semana com calma', { exact: true }),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Planejar semana com calma', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar JSON' }).click();
  const download = await downloading;
  const exportPath = testInfo.outputPath('chrono-export.json');
  await download.saveAs(exportPath);
  await page.getByRole('button', { name: /^Todas as tarefas/ }).click();
  await page
    .getByRole('button', { name: 'Excluir Planejar semana com calma', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Planejar semana com calma', exact: true }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(exportPath);
  await page.getByRole('button', { name: 'Confirmar importação' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: /^Todas as tarefas/ }).click();
  await expect(
    page.getByRole('button', { name: 'Planejar semana com calma', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('atalhos, hábitos, foco e visualização das telas', async ({ page }) => {
  const w = emptyWorkspace();
  const today = localDate();
  w.projects = [
    { id: 'work', name: 'Trabalho', color: '#7c3aed' },
    { id: 'personal', name: 'Pessoal', color: '#38b6a0' },
  ];
  w.tags = [
    { id: 'planning', name: 'planejamento' },
    { id: 'learning', name: 'aprendizado' },
  ];
  w.tasks = [
    { ...newTask('Organizar ideias do projeto'), projectId: 'work', tags: ['planning'] },
    {
      ...newTask('Revisar proposta comercial', 'pending'),
      dueDate: today,
      priority: 3,
      projectId: 'work',
    },
    {
      ...newTask('Implementar cadastro de tarefas', 'progress'),
      dueDate: addDays(today, 1),
      projectId: 'work',
      tags: ['learning'],
      subtasks: [
        { id: 'sub', title: 'Revisar validação', done: true },
        { id: 'sub2', title: 'Testar persistência', done: false },
      ],
    },
    { ...newTask('Estudar atalhos de produtividade', 'someday'), projectId: 'personal' },
    { ...newTask('Preparar ambiente de desenvolvimento', 'completed'), projectId: 'work' },
  ];
  await page.addInitScript(
    (data) =>
      localStorage.setItem(
        'chrono-browser-preview-v1',
        JSON.stringify({ data, revision: 0, canUndo: false, warning: null }),
      ),
    w,
  );
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Organizar ideias do projeto', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/lista.png', fullPage: true });
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog', { name: 'Nova tarefa' })).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/nova-tarefa.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/kanban.png', fullPage: true });
  await page
    .getByLabel('Mover Organizar ideias do projeto', { exact: true })
    .selectOption('progress');
  await expect(
    page
      .locator('.kanban-column')
      .filter({ has: page.getByRole('heading', { name: 'Em progresso', exact: true }) })
      .getByRole('button', { name: 'Organizar ideias do projeto', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Revisar proposta comercial', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/detalhes.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Pesquisar comandos e tarefas').fill('Hábitos');
  await page.getByRole('dialog').getByRole('button', { name: 'Hábitos', exact: true }).click();
  await page.getByLabel('Nome do hábito').fill('Ler por 20 minutos');
  await page.getByRole('button', { name: 'Criar hábito' }).click();
  await page.getByRole('button', { name: `Ler por 20 minutos, ${today}`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Ler por 20 minutos, ${today}`, exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'docs/screenshots/habitos.png' });
  await page.getByRole('button', { name: 'Foco', exact: true }).click();
  await page.getByLabel('Tarefa em foco').selectOption(w.tasks[1].id);
  await page.getByRole('button', { name: 'Iniciar foco', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/foco.png' });
  await page.getByRole('button', { name: 'Calendário', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/calendario.png' });
  await page.getByRole('button', { name: 'Alternar tema' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /^Todas as tarefas/ }).click();
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/escuro.png' });
  await page.setViewportSize({ width: 800, height: 700 });
  await page.getByRole('button', { name: 'Abrir navegação', exact: true }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.getByRole('button', { name: /^Hoje/ }).click();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
});

test('timer vence uma vez e lembrete indisponível mantém alerta interno', async ({ page }) => {
  const w = emptyWorkspace();
  const instant = new Date('2026-10-06T12:00:00Z');
  const task = { ...newTask('Lembrete local'), reminderAt: '2026-10-06T11:59:00Z' };
  w.tasks = [task];
  w.settings.focusMinutes = 1;
  w.timer = { taskId: task.id, endAt: '2026-10-06T12:01:00Z', duration: 60, remaining: 60 };
  await page.clock.install({ time: instant });
  await page.addInitScript((data) => {
    if (!localStorage.getItem('chrono-browser-preview-v1'))
      localStorage.setItem(
        'chrono-browser-preview-v1',
        JSON.stringify({ data, revision: 0, canUndo: false }),
      );
  }, w);
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Lembrete local');
  await page.getByRole('button', { name: 'Foco', exact: true }).click();
  await page.clock.fastForward(61000);
  await expect(page.getByText('1 sessões concluídas', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Foco', exact: true }).click();
  await expect(page.getByText('1 sessões concluídas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Notificações desktop', { exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Notificações indisponíveis');
  await expect(page.getByLabel('Notificações desktop', { exact: true })).not.toBeChecked();
});

test('criação dentro do projeto vincula modal, captura e Kanban sem vazar contexto', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await page.getByLabel('Nome do projeto', { exact: true }).fill('Estudos');
  await page.getByRole('button', { name: 'Criar projeto', exact: true }).click();
  await page.getByRole('button', { name: /^Estudos/ }).click();
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova tarefa' });
  await expect(dialog.getByText('Projeto:', { exact: false })).toContainText('Estudos');
  await dialog.getByLabel('Título da tarefa', { exact: true }).fill('Tarefa do modal');
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tarefa do modal', exact: true })).toBeVisible();
  await page.getByLabel('Captura rápida').fill('Captura no projeto');
  await page.getByLabel('Captura rápida').press('Enter');
  await expect(page.getByRole('button', { name: 'Captura no projeto', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await page.getByRole('button', { name: 'Nova tarefa em Pendentes', exact: true }).click();
  await dialog.getByLabel('Título da tarefa', { exact: true }).fill('Cartão do projeto');
  await dialog.getByRole('button', { name: 'Criar tarefa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cartão do projeto', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Estudos/ }).click();
  await expect(page.locator('.task-card')).toHaveCount(3);
  await page.getByRole('button', { name: /^Inbox/ }).click();
  await page.keyboard.press('n');
  await dialog.getByRole('button', { name: 'Datas, prioridade e outros detalhes' }).click();
  await expect(dialog.getByRole('combobox', { name: 'Projeto', exact: true })).toHaveValue('');
});

