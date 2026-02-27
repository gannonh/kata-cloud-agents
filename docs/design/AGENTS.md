# AGENTS Addendum (docs/design)

## Pencil <-> Code Workflow

Use this process for UI work so design and implementation stay in sync:

1. Start from code truth in `apps/desktop` and pick one page/surface at a time.
2. Mirror that surface in Pencil using existing design system components.
3. Compare Pencil screenshot to the running UI and fix visual deltas immediately.
4. Treat approved Pencil output as the visual contract.
5. Implement the same delta in code, then re-check parity.
6. Do not batch many pages at once; finish and lock each page before moving on.

Scope ownership:
- Pencil owns layout, spacing, typography, and visual states.
- Code owns behavior, data, routing, and accessibility behavior.
