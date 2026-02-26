/** Eagerly connects to PostgreSQL on import. Requires DATABASE_URL.
 *  Import @kata/db for schema-only access without side effects. */
import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

loadEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new pg.Pool({ connectionString });
export const db = drizzle(pool, { schema });
