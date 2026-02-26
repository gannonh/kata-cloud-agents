import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

const pkg = JSON.parse(read('apps/mobile/package.json'));
assert.ok(pkg.dependencies?.react, 'mobile app missing react dependency');
assert.ok(pkg.scripts?.dev, 'mobile app missing dev script');

const manifest = JSON.parse(read('apps/mobile/public/manifest.webmanifest'));
assert.equal(manifest.name, 'Kata Cloud Agents Mobile');
assert.equal(manifest.display, 'standalone');
