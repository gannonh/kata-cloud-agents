import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('containers/docker-compose.yml'), 'compose file missing');
const compose = fs.readFileSync('containers/docker-compose.yml', 'utf8');

assert.match(compose, /redis:/, 'redis service missing');
assert.doesNotMatch(compose, /postgres:/, 'postgres service should be removed');
assert.match(compose, /127\.0\.0\.1:6379:6379/, 'redis port must bind to localhost');
assert.match(compose, /healthcheck:/, 'healthcheck missing');
assert.match(compose, /redis-cli/, 'redis healthcheck must use redis-cli');

assert.ok(fs.existsSync('packages/db/.env.example'), '.env example missing');
const envExample = fs.readFileSync('packages/db/.env.example', 'utf8');
assert.match(envExample, /CONVEX_DEPLOYMENT=/, 'CONVEX_DEPLOYMENT example missing');
assert.match(envExample, /CONVEX_URL=/, 'CONVEX_URL example missing');
