import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/spec-engine/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/spec-engine');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.dependencies['@kata/shared'], '@kata/shared dependency missing');
assert.ok(pkg.dependencies.yaml, 'yaml dependency missing');
assert.ok(fs.existsSync('packages/spec-engine/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/spec-engine/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/spec-engine/src/index.ts'), 'index.ts missing');
