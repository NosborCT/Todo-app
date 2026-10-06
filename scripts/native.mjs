// Prepare local build tools, then run the native command. No global installation.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, delimiter, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
const env = { ...process.env };
const windows = process.platform === 'win32';
if (windows) {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path');
  const originalPath = pathKey ? env[pathKey] : '';
  if (pathKey && pathKey !== 'PATH') delete env[pathKey];
  env.PATH = originalPath;
  const vswhere = `${env['ProgramFiles(x86)'] || 'C:/Program Files (x86)'}/Microsoft Visual Studio/Installer/vswhere.exe`;
  if (existsSync(vswhere)) {
    const result = spawnSync(
      vswhere,
      [
        '-latest',
        '-products',
        '*',
        '-find',
        'Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    const cmake = result.stdout?.trim().split(/\r?\n/)[0];
    if (cmake && existsSync(cmake)) env.PATH = `${dirname(cmake)}${delimiter}${env.PATH || ''}`;
  }
  if (!env.LIBCLANG_PATH) {
    const global = 'C:/Program Files/LLVM/bin';
    const local = resolve('.tools/libclang/libclang-18.1.1.data/platlib/clang/native');
    if (existsSync(`${global}/libclang.dll`)) env.LIBCLANG_PATH = global;
    else {
      if (!existsSync(`${local}/libclang.dll`)) {
        console.log('Preparando libclang 18.1.1 localmente (somente na primeira compilação)…');
        mkdirSync('.tools', { recursive: true });
        const zip = resolve('.tools/libclang.zip');
        const url =
          'https://files.pythonhosted.org/packages/0b/2d/3f480b1e1d31eb3d6de5e3ef641954e5c67430d5ac93b7fa7e07589576c7/libclang-18.1.1-py2.py3-none-win_amd64.whl';
        const download = spawnSync(
          'curl.exe',
          [
            '--fail',
            '--location',
            '--connect-timeout',
            '15',
            '--max-time',
            '300',
            '--output',
            zip,
            url,
          ],
          { stdio: 'inherit', windowsHide: true },
        );
        if (download.status !== 0)
          throw new Error('Download do libclang falhou. Verifique a conexão e execute novamente.');
        if (
          createHash('sha256').update(readFileSync(zip)).digest('hex') !==
          '4dd2d3b82fab35e2bf9ca717d7b63ac990a3519c7e312f19fa8e86dcc712f7fb'
        ) {
          unlinkSync(zip);
          throw new Error('Checksum inválido do libclang.');
        }
        // Paths are passed through environment variables, never interpolated into shell code.
        const unpack = spawnSync(
          'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            'Expand-Archive -LiteralPath $env:CHRONO_TOOL_ZIP -DestinationPath $env:CHRONO_TOOL_DEST -Force',
          ],
          {
            stdio: 'inherit',
            windowsHide: true,
            env: { ...env, CHRONO_TOOL_ZIP: zip, CHRONO_TOOL_DEST: resolve('.tools/libclang') },
          },
        );
        if (unpack.status !== 0) throw new Error('Falha ao extrair libclang.');
        unlinkSync(zip);
      }
      env.LIBCLANG_PATH = local;
    }
  }
}
const [kind, ...args] = process.argv.slice(2);
const result =
  kind === 'tauri'
    ? spawnSync(process.execPath, [resolve('node_modules/@tauri-apps/cli/tauri.js'), ...args], {
        stdio: 'inherit',
        env,
      })
    : spawnSync('cargo', args, { stdio: 'inherit', env, cwd: resolve('src-tauri') });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
