import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('root module exports', () => {
  it('keeps @kata/db side-effect free', async () => {
    const previousConvexDeployment = process.env.CONVEX_DEPLOYMENT;
    const previousConvexUrl = process.env.CONVEX_URL;
    delete process.env.CONVEX_DEPLOYMENT;
    delete process.env.CONVEX_URL;

    try {
      const rootModule = await import('../index.js');
      expect(rootModule.getConvexClientConfig).toBeDefined();
      expect(rootModule.hasConvexClientConfig).toBeDefined();
    } finally {
      if (previousConvexDeployment) {
        process.env.CONVEX_DEPLOYMENT = previousConvexDeployment;
      } else {
        delete process.env.CONVEX_DEPLOYMENT;
      }

      if (previousConvexUrl) {
        process.env.CONVEX_URL = previousConvexUrl;
      } else {
        delete process.env.CONVEX_URL;
      }
    }
  });
});

describe('convex scaffold contract', () => {
  const currentFile = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(path.dirname(currentFile), '../..');

  it('adds the expected convex source files', () => {
    expect(fs.existsSync(path.join(packageRoot, 'convex/schema.ts'))).toBe(true);
    expect(fs.existsSync(path.join(packageRoot, 'convex/http.ts'))).toBe(true);
  });

  it('replaces the postgres client with convex helpers', () => {
    const clientSource = fs.readFileSync(path.join(packageRoot, 'src/client.ts'), 'utf8');

    expect(clientSource).not.toContain('new pg.Pool');
    expect(clientSource).not.toContain('drizzle(');
  });
});
