import { describe, expect, it } from 'vitest';
import {
  teamRoleEnum,
  specStatusEnum,
  agentRunStatusEnum,
  taskStatusEnum,
  users,
  teams,
  teamMembers,
  specs,
  specVersions,
  agentRuns,
  tasks,
  artifacts,
  auditLog,
  apiKeys,
} from '../schema.js';

describe('db enums', () => {
  it('defines expected enum values', () => {
    expect(teamRoleEnum.enumValues).toEqual(['admin', 'member', 'viewer']);
    expect(specStatusEnum.enumValues).toEqual(['draft', 'active', 'paused', 'completed', 'archived']);
    expect(agentRunStatusEnum.enumValues).toEqual(['queued', 'running', 'completed', 'failed', 'cancelled']);
    expect(taskStatusEnum.enumValues).toEqual(['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']);
  });
});

describe('table exports', () => {
  it('exports all required tables', () => {
    expect(users).toBeDefined();
    expect(teams).toBeDefined();
    expect(teamMembers).toBeDefined();
    expect(specs).toBeDefined();
    expect(specVersions).toBeDefined();
    expect(agentRuns).toBeDefined();
    expect(tasks).toBeDefined();
    expect(artifacts).toBeDefined();
    expect(auditLog).toBeDefined();
    expect(apiKeys).toBeDefined();
  });

  it('tables have expected columns', () => {
    const cols = (table: Record<string, unknown>) => Object.keys(table);

    expect(cols(users)).toEqual(expect.arrayContaining(['id', 'email', 'name', 'createdAt']));
    expect(cols(teams)).toEqual(expect.arrayContaining(['id', 'name', 'slug', 'createdAt']));
    expect(cols(teamMembers)).toEqual(expect.arrayContaining(['userId', 'teamId', 'role']));
    expect(cols(specs)).toEqual(
      expect.arrayContaining(['id', 'teamId', 'title', 'content', 'status', 'createdBy', 'createdAt', 'updatedAt']),
    );
    expect(cols(specVersions)).toEqual(
      expect.arrayContaining(['id', 'specId', 'versionNumber', 'content', 'createdAt']),
    );
    expect(cols(agentRuns)).toEqual(
      expect.arrayContaining(['id', 'specId', 'agentRole', 'status', 'environmentId', 'model', 'startedAt', 'completedAt']),
    );
    expect(cols(tasks)).toEqual(
      expect.arrayContaining(['id', 'specId', 'agentRunId', 'title', 'status', 'dependsOn', 'result']),
    );
    expect(cols(artifacts)).toEqual(expect.arrayContaining(['id', 'agentRunId', 'type', 'path', 'metadata']));
    expect(cols(auditLog)).toEqual(
      expect.arrayContaining(['id', 'teamId', 'agentRunId', 'action', 'details', 'timestamp']),
    );
    expect(cols(apiKeys)).toEqual(
      expect.arrayContaining([
        'id', 'teamId', 'name', 'keyHash', 'prefix', 'createdBy',
        'createdAt', 'expiresAt', 'revokedAt', 'lastUsedAt',
      ]),
    );
  });
});

describe('root module exports', () => {
  it('keeps @kata/db side-effect free', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const rootModule = await import('../index.js');
      expect(rootModule.teams).toBeDefined();
      expect(rootModule.db).toBeUndefined();
    } finally {
      if (previousDatabaseUrl) {
        process.env.DATABASE_URL = previousDatabaseUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });
});
