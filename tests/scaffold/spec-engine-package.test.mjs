import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const pkg = JSON.parse(fs.readFileSync('packages/spec-engine/package.json', 'utf8'));
const sharedPkg = JSON.parse(fs.readFileSync('packages/shared/package.json', 'utf8'));

assert.equal(pkg.name, '@kata/spec-engine');
assert.ok(pkg.scripts.build, 'build script missing');
assert.ok(pkg.scripts.typecheck, 'typecheck script missing');
assert.ok(pkg.scripts.test, 'test script missing');
assert.ok(pkg.dependencies['@kata/shared'], '@kata/shared dependency missing');
assert.ok(pkg.dependencies.yaml, 'yaml dependency missing');
assert.ok(fs.existsSync('packages/spec-engine/tsconfig.json'), 'tsconfig missing');
assert.ok(fs.existsSync('packages/spec-engine/vitest.config.ts'), 'vitest config missing');
assert.ok(fs.existsSync('packages/spec-engine/src/index.ts'), 'index.ts missing');
assert.equal(sharedPkg.exports['.'].import, './dist/index.js', '@kata/shared import export must target dist');
assert.equal(sharedPkg.exports['.'].types, './src/index.ts', '@kata/shared types export should target source');

execFileSync('pnpm', ['--filter', '@kata/spec-engine', 'build'], { stdio: 'pipe' });
await import(pathToFileURL(path.resolve('packages/spec-engine/dist/index.js')).href);
