import { cp, mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Restore the explicitly exported fictional examples into an empty hosted filesystem.
// Never reset or overwrite saved work, including when this script is run locally.
const seed = path.resolve('hosting/presentation-seed');
const target = path.resolve(process.env.CLAIR_V32_DATA_DIR || 'data/questionnaire-v32');
await mkdir(target, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(seed, 'manifest.json'), 'utf8'));
for (const id of manifest.ids) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid seed ID');
  await cp(path.join(seed, id + '.json'), path.join(target, id + '.json'), { force: false });
  const sourceReports = path.join(seed, 'reports', id);
  const reports = path.join(target, 'reports', id);
  await mkdir(reports, { recursive: true });
  for (const file of await readdir(sourceReports)) {
    await cp(path.join(sourceReports, file), path.join(reports, file), { force: false });
  }
}
console.log(`Presentation examples ready (${manifest.ids.length}); existing work preserved.`);
if (!process.argv.includes('--seed-only')) {
  const port = process.env.PORT || '3000';
  if (!/^\d+$/.test(port)) throw new Error('Invalid PORT');
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0', '--port', port],
    { stdio: 'inherit', env: process.env },
  );
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
