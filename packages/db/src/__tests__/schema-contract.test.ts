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

  it('uses convex client helpers instead of postgres', () => {
    const clientSource = fs.readFileSync(path.join(packageRoot, 'src/client.ts'), 'utf8');

    expect(clientSource).not.toContain('new pg.Pool');
    expect(clientSource).not.toContain('drizzle(');
    expect(clientSource).toContain('getConvexClientConfig');
  });

  it('exports convex schema contract instead of drizzle bindings', () => {
    const schemaSource = fs.readFileSync(path.join(packageRoot, 'src/schema.ts'), 'utf8');

    expect(schemaSource).not.toContain('drizzle-orm');
    expect(schemaSource).toContain('convexTables');
  });

  it('keeps convex table lists in sync between src and convex dirs', async () => {
    const srcSchema = await import('../schema.js');
    const convexSchema = await import('../../convex/schema.js');
    expect([...srcSchema.convexTables]).toEqual([...convexSchema.convexTables]);
  });
});

describe('convex schema subpath export', () => {
  it('exports convexTables and ConvexDocument from ./schema', async () => {
    const schemaModule = await import('../schema.js');
    expect(schemaModule.convexTables).toBeDefined();
    expect(Array.isArray(schemaModule.convexTables)).toBe(true);
    expect(schemaModule.convexTables.length).toBeGreaterThan(0);
  });
});

describe('getConvexClientConfig', () => {
  it('returns both values when set', async () => {
    const { getConvexClientConfig } = await import('../client.js');
    const env = { CONVEX_DEPLOYMENT: 'dev:abc', CONVEX_URL: 'https://abc.convex.cloud' };
    const config = getConvexClientConfig(env as unknown as NodeJS.ProcessEnv);
    expect(config).toEqual({ deployment: 'dev:abc', url: 'https://abc.convex.cloud' });
  });

  it('returns undefined values when env is empty', async () => {
    const { getConvexClientConfig } = await import('../client.js');
    const config = getConvexClientConfig({} as unknown as NodeJS.ProcessEnv);
    expect(config).toEqual({ deployment: undefined, url: undefined });
  });

  it('returns partial config when only one var is set', async () => {
    const { getConvexClientConfig } = await import('../client.js');
    const env = { CONVEX_DEPLOYMENT: 'dev:abc' };
    const config = getConvexClientConfig(env as unknown as NodeJS.ProcessEnv);
    expect(config.deployment).toBe('dev:abc');
    expect(config.url).toBeUndefined();
  });
});

describe('hasConvexClientConfig', () => {
  it('returns false when neither var is set', async () => {
    const { hasConvexClientConfig } = await import('../client.js');
    expect(hasConvexClientConfig({} as unknown as NodeJS.ProcessEnv)).toBe(false);
  });

  it('returns true when only CONVEX_DEPLOYMENT is set', async () => {
    const { hasConvexClientConfig } = await import('../client.js');
    const env = { CONVEX_DEPLOYMENT: 'dev:abc' };
    expect(hasConvexClientConfig(env as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it('returns true when only CONVEX_URL is set', async () => {
    const { hasConvexClientConfig } = await import('../client.js');
    const env = { CONVEX_URL: 'https://abc.convex.cloud' };
    expect(hasConvexClientConfig(env as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it('returns false when vars are empty strings', async () => {
    const { hasConvexClientConfig } = await import('../client.js');
    const env = { CONVEX_DEPLOYMENT: '', CONVEX_URL: '' };
    expect(hasConvexClientConfig(env as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
