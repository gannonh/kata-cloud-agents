import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/infra-adapters/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/infra-adapters');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.dependencies.dockerode, 'dockerode dependency missing');
assert.equal(pkg.dependencies?.['@kata/spec-engine'], undefined, 'must not depend on spec-engine');
assert.ok(fs.existsSync('packages/infra-adapters/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/infra-adapters/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/infra-adapters/src/index.ts'), 'index file missing');
