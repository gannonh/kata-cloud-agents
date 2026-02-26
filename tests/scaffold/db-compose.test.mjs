import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('containers/docker-compose.yml'), 'compose file missing');
const compose = fs.readFileSync('containers/docker-compose.yml', 'utf8');

assert.match(compose, /postgres:/, 'postgres service missing');
assert.match(compose, /redis:/, 'redis service missing');
assert.match(compose, /127\.0\.0\.1:5432:5432/, 'postgres port must bind to localhost');
assert.match(compose, /127\.0\.0\.1:6379:6379/, 'redis port must bind to localhost');
assert.match(compose, /healthcheck:/, 'healthcheck missing');
assert.match(compose, /pg_isready/, 'postgres healthcheck must use pg_isready');
assert.match(compose, /redis-cli/, 'redis healthcheck must use redis-cli');

assert.ok(fs.existsSync('packages/db/.env.example'), '.env example missing');
