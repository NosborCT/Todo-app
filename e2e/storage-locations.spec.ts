import { test, expect } from '@playwright/test';
import { emptyWorkspace } from '../src/domain/task';

test('pastas: cancelar, recuperar falha, alterar independentemente e reabrir', async ({ page }) => {
  // Native filesystem behavior is covered by Rust tests; this mocks only IPC.
  await page.addInitScript((data) => {
    let locations = JSON.parse(localStorage.getItem('test-locations') || 'null') || {
      dataDir: 'C:\\Chrono',
      backupDir: 'C:\\Chrono\\backups',
    };
    let chosen: string | null = null;
    let fail = false;
    window.addEventListener('choose-test-folder', (e) => {
      chosen = (e as CustomEvent).detail;
    });
    window.addEventListener('fail-test-migration', () => {
      fail = true;
    });
    const loaded = () => ({
      data,
      revision: 0,
      canUndo: false,
      warning: null,
      dataPath: locations.dataDir + '\\todo.db',
    });
    Object.assign(window, {
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (cmd: string, args: Record<string, string> = {}) => {
          if (cmd === 'load_workspace') return loaded();
          if (cmd === 'storage_locations') return { ...locations };
          if (cmd === 'pick_storage_folder') return chosen;
          if (cmd === 'change_storage_location') {
            if (fail) {
              fail = false;
              throw new Error('Sem acesso de escrita à pasta');
            }
            locations = {
              ...locations,
              [args.kind === 'data' ? 'dataDir' : 'backupDir']: args.folder,
            };
            localStorage.setItem('test-locations', JSON.stringify(locations));
            return loaded();
          }
          throw new Error(`IPC inesperado: ${cmd}`);
        },
      },
    });
  }, emptyWorkspace());
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  const section = page.locator('.storage-locations');
  await expect(section).toContainText('C:\\Chrono\\backups');
  await section.getByRole('button', { name: 'Alterar pasta dos dados' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('choose-test-folder', { detail: 'D:\\Meus dados' })),
  );
  await section.getByRole('button', { name: 'Alterar pasta dos dados' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('D:\\Meus dados');
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(section).not.toContainText('D:\\Meus dados');
  await section.getByRole('button', { name: 'Alterar pasta dos dados' }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('fail-test-migration')));
  await dialog.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Sem acesso');
  await expect(section).toContainText('C:\\Chrono\\backups');
  await dialog.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(section).toContainText('D:\\Meus dados');
  await expect(section).toContainText('C:\\Chrono\\backups');
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('choose-test-folder', { detail: 'E:\\Backups Chrono' })),
  );
  await section.getByRole('button', { name: 'Alterar pasta dos backups' }).click();
  await dialog.getByRole('button', { name: 'Confirmar alteração' }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(section).toContainText('D:\\Meus dados');
  await expect(section).toContainText('E:\\Backups Chrono');
  await page.screenshot({ path: 'docs/screenshots/armazenamento.png', fullPage: true });
});

test('prévia web explica a disponibilidade somente no desktop', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Configurações', exact: true }).click();
  await expect(
    page.getByText('Alterar as pastas de dados e backups está disponível no aplicativo desktop.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Alterar pasta dos dados' })).toHaveCount(0);
});
