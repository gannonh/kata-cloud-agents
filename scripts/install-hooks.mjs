import { execFileSync } from 'node:child_process';

function canConfigureHooks() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

if (!canConfigureHooks()) {
  console.log('Skipping hooks install: not inside a git worktree.');
  process.exit(0);
}

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
  stdio: 'ignore',
});

console.log('Configured git hooks path to .githooks');
