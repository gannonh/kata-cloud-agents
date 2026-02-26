import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('packages/db/drizzle.config.ts'), 'drizzle config missing');
assert.ok(fs.existsSync('packages/db/drizzle'), 'drizzle output directory missing');

const files = fs.readdirSync('packages/db/drizzle').filter((f) => f.endsWith('.sql'));
assert.ok(files.length > 0, 'no SQL migration file generated');

const sql = fs.readFileSync(`packages/db/drizzle/${files[0]}`, 'utf8');
for (const table of [
  'users',
  'teams',
  'team_members',
  'specs',
  'spec_versions',
  'agent_runs',
  'tasks',
  'artifacts',
  'audit_log',
  'api_keys',
]) {
  assert.match(sql, new RegExp(`create table\\s+"${table}"`, 'i'), `missing CREATE TABLE for ${table}`);
}
