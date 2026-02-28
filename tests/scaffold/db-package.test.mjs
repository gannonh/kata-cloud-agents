import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('packages/db/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/db');
assert.equal(pkg.type, 'module');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.equal(pkg.scripts['db:dev'], 'convex dev');
assert.equal(pkg.scripts['db:deploy'], 'convex deploy');
assert.equal(pkg.scripts['db:codegen'], 'convex codegen');
assert.equal(pkg.dependencies.convex || pkg.devDependencies?.convex, '^1.32.0');
assert.ok(!pkg.dependencies['drizzle-orm'], 'drizzle-orm should be removed');
assert.ok(!pkg.dependencies.pg, 'pg should be removed');
assert.ok(!pkg.devDependencies['drizzle-kit'], 'drizzle-kit should be removed');
assert.ok(pkg.exports['./schema'], 'schema export missing');
assert.ok(pkg.exports['./client'], 'client export missing');

assert.ok(fs.existsSync('packages/db/tsconfig.json'), 'packages/db/tsconfig.json missing');
assert.ok(fs.existsSync('packages/db/vitest.config.ts'), 'packages/db/vitest.config.ts missing');
assert.ok(fs.existsSync('packages/db/src/index.ts'), 'packages/db/src/index.ts missing');
assert.ok(fs.existsSync('packages/db/convex.json'), 'packages/db/convex.json missing');
