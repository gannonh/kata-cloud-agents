import { describe, expect, test } from 'vitest';

import {
  buildDefaultCloneLocation,
  deriveNameFromRepoPath,
  deriveNameFromRepoUrl,
  deriveNameFromRepositoryInput,
  deriveUniqueWorkspaceName,
  normalizeSearchTokens,
  rankRepos,
  repoMatchScore,
} from '../../../apps/desktop/src/pages/Workspaces';
import { toErrorMessage } from '../../../apps/desktop/src/store/workspaces';
import type { Workspace } from '../../../apps/desktop/src/types/workspace';
import type { GitHubRepoOption } from '../../../apps/desktop/src/services/workspaces/types';

function workspace(name: string): Workspace {
  return {
    id: `ws_${name.toLowerCase()}`,
    name,
    sourceType: 'local',
    source: `/tmp/${name}`,
    repoRootPath: `/tmp/${name}`,
    worktreePath: `/tmp/${name}.worktrees`,
    branch: `workspace/${name.toLowerCase()}`,
    status: 'ready',
    createdAt: '2026-02-28T00:00:00.000Z',
    updatedAt: '2026-02-28T00:00:00.000Z',
  };
}

describe('workspaces helper functions', () => {
  test('derives names from local paths and URLs', () => {
    expect(deriveNameFromRepoPath('/tmp/repo/')).toBe('repo');
    expect(deriveNameFromRepoPath(' /tmp/repo-two ')).toBe('repo-two');
    expect(deriveNameFromRepoPath('/')).toBe('Workspace');

    expect(deriveNameFromRepoUrl('https://github.com/org/repo.git')).toBe('repo');
    expect(deriveNameFromRepoUrl('https://github.com/org/')).toBe('org');
    expect(deriveNameFromRepoUrl('not-a-url')).toBe('Workspace');
  });

  test('derives names from repository inputs and clone locations', () => {
    expect(deriveNameFromRepositoryInput('owner/repo.git')).toBe('repo');
    expect(deriveNameFromRepositoryInput('repo-only')).toBe('repo-only');
    expect(deriveNameFromRepositoryInput('   ')).toBe('Workspace');
    expect(buildDefaultCloneLocation('/Users/me/')).toBe('/Users/me/kata/repos');
  });

  test('builds unique workspace names with suffixes', () => {
    expect(deriveUniqueWorkspaceName('KAT-154', [workspace('Other')])).toBe('KAT-154');
    expect(deriveUniqueWorkspaceName('KAT-154', [workspace('KAT-154')])).toBe('KAT-154 2');
    expect(
      deriveUniqueWorkspaceName('KAT-154', [
        workspace('KAT-154'),
        workspace('KAT-154 2'),
        workspace('KAT-154 3'),
      ]),
    ).toBe('KAT-154 4');
    expect(deriveUniqueWorkspaceName('   ', [workspace('Workspace')])).toBe('Workspace 2');
  });

  test('normalizes search tokens and scores repository matches', () => {
    const repo: GitHubRepoOption = {
      nameWithOwner: 'kata-sh/kat-154',
      url: 'https://github.com/kata-sh/kat-154',
      isPrivate: true,
      updatedAt: '2026-02-28T00:00:00.000Z',
    };

    expect(normalizeSearchTokens('  kat   154 ')).toEqual(['kat', '154']);
    expect(repoMatchScore(repo, '')).toBe(1);
    expect(repoMatchScore(repo, 'missing')).toBe(0);
    expect(repoMatchScore(repo, 'kata-sh/kat-154')).toBeGreaterThan(100);
    expect(repoMatchScore(repo, 'kata')).toBeGreaterThan(0);
    expect(repoMatchScore(repo, 'kata-sh')).toBeGreaterThan(0);
    expect(repoMatchScore(repo, 'https://github.com/kata-sh/kat-154')).toBeGreaterThan(100);
    expect(repoMatchScore(repo, 'https://')).toBeGreaterThan(0);
  });

  test('ranks repos by score and freshness when ties occur', () => {
    const repos: GitHubRepoOption[] = [
      {
        nameWithOwner: 'org/repo-one',
        url: 'https://github.com/org/repo-one',
        isPrivate: true,
        updatedAt: '2026-02-27T00:00:00.000Z',
      },
      {
        nameWithOwner: 'org/repo-two',
        url: 'https://github.com/org/repo-two',
        isPrivate: true,
        updatedAt: '2026-02-28T00:00:00.000Z',
      },
    ];

    expect(rankRepos(repos, 'repo').map((repo) => repo.nameWithOwner)).toEqual([
      'org/repo-two',
      'org/repo-one',
    ]);

    const uneven = rankRepos(
      [
        {
          nameWithOwner: 'alpha/repo',
          url: 'https://github.com/alpha/repo',
          isPrivate: true,
          updatedAt: '2026-02-26T00:00:00.000Z',
        },
        {
          nameWithOwner: 'beta/other',
          url: 'https://github.com/beta/other-repo',
          isPrivate: true,
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
      ],
      'repo',
    );
    expect(uneven[0]?.nameWithOwner).toBe('alpha/repo');
  });

  test('extracts user-friendly error messages from various shapes', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
    expect(toErrorMessage('failure')).toBe('failure');
    expect(toErrorMessage({ message: 'msg' })).toBe('msg');
    expect(toErrorMessage({ error: 'nested-string' })).toBe('nested-string');
    expect(toErrorMessage({ error: { message: 'nested-object' } })).toBe('nested-object');
    expect(toErrorMessage(null)).toBe('Unexpected error');
    expect(toErrorMessage({})).toBe('Unexpected error');
    expect(toErrorMessage('')).toBe('Unexpected error');
  });
});
