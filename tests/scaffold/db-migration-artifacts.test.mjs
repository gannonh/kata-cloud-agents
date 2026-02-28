import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('packages/db/convex'), 'convex source directory missing');
assert.ok(fs.existsSync('packages/db/convex/schema.ts'), 'convex schema file missing');
assert.ok(fs.existsSync('packages/db/convex/http.ts'), 'convex http file missing');

const schemaSource = fs.readFileSync('packages/db/convex/schema.ts', 'utf8');
for (const table of ['users', 'teams', 'teamMembers', 'specs', 'specVersions', 'agentRuns', 'tasks', 'artifacts', 'auditLog', 'apiKeys']) {
  assert.match(schemaSource, new RegExp(`'${table}'`), `convex schema missing table: ${table}`);
}

assert.ok(!fs.existsSync('packages/db/drizzle.config.ts'), 'drizzle config should be removed');
assert.ok(!fs.existsSync('packages/db/drizzle'), 'drizzle output directory should be removed');
