import { describe, expect, test } from 'vitest';

import {
  WorkspaceSchema,
  deriveWorkspaceBranchName,
  isGitHubRepoUrl,
} from '../../../apps/desktop/src/types/workspace';

describe('workspace domain contract', () => {
  test('accepts local and github sources', () => {
    expect(
      WorkspaceSchema.parse({
        id: 'ws_1',
        name: 'KAT-154 UI',
        sourceType: 'local',
        source: '/Users/me/dev/repo',
        repoRootPath: '/Users/me/dev/repo',
        worktreePath: '/Users/me/dev/repo.worktrees/kat-154-ui',
        branch: 'workspace/kat-154-ui-ws1',
        status: 'ready',
        createdAt: '2026-02-28T00:00:00.000Z',
        updatedAt: '2026-02-28T00:00:00.000Z',
      }),
    ).toBeTruthy();
  });

  test('validates github URLs and branch slugging', () => {
    expect(isGitHubRepoUrl('https://github.com/org/repo')).toBe(true);
    expect(isGitHubRepoUrl('https://gitlab.com/org/repo')).toBe(false);
    expect(deriveWorkspaceBranchName('KAT-154 Workspace', 'ab12')).toBe(
      'workspace/kat-154-workspace-ab12',
    );
  });
});
