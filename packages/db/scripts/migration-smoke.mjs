import { config as loadEnv } from 'dotenv';
import pg from 'pg';

loadEnv();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new pg.Pool({ connectionString });

// Must match table names defined in src/schema.ts
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

try {
  const result = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `);

  const actual = new Set(result.rows.map((row) => row.table_name));

  if (actual.size === 0) {
    throw new Error(
      'no tables found in public schema -- verify migrations ran and DATABASE_URL points to the correct database',
    );
  }

  for (const table of expected) {
    if (!actual.has(table)) {
      throw new Error(`missing table after migration: ${table}`);
    }
  }

  console.log('migration smoke check passed');
} catch (error) {
  console.error('smoke check failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
