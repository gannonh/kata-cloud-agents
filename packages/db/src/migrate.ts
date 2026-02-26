import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './client.js';

try {
  await migrate(db, { migrationsFolder: 'drizzle' });
} catch (error) {
  console.error('migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
