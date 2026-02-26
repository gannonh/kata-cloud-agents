import assert from 'node:assert/strict';
import fs from 'node:fs';

const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.ok(rootPkg.scripts.check, 'root check script missing');

const turbo = JSON.parse(fs.readFileSync('turbo.json', 'utf8'));
for (const task of ['build', 'lint', 'typecheck', 'test']) {
  assert.ok(turbo.tasks[task], `turbo task missing: ${task}`);
}

const workspacePackages = [
  'apps/web/package.json',
  'apps/mobile/package.json',
  'apps/desktop/package.json',
  'packages/ui/package.json',
  'packages/shared/package.json',
  'agents/coordinator/package.json',
  'agents/specialist/package.json',
  'agents/verifier/package.json',
];

for (const path of workspacePackages) {
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const script of ['build', 'lint', 'typecheck', 'test']) {
    assert.ok(pkg.scripts?.[script], `${path} missing ${script} script`);
  }
}
