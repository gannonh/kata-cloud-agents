# KAT-111 + KAT-114 Independence Design

**Date:** 2026-02-26
**Scope:** Planning design for KAT-111 (Spec Engine) and KAT-114 (Docker InfraAdapter)
**Status:** Approved

## Goals

- Deliver KAT-111 as a pure spec-engine library with strict YAML parsing/validation, deterministic serialization, transition guards, and JSON Schema export.
- Deliver KAT-114 as an adapter-only package (interface + Docker implementation) with no dispatch orchestration concerns.
- Preserve execution independence so KAT-111 and KAT-114 can proceed in parallel with only shared upstream dependencies.

## Non-Goals

- No queue/dispatcher/job orchestration behavior in KAT-114.
- No filesystem/network/database side effects in KAT-111.
- No YAML comment/formatting preservation in KAT-111.

## Confirmed Decisions

- KAT-111 will be a pure library.
- Validation strictness is fail-closed: unknown fields are rejected at all levels.
- YAML round-trip can be canonicalized; preserving comments is not required.
- Shared spec status model will be updated now to match M1 lifecycle (`draft`, `approved`, `in_progress`, `verifying`, `done`, `failed`).
- KAT-114 will expose only contract + Docker adapter implementation.
- KAT-111 will export JSON Schema for editor consumers.
- Implementation direction selected: shared-first engine approach.

## Architecture and Module Boundaries

### `@kata/shared`

- Owns canonical domain types and Zod schemas used across packages.
- Update spec status schema/type to the M1 lifecycle.
- Remains format-agnostic (no YAML parsing/serialization concerns).

### `@kata/spec-engine` (KAT-111)

- Pure library package.
- Responsibilities:
  - Parse YAML string to in-memory object.
  - Strictly validate against schema (reject unknown keys).
  - Serialize canonical YAML deterministically.
  - Enforce spec status transitions.
  - Export JSON Schema for external consumers (e.g., editor validation in KAT-112).
- Explicitly does not depend on DB, gateway, dispatcher, or infra-adapters.

### `@kata/infra-adapters` (KAT-114)

- Adapter contract and Docker implementation only.
- No queueing semantics, no run orchestration, no dispatcher-specific abstractions.
- Independent of spec-engine internals.

## KAT-111 API Design

Proposed public API surface:

- `parseSpecYaml(input: string): ParseResult<Spec>`
- `validateSpec(data: unknown): ValidationResult<Spec>`
- `serializeSpec(spec: Spec): string`
- `canTransition(from: SpecStatus, to: SpecStatus): boolean`
- `assertTransition(from: SpecStatus, to: SpecStatus): void`
- `getSpecJsonSchema(): JsonSchemaObject`

Proposed internal modules:

- `schema/` - composition around shared schemas for spec-file shape.
- `yaml/` - parser + canonical serializer.
- `transitions/` - transition matrix and guard helpers.
- `errors/` - typed parse/validation/transition errors.
- `json-schema/` - cached Zod -> JSON Schema conversion.

## State Transition Policy

Allowed directed edges:

- `draft -> approved`
- `approved -> in_progress`
- `in_progress -> verifying`
- `verifying -> done`
- `verifying -> failed`

All other transitions are invalid unless explicitly added later.

## Data Flow and Error Handling

1. Receive YAML input.
2. Parse YAML to JS object.
3. Validate object strictly with schema.
4. Return typed `Spec` or structured errors.
5. Gate status changes through transition checks.
6. Serialize to canonical YAML for deterministic output.
7. Provide JSON Schema output for editor/runtime schema consumers.

Error types:

- `SpecParseError`
- `SpecValidationError`
- `SpecTransitionError`

Each should include normalized context for callers (path/code/message where applicable).

## Testing Strategy

### KAT-111

- Parser success/failure tests.
- Strict unknown-field rejection tests.
- Schema validity/required-field tests.
- Transition matrix allow/deny tests.
- Deterministic serialization snapshot tests.
- JSON Schema export smoke/shape tests.
- Contract alignment tests ensuring shared status enum and transition logic stay consistent.

### KAT-114 Boundary Checks

- Ensure no imports from spec-engine into infra-adapters package.
- Keep tests runnable without requiring the KAT-111 runtime surface.

## Independence Guarantees

- KAT-111 and KAT-114 share only upstream foundational contracts (primarily `@kata/shared`).
- Neither requires implementation details from the other.
- Both can be implemented and validated concurrently with independent test suites.
