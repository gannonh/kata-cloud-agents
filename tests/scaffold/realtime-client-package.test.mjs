import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkgPath = 'packages/realtime-client/package.json';
assert.ok(fs.existsSync(pkgPath), 'realtime-client package.json missing');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

assert.equal(pkg.name, '@kata/realtime-client');
assert.equal(pkg.type, 'module');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(fs.existsSync('packages/realtime-client/src/index.ts'), 'src/index.ts missing');
