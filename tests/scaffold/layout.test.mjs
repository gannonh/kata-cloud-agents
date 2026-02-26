import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredDirs = [
  'apps/desktop',
  'apps/web',
  'apps/mobile',
  'packages/ui',
  'packages/spec-engine',
  'packages/dispatcher',
  'packages/agent-runtime',
  'packages/infra-adapters',
  'packages/governance',
  'packages/gateway',
  'packages/db',
  'packages/shared',
  'agents/coordinator',
  'agents/specialist',
  'agents/verifier',
  'containers',
  'infrastructure',
];

for (const dir of requiredDirs) {
  assert.ok(fs.existsSync(dir), `missing directory: ${dir}`);
}

const pkgNames = [
  ['apps/desktop/package.json', '@kata/desktop'],
  ['apps/web/package.json', '@kata/web'],
  ['apps/mobile/package.json', '@kata/mobile'],
  ['packages/ui/package.json', '@kata/ui'],
  ['packages/shared/package.json', '@kata/shared'],
];

for (const [file, name] of pkgNames) {
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(pkg.name, name, `${file} has wrong package name`);
}
