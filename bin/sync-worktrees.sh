#!/usr/bin/env bash
set -euo pipefail

MAIN_DIR="/Users/gannonhall/dev/kata/kata-cloud-agents"
WT_DIR="/Users/gannonhall/dev/kata/kata-cloud-agents.worktrees"

# Discover all worktree directories automatically (bash 3.2 compatible)
WORKTREES=()
while IFS= read -r dir; do
  WORKTREES+=("$(basename "$dir")")
done < <(find "$WT_DIR" -mindepth 1 -maxdepth 1 -type d -name 'wt-*' | sort)

errors=0

die() { echo "FATAL: $*" >&2; exit 1; }
warn() { echo "ERROR: $*" >&2; errors=$((errors + 1)); }

# -- Step 1: Switch main checkout to main and pull -----------------------
echo "==> Switching $MAIN_DIR to main"
if ! git -C "$MAIN_DIR" switch main 2>&1; then
  die "switch to main failed"
fi

echo "==> Pulling main"
if ! git -C "$MAIN_DIR" pull --ff-only origin main 2>&1; then
  die "pull failed"
fi

target_sha=$(git -C "$MAIN_DIR" rev-parse HEAD)
echo "    main is at ${target_sha:0:7}"

# -- Step 2: Switch each worktree to its standby branch and pull ---------
for wt in "${WORKTREES[@]}"; do
  wt_path="$WT_DIR/$wt"
  branch="${wt}-standby"

  if [ ! -d "$wt_path" ]; then
    warn "$wt: directory not found"
    continue
  fi

  if ! git -C "$wt_path" diff --quiet || ! git -C "$wt_path" diff --cached --quiet; then
    warn "$wt: has uncommitted changes - skipping"
    continue
  fi

  if ! git -C "$wt_path" show-ref --verify --quiet "refs/heads/$branch"; then
    warn "$wt: branch '$branch' not found - skipping"
    continue
  fi

  current=$(git -C "$wt_path" branch --show-current)
  if [ "$current" != "$branch" ]; then
    echo "==> Switching $wt to $branch"
    if ! git -C "$wt_path" switch "$branch" 2>&1; then
      warn "$wt: switch failed"
      continue
    fi
  fi

  echo "==> Pulling $wt"
  if ! git -C "$wt_path" pull --ff-only 2>&1; then
    warn "$wt: pull failed"
    continue
  fi

  wt_sha=$(git -C "$wt_path" rev-parse HEAD)
  if [ "$wt_sha" != "$target_sha" ]; then
    warn "$wt: expected ${target_sha:0:7} but got ${wt_sha:0:7}"
  else
    echo "    $wt now at ${target_sha:0:7}"
  fi
done

# -- Summary --------------------------------------------------------------
echo ""
if [ "$errors" -gt 0 ]; then
  echo "FAILED: $errors error(s) above. Fix them before starting work."
  exit 1
else
  echo "All worktrees switched to standby and synced to main (${target_sha:0:7})."
fi
