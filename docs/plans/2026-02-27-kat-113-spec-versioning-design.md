# KAT-113: Spec Versioning System - Design

**Date:** 2026-02-27
**Status:** Approved
**Milestone:** M1: Spec Engine + Single Agent
**Blocked by:** KAT-108 (Done), KAT-111 (Done), KAT-106 (Done)
**Blocks:** KAT-112, KAT-116, KAT-118

## Overview

Every spec mutation creates an immutable version record. The system provides API endpoints for version CRUD, structured field-level diffing between any two versions, restore-by-copy semantics, and a desktop UI for browsing version history and viewing diffs.

## Architecture

Versioning logic lives in the gateway (`packages/gateway/`). The spec-engine remains a pure parse/validate/serialize library with no DB dependency. The gateway route handlers manage version creation, diffing, and restore operations using Drizzle queries directly.

## Database Schema Changes

Extend the existing `spec_versions` table with three new columns and change `version_number` from text to integer:

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, default random |
| spec_id | UUID | FK -> specs.id, cascade delete |
| version_number | integer | Unique per spec_id, sequential (max + 1) |
| content | JSONB | Full spec content snapshot |
| actor_id | UUID | Who created this version |
| actor_type | text | 'user' or 'agent', CHECK constraint |
| change_summary | text | Human-readable description, default '' |
| created_at | timestamptz | Immutable, default now() |

Unique constraint on `(spec_id, version_number)`. Index on `spec_id`.

New Drizzle migration in `packages/db/`.

## API Endpoints

All routes in `packages/gateway/src/routes/specs.ts`, following `createRoute()` + `app.openapi()` pattern. All require authentication and team-scoped access.

### POST /api/specs/:specId/versions

Create a new version.

- Body: `{ content: Record<string, unknown>, changeSummary: string }`
- Validates content against `SpecSchema`
- Auto-assigns next sequential `versionNumber`
- Sets `actorId`/`actorType` from authenticated principal
- Updates `specs.content` to match new version
- Returns created version record

### GET /api/specs/:specId/versions

List versions.

- Query: `limit` (default 50), `offset` (default 0)
- Returns versions ordered by `versionNumber` descending
- Includes total count for pagination

### GET /api/specs/:specId/versions/:versionNumber

Get a single version with full content.

### GET /api/specs/:specId/versions/:v1/diff/:v2

Structured diff between two versions.

- Returns `DiffEntry[]` (see Diff Logic section)

### POST /api/specs/:specId/versions/:versionNumber/restore

Restore a previous version.

- Creates a new version with the restored version's content
- Sets `changeSummary` to `"Restored from version {N}"`
- Updates `specs.content`
- Returns newly created version

## Structured Diff Logic

A `diffSpecs(oldContent, newContent)` utility in the gateway versioning module.

```typescript
type DiffEntry = {
  path: string;        // dot-notation: "constraints.2", "verification.criteria"
  type: 'added' | 'removed' | 'changed';
  oldValue?: unknown;
  newValue?: unknown;
};
```

Behavior:
- Primitive fields (title, intent, status): direct comparison, emit `changed` if different
- Arrays (constraints, taskIds, decisions, blockers): index-based comparison. Detect added/removed at end, changed items by position.
- Nested objects (meta, verification): recurse with dot-separated path prefix
- Ignores `meta.updatedAt` (always changes, not meaningful)

No external deep-diff library. The known Spec schema shape keeps this straightforward.

## UI Components

Located in `apps/desktop/`.

### Version History Sidebar

Panel that appears when viewing a spec. Shows chronological list of versions:
- Version number
- Actor name with type badge (human vs agent)
- Change summary
- Relative timestamp
- Click to view version content
- Restore button on each version card

### Diff View

Displayed when comparing two versions. Renders `DiffEntry[]` as a structured list:
- Changed fields: path with old value (red) and new value (green)
- Added fields: path with new value
- Removed fields: path with old value
- Array changes at index level

State managed via Zustand store. React Router for version-specific navigation.

## Testing Strategy

### Unit Tests
- **DB migration:** Verify new columns exist and constraints enforce valid actor_type values
- **Diff logic:** Primitives, arrays, nested objects, empty diffs, added/removed fields
- **API routes:** `app.request()` with mocked deps. Create, list, get, diff, restore, auth, 404s

### UI Component Tests
- Vitest + React Testing Library
- Version list rendering, diff rendering, restore button interaction

### E2E Tests
- **Full lifecycle:** Create spec -> create multiple versions -> list -> diff two versions -> restore older version -> verify new version created with restored content
- **Auth boundary:** Unauthenticated requests rejected across all version endpoints
- **Team isolation:** User from team A cannot access team B's spec versions
- **Edge cases:** Diff identical versions, restore most recent version, create version on nonexistent spec
