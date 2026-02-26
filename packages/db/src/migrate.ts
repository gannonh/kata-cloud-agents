import { config as loadEnv } from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

loadEnv();

await migrate(db, { migrationsFolder: 'drizzle' });
await pool.end();
