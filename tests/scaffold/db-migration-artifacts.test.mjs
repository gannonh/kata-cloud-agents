import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('packages/db/convex'), 'convex source directory missing');
assert.ok(fs.existsSync('packages/db/convex/schema.ts'), 'convex schema file missing');
assert.ok(fs.existsSync('packages/db/convex/http.ts'), 'convex http file missing');

assert.ok(!fs.existsSync('packages/db/drizzle.config.ts'), 'drizzle config should be removed');
assert.ok(!fs.existsSync('packages/db/drizzle'), 'drizzle output directory should be removed');
