import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/gateway/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/gateway');
assert.equal(pkg.type, 'module');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.scripts.dev, 'dev script missing');

assert.ok(pkg.dependencies.hono, 'hono dependency missing');
assert.ok(pkg.dependencies.ioredis, 'ioredis dependency missing');
assert.ok(pkg.dependencies.zod, 'zod dependency missing');
assert.ok(pkg.dependencies['@hono/zod-openapi'], '@hono/zod-openapi dependency missing');

assert.ok(fs.existsSync('packages/gateway/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/gateway/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/gateway/src/index.ts'), 'src/index.ts missing');
assert.ok(fs.existsSync('packages/gateway/.env.example'), '.env example missing');
