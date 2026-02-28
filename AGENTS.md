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

## Frontend Delivery Focus

- Follow the project plan sequencing: desktop-first implementation in M0/M1, web parity later.
- Treat `apps/desktop` (Tauri) as the primary product surface for current implementation work.
- Keep `apps/web` as a shell during current milestones; avoid feature expansion there unless explicitly requested for critical maintenance.
- If scope ambiguity exists, verify milestone/issue intent in Linear before implementing cross-surface UI work.

## Frontend Workflow

- Design and interaction specs in Linear-attached media are the source of truth.
- Current experiment: use Pencil MCP for rapid UI exploration/prototyping first, then implement in app code after review.
- Prefer codifying reusable UI in shared packages only when it does not conflict with active milestone sequencing and branch concurrency constraints.

## Private Component Registry (React Source of Truth)

Private shadcn-compatible component registry:
- Repo: `https://github.com/gannonh/kata-shadcn`
- Deploy: `https://shadcn-registry-eight.vercel.app`

Rules:
1. Prefer installing from `@kata-shadcn` before creating new one-off components.
2. Shared component changes belong in `kata-shadcn` (source repo), not in generated downstream copies.
3. Pushing to `main` in `kata-shadcn` triggers Vercel deployment; verify install behavior after deploy.
4. Standardize on registry components/blocks for UI implementation; avoid app-local custom primitives unless no registry option exists.
5. If no suitable component exists, add it to `kata-shadcn` first, then consume it downstream.

### Selection policy (required)

- For new UI work, agents must evaluate registry options first and document selected component names in the ticket/PR notes.
- For desktop app layout work, prioritize app shell blocks and related categories before assembling bespoke layouts.
- Candidate-first categories for app shells: `Navigation`, `Sidebar`, `Settings`, `Content`, `Data & Table`, `Projects`.
- Do not ship ad-hoc replacement components when an equivalent registry block exists.

### No-preview workflow for blocks

- Current limitation: block preview is limited in the consumer app workflow.
- Required process when preview is unavailable:
1. Query `GET /r/index-compact.json` and filter by category/name.
2. Pull 2-5 candidates via `GET /r/{name}.json` and compare structure/dependencies.
3. Install top candidate(s) to a temp path (`--path ./tmp/registry-install`) for source inspection.
4. Choose one and integrate; clean temp artifacts and record rationale in PR notes.
- For app-shell candidates, include at least one `Sidebar` or `Navigation`-anchored option in the comparison set.

### Auth

Endpoints under `/r/*` require an `x-registry-token` header except these public passthroughs for built-in shadcn dependencies:

- `/r/styles/*` — style definitions
- `/r/colors/*` — color registry
- `/r/icons/*` — icon registry

Compatibility endpoints under `/styles/*` proxy to the public shadcn registry for unscoped dependencies (e.g. `utils`, `button`) that the CLI resolves via `styles/{style}/{name}.json`.

When running a local copy of the registry, auth can be disabled when `REGISTRY_TOKEN` is not set (local dev mode). Do not assume this for the deployed Vercel URL.

### Setup

In the consuming project's `components.json`:

```json
{
  "registries": {
    "@kata-shadcn": {
      "url": "https://shadcn-registry-eight.vercel.app/r/{name}.json",
      "headers": {
        "x-registry-token": "${REGISTRY_TOKEN}"
      }
    }
  }
}
```

Add `REGISTRY_TOKEN=<token>` to the consuming project's `.env`.

Install a component:

```bash
npx shadcn add @kata-shadcn/hero1
```

The install prefix must match the registry key in `components.json` (`<registry-key>/<component-name>`).

For install verification without touching production component paths, use `--path` to a temp folder and verify `git status` afterward:

```bash
npx shadcn add @kata-shadcn/alert-alert-warning-1 --path ./tmp/registry-install --yes
```

### Discovery endpoints

Use the compact index for initial filtering (~80-100KB). Fetch the full index only when enriched metadata (tags, complexity, hashes) is needed. All endpoints require `x-registry-token: <token>`.

| Endpoint | Description | Response shape |
|---|---|---|
| `GET /r/index-compact.json` | Lightweight discovery (~80-100KB) | `{ total, items: [{ name, category, url }] }` |
| `GET /r/index.json` | Full enriched index | `{ total, items: [{ name, title, description, category, url, tags, complexity: { files, lines, dependencies }, contentHash, lastModified?, peerComponents }] }` |
| `GET /r/{name}.json` | Single component (shadcn CLI format) | `{ name, type, title, description, files: [{ path, content, type }], dependencies?, registryDependencies? }` |

`lastModified` is omitted when git history is unavailable.

### Categories

Components are organized into 31 curated categories. Filter `items` client-side on the `category` field. Valid values:

About, Alert & Dialog, Avatar, Blog, Button, Card, Chart, Contact, Content, CTA, Data & Table, Feature, Footer, Forms - Input & Text, Forms - Select & Controls, Gallery, Hero, Navigation, Other, Pricing, Product, Progress & Skeleton, Projects, Services, Settings, Sidebar, Tabs & Accordion, Testimonial, Timeline, Tooltip & Popover, Trust & Logos

### Workflow

1. `GET /r/index-compact.json` — filter by `name` or `category` (e.g. `category === "Hero"`)
2. Pick an entry, note `name` and `url`
3. (Optional) `GET /r/{name}.json` — inspect full source and dependencies
4. Install: `npx shadcn add @kata-shadcn/{name}`

## UI Review and Annotation

- Agentation is installed as the UI annotation workflow tool for design feedback loops.
- Use Agentation MCP annotations as actionable feedback during frontend QA and acceptance passes.
- This repo is Tauri + Vite React (not Next.js), so the Next.js-specific Agentation component setup flow is not the primary integration path here.
