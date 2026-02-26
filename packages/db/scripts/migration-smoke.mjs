import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new pg.Pool({ connectionString });

const expected = [
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
];

const result = await pool.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
  order by table_name;
`);

const actual = new Set(result.rows.map((row) => row.table_name));
for (const table of expected) {
  if (!actual.has(table)) {
    throw new Error(`missing table after migration: ${table}`);
  }
}

await pool.end();
console.log('migration smoke check passed');
