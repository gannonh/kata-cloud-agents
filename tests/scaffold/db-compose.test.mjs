import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('containers/docker-compose.yml'), 'compose file missing');
const compose = fs.readFileSync('containers/docker-compose.yml', 'utf8');

assert.match(compose, /postgres:/, 'postgres service missing');
assert.match(compose, /redis:/, 'redis service missing');
assert.match(compose, /5432:5432/, 'postgres port missing');
assert.match(compose, /6379:6379/, 'redis port missing');
assert.match(compose, /healthcheck:/, 'healthcheck missing');

assert.ok(fs.existsSync('packages/db/.env.example'), '.env example missing');
