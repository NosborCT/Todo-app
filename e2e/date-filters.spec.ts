import { test, expect } from '@playwright/test';
import { emptyWorkspace, newTask } from '../src/domain/task';

test('intervalo de datas funciona na lista, Kanban e filtro salvo após recarregar', async ({
  page,
}) => {
  const data = emptyWorkspace();
  data.tasks = [
    { ...newTask('Dentro do período'), dueDate: '2026-10-06', startDate: '2026-10-01' },
    { ...newTask('Depois do período'), dueDate: '2026-10-11', startDate: '2026-10-06' },
    newTask('Sem prazo'),
  ];
  await page.addInitScript((data) => {
    if (!localStorage.getItem('chrono-browser-preview-v1'))
      localStorage.setItem(
        'chrono-browser-preview-v1',
        JSON.stringify({ data, revision: 0, canUndo: false }),
      );
  }, data);
  await page.goto('/');
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByLabel('Data de', { exact: true }).fill('2026-10-06');
  await page.getByLabel('Data até', { exact: true }).fill('2026-10-10');
  await expect(page.getByRole('button', { name: 'Dentro do período', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Depois do período', exact: true }),
  ).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Sem prazo', exact: true })).not.toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/filtros-data.png' });
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dentro do período', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar filtro', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Salvar filtro' });
  await dialog.getByRole('textbox').fill('Prazos da semana');
  await dialog.getByRole('button', { name: 'Salvar filtro', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Prazos da semana', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dentro do período', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Depois do período', exact: true }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await expect(page.getByLabel('Data até', { exact: true })).toHaveValue('2026-10-10');
  await page.getByLabel('Tipo de data', { exact: true }).selectOption('startDate');
  await expect(page.getByRole('button', { name: 'Depois do período', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Dentro do período', exact: true }),
  ).not.toBeVisible();
  await page.getByLabel('Data até', { exact: true }).fill('2026-10-05');
  await expect(page.getByRole('alert')).toContainText('anterior ou igual');
  await expect(page.getByRole('button', { name: 'Salvar filtro', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Limpar datas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sem prazo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
});
