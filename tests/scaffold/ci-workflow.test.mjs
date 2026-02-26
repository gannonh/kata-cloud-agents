import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
assert.match(workflow, /pull_request:/, 'PR trigger missing');
assert.match(workflow, /push:/, 'push trigger missing');
assert.match(workflow, /pnpm install --frozen-lockfile/, 'frozen install missing');
assert.match(workflow, /pnpm lint/, 'lint command missing');
assert.match(workflow, /pnpm typecheck/, 'typecheck command missing');
assert.match(workflow, /pnpm test/, 'test command missing');
assert.match(workflow, /pnpm build/, 'build command missing');
assert.match(workflow, /pnpm coverage/, 'coverage gate command missing');
assert.match(workflow, /playwright install --with-deps chromium/, 'playwright browser install missing');
assert.match(workflow, /pnpm test:e2e/, 'e2e command missing');
