# AGENTS

## Project Management

Linear is the single source of truth for all project management: task priority, execution order, blockers, status, and acceptance criteria.

- Linear Project: https://linear.app/kata-sh/project/kata-cloud-agents-7411e78299bf/overview
- Use the `/kata-linear` skill for ticket lifecycle (start, end, next). Use `/linear` for general Linear queries.
- Always pass `includeRelations: true` when calling `get_issue` to see blocking dependencies.
- Always reference the attached media as the source of truth for design specs and mocks.

## Worktrees

Git worktrees are used to manage multiple concurrent branches:

- Main workspace: `../kata-cloud-agents` (Used for coordination only - main branch protected)
  - Worktrees:
    - `../kata-cloud-agents.worktrees/wt-a`
    - `../kata-cloud-agents.worktrees/wt-b`
    - `../kata-cloud-agents.worktrees/wt-c`