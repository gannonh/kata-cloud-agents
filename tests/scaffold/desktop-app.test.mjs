import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const exists = (path) => fs.existsSync(new URL(path, root));
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

const requiredFiles = [
  'apps/desktop/src-tauri/Cargo.toml',
  'apps/desktop/src-tauri/src/main.rs',
  'apps/desktop/src-tauri/build.rs',
  'apps/desktop/src-tauri/tauri.conf.json',
  'apps/desktop/src/main.tsx',
  'apps/desktop/src/App.tsx',
  'apps/desktop/index.html',
  'apps/desktop/vite.config.ts',
  'apps/desktop/tsconfig.json',
];

for (const file of requiredFiles) {
  assert.ok(exists(file), `missing ${file}`);
}

const desktopPkg = JSON.parse(read('apps/desktop/package.json'));
assert.ok(desktopPkg.scripts['tauri:dev'], 'desktop tauri:dev script missing');
