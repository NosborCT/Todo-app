import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';
const run = (args) => spawnSync(npm, args, { stdio: 'inherit', shell: windows });
const stamp = 'node_modules/.chrono-lock';
const hash = createHash('sha256').update(readFileSync('package-lock.json')).digest('hex');
if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== hash) {
  console.log('Preparando as dependências do Chrono…');
  const result = run(['ci']);
  if (result.status !== 0) process.exit(result.status || 1);
  writeFileSync(stamp, hash);
}
const result = run(['run', 'tauri', 'dev']);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
