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

// Foreign key cascade behaviors
assert.ok(
  (sql.match(/ON DELETE cascade/gi) || []).length >= 9,
  'expected at least 9 cascade FK constraints',
);
assert.ok(
  (sql.match(/ON DELETE restrict/gi) || []).length >= 2,
  'expected at least 2 restrict FK constraints (specs.created_by, api_keys.created_by)',
);
assert.ok(
  (sql.match(/ON DELETE set null/gi) || []).length >= 2,
  'expected at least 2 set null FK constraints (tasks.agent_run_id, audit_log.agent_run_id)',
);

// Indexes
for (const idx of [
  'agent_runs_spec_id_idx',
  'api_keys_team_id_idx',
  'api_keys_created_by_idx',
  'artifacts_agent_run_id_idx',
  'audit_log_team_id_idx',
  'spec_versions_spec_id_idx',
  'specs_team_id_idx',
  'tasks_spec_id_idx',
  'tasks_agent_run_id_idx',
  'team_members_team_id_idx',
]) {
  assert.match(sql, new RegExp(idx), `missing index: ${idx}`);
}

// Unique constraints
assert.match(sql, /users_email_unique/i, 'missing users email unique constraint');
assert.match(sql, /teams_slug_unique/i, 'missing teams slug unique constraint');
assert.match(sql, /api_keys_key_hash_unique/i, 'missing api_keys key_hash unique constraint');
assert.match(sql, /spec_versions_spec_id_version_number_key/i, 'missing spec_versions compound unique');
