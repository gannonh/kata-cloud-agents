# KAT-114 Docker InfraAdapter Design

**Date:** 2026-02-26
**Scope:** KAT-114 (Docker-based InfraAdapter for local development)
**Status:** Approved

## Goals

- Implement `@kata/infra-adapters` as an adapter-only package with a stable `InfraAdapter` contract and Docker-backed implementation.
- Support full environment lifecycle primitives for M1: provision, exec, stream logs, snapshot, destroy.
- Keep design independent of dispatcher/spec-engine internals so KAT-114 can progress in parallel and unblock KAT-116.

## Non-Goals

- No queue/job orchestration logic.
- No remote Docker host support in M1 (local daemon only).
- No interactive TTY exec in M1.
- No full host/port egress policy enforcement in M1.

## Confirmed Decisions

- M1 supports local Docker daemon only.
- `snapshot(envId)` performs real container commit/tag snapshot.
- `exec(envId, command)` is non-interactive, captures exit code + stdout/stderr.
- `streamLogs(envId)` emits combined stdout/stderr entries with timestamp + source labels.
- `destroy(envId)` removes container and per-env volumes.
- Network policy for M1:
  - Enforce internet on/off at container network mode level.
  - Return explicit unsupported errors for `allowedHosts` and `allowedPorts`.

## Architecture and Package Structure

`packages/infra-adapters` layout:

- `src/types.ts`
  - Domain types: `EnvConfig`, `Environment`, `Snapshot`, `ExecResult`, `LogEntry`, adapter error types.
- `src/infra-adapter.ts`
  - `InfraAdapter` interface and method contracts.
- `src/docker/docker-infra-adapter.ts`
  - Docker-backed adapter implementation (via dockerode).
- `src/docker/connection.ts`
  - Local daemon connection setup and availability checks.
- `src/docker/mappers.ts`
  - Translation helpers between Docker objects and domain types.
- `src/index.ts`
  - Public exports.

Boundary guarantees:

- No dependency on `@kata/spec-engine`.
- No dispatcher or queue semantics.
- No API/UI concerns in this package.

## Method Semantics

### `provision(config: EnvConfig): Promise<Environment>`

- Validate config and enforce M1 network policy constraints.
- Ensure base image availability.
- Create/start container with CPU/memory limits, env injection, and volume mounts.
- Apply internet allow/deny via network mode policy.
- Return normalized `Environment` with canonical state.

### `snapshot(envId: string): Promise<Snapshot>`

- Validate target environment exists.
- Commit container to a deterministic snapshot tag.
- Return image metadata (`imageId`, `tag`, `createdAt`).

### `exec(envId: string, command: string): Promise<ExecResult>`

- Execute non-interactive command in container.
- Capture start/end timestamps, exit code, stdout, stderr.
- Return structured `ExecResult`.

### `streamLogs(envId: string): AsyncIterable<LogEntry>`

- Attach to container output stream.
- Emit normalized log entries:
  - `timestamp`
  - `source` (`stdout` or `stderr`)
  - `message`

### `destroy(envId: string): Promise<void>`

- Stop container.
- Remove container.
- Remove associated per-env volumes.
- Behave idempotently for already-missing resources.

## Data Flow

1. Consumer calls `provision` with config.
2. Adapter creates and starts container; returns environment handle.
3. Consumer drives workload through `exec` and optional `streamLogs`.
4. Consumer may call `snapshot` for image checkpoint.
5. Consumer calls `destroy` for cleanup.

All operations resolve against a local Docker daemon in M1.

## Error Model

Define typed adapter errors with stable codes:

- `DOCKER_UNAVAILABLE`
- `ENV_NOT_FOUND`
- `UNSUPPORTED_M1_NETWORK_POLICY`
- `PROVISION_FAILED`
- `EXEC_FAILED`
- `SNAPSHOT_FAILED`
- `DESTROY_FAILED`

Errors should include contextual metadata and optional root cause.

## Testing Strategy

### Unit and contract tests (always-on)

- Config validation and network-policy gating.
- Docker state-to-domain mappers.
- Lifecycle contract behavior under mocked Docker client:
  - provision success/failure
  - exec output capture
  - log normalization
  - snapshot metadata
  - destroy idempotency

### Optional Docker integration tests (gated)

- Real daemon flow: provision -> exec -> streamLogs -> snapshot -> destroy.
- Run only with explicit env flag (e.g., `KATA_DOCKER_E2E=1`) or dedicated CI job.

### Independence checks

- Assert package has no dependency on `@kata/spec-engine`.
- Assert package has no dispatcher/queue dependencies.

## Integration Readiness for KAT-116

By design, KAT-114 exposes only environment primitives. KAT-116 can compose these primitives for run orchestration without coupling orchestration concerns back into infra-adapters.
