import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkgPath = new URL('../../package.json', import.meta.url);
assert.ok(fs.existsSync(pkgPath), 'package.json must exist');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
assert.equal(pkg.private, true, 'root package must be private');
assert.match(pkg.packageManager, /^pnpm@\d+\.\d+\.\d+$/);
assert.ok(pkg.scripts.build, 'root build script missing');
assert.ok(pkg.scripts.lint, 'root lint script missing');
assert.ok(pkg.scripts.typecheck, 'root typecheck script missing');
assert.ok(pkg.scripts.test, 'root test script missing');

const workspace = fs.readFileSync(new URL('../../pnpm-workspace.yaml', import.meta.url), 'utf8');
assert.match(workspace, /apps\/\*/, 'apps workspace missing');
assert.match(workspace, /packages\/\*/, 'packages workspace missing');
assert.match(workspace, /agents\/\*/, 'agents workspace missing');

const turbo = JSON.parse(fs.readFileSync(new URL('../../turbo.json', import.meta.url), 'utf8'));
assert.ok(turbo.tasks.build, 'turbo build task missing');
assert.ok(turbo.tasks.lint, 'turbo lint task missing');
assert.ok(turbo.tasks.typecheck, 'turbo typecheck task missing');
assert.ok(turbo.tasks.test, 'turbo test task missing');
