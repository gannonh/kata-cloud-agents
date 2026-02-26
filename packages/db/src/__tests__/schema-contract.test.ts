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
});
