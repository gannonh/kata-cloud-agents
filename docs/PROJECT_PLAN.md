# Kata Cloud Agents — Project Plan

## What This Is

An Agent Development Environment (ADE) that lets engineering teams define intent via living specs, dispatch cloud agents to execute against those specs, verify results through computer use and browser control, and manage everything from a unified command center across desktop, web, and mobile.

## Core Thesis

The industry is converging on three capabilities simultaneously: spec-driven orchestration (Augment Intent), cloud VM execution with self-verification (Cursor), and multi-model async dispatch (Perplexity Computer). Kata Cloud Agents unifies all three under a single product with team-first governance.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Kata Cloud Agents                         │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Desktop  │  │   Web App    │  │   Mobile (PWA/Native) │ │
│  │ (Tauri)  │  │   (React)    │  │                       │ │
│  └────┬─────┘  └──────┬───────┘  └───────────┬───────────┘ │
│       │               │                       │             │
│       └───────────────┼───────────────────────┘             │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │   Kata Gateway  │  (WebSocket + REST API)    │
│              └────────┬────────┘                            │
│                       │                                     │
│       ┌───────────────┼───────────────────┐                 │
│       │               │                   │                 │
│  ┌────▼─────┐  ┌──────▼──────┐  ┌────────▼────────┐       │
│  │  Spec    │  │ Dispatcher  │  │  Fleet Manager  │       │
│  │  Engine  │  │             │  │                  │       │
│  └────┬─────┘  └──────┬──────┘  └────────┬────────┘       │
│       │               │                   │                 │
│       └───────────────┼───────────────────┘                 │
│                       │                                     │
│              ┌────────▼────────┐                            │
│              │ Agent Runtime   │                            │
│              │ Orchestrator    │                            │
│              └────────┬────────┘                            │
│                       │                                     │
│       ┌───────────────┼───────────────────┐                 │
│       │               │                   │                 │
│  ┌────▼─────┐  ┌──────▼──────┐  ┌────────▼────────┐       │
│  │ Cloud VM │  │  Cloud VM   │  │   Cloud VM      │       │
│  │ Agent 1  │  │  Agent 2    │  │   Agent N       │       │
│  │ ┌──────┐ │  │ ┌──────┐   │  │ ┌──────┐        │       │
│  │ │Browser│ │  │ │Browser│  │  │ │Browser│       │       │
│  │ │Tools │ │  │ │Tools  │  │  │ │Tools  │       │       │
│  │ │FS    │ │  │ │FS     │  │  │ │FS     │       │       │
│  │ └──────┘ │  │ └──────┘   │  │ └──────┘        │       │
│  └──────────┘  └────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## System Components

### 1. Spec Engine

The living spec is the central artifact. It defines intent, tracks execution state, and auto-updates as agents work.

**Responsibilities:**
- Spec authoring and editing (structured markdown + YAML frontmatter)
- Spec versioning (every mutation is tracked)
- Task decomposition: a Coordinator agent breaks the spec into executable tasks
- Bidirectional sync: agents write findings/decisions/blockers back to the spec
- Verification criteria embedded in the spec (what "done" looks like)
- Spec diffing: see what changed between spec versions and why

**Spec structure:**

```yaml
# spec.kata.yaml
meta:
  id: spec-2026-0001
  title: "Add user authentication"
  author: gannon
  created: 2026-02-26
  status: in_progress  # draft | approved | in_progress | verifying | done | failed

intent: |
  Add email/password authentication to the web app.
  Users should be able to register, log in, and reset passwords.
  Use the existing Convex data layer. Session-based auth with httpOnly cookies.

constraints:
  - No third-party auth providers for v1
  - Rate limit login attempts (5 per minute per IP)
  - Passwords hashed with bcrypt, min 12 characters

verification:
  - type: browser_test
    steps:
      - navigate to /register
      - fill form with test credentials
      - verify redirect to /dashboard
  - type: unit_test
    command: npm test -- --grep auth
  - type: visual
    screenshots:
      - /register (empty state)
      - /login (error state)
      - /dashboard (authenticated)

tasks: []  # populated by Coordinator agent after approval
decisions: []  # agents log architectural decisions here
blockers: []  # agents surface blockers for human review
```

### 2. Dispatcher

Routes approved specs to agent runtimes. Handles scheduling, queuing, and resource allocation.

**Responsibilities:**
- Accept approved specs from the Spec Engine
- Provision cloud environments via the Infrastructure Adapter
- Assign agents (Coordinator, Specialist, Verifier) to environments
- Manage agent lifecycle (start, pause, resume, terminate)
- Handle retries and failure recovery
- Enforce concurrency limits and resource quotas per team

**Trigger types:**
- Manual (user clicks "Run")
- Event-driven (webhook from GitHub, Linear, Slack, etc.)
- Scheduled (cron-style)
- Chained (spec B starts when spec A completes)

### 3. Agent Runtime Orchestrator

Manages the multi-agent execution model within a single spec run.

**Agent roles:**
- **Coordinator**: reads the spec, decomposes into tasks, assigns to Specialists, monitors progress, updates the spec
- **Specialist**: executes a single task (write code, run tests, fix CI, etc.)
- **Verifier**: runs verification criteria from the spec (browser tests, unit tests, visual checks), produces artifacts

**Execution model:**
- Coordinator runs first, produces a task graph
- Specialists run in parallel where tasks are independent
- Verifier runs after all tasks complete (or after each task, configurable)
- Any agent can surface a blocker, which pauses execution and notifies the human

**Model routing:**
- Each agent role can use a different LLM
- Default: Claude for Coordinator/Verifier, configurable per-Specialist
- Support BYOM (Bring Your Own Model) via API keys

### 4. Cloud VM Infrastructure

Each agent gets an isolated cloud environment with full tooling.

**Environment contents:**
- Ubuntu VM with dev container
- Codebase (cloned from repo)
- Full toolchain (language runtimes, package managers, build tools)
- Test suite
- Browser (headless Chromium for computer use / verification)
- Scoped secrets (injected at runtime, never stored in spec)
- Network access (configurable: full, internal-only, or none)

**Infrastructure Adapter interface:**

```typescript
interface InfraAdapter {
  provision(config: EnvConfig): Promise<Environment>
  snapshot(envId: string): Promise<Snapshot>
  destroy(envId: string): Promise<void>
  exec(envId: string, command: string): Promise<ExecResult>
  streamLogs(envId: string): AsyncIterable<LogEntry>
}
```

**Planned adapters:**
- Kata Managed (default, first-party cloud)
- Docker/Podman (self-hosted)
- Fly.io
- E2B
- Modal

### 5. Command Center (Desktop / Web / Mobile)

The primary UI. Team-first design where solo use is a simplified view of the same system.

**Desktop app (Tauri):**
- Primary development interface
- Local file system access for spec editing
- Deep OS integration (notifications, menu bar status, keyboard shortcuts)
- Offline spec editing with sync on reconnect

**Web app:**
- Full feature parity with desktop (minus local FS access)
- Team dashboards, admin controls
- Accessible from any browser

**Mobile (PWA initially, native later):**
- Trigger agents, review results, approve/reject
- Push notifications for blockers and completions
- Quick actions: approve PR, retry failed agent, read spec diff

**UI sections:**
- **Dashboard**: active agents, recent completions, team activity feed
- **Spec Editor**: write/edit living specs, view spec history and diffs
- **Agent Monitor**: per-agent status, live log streaming, resource usage
- **Artifacts**: screenshots, videos, test results, PRs produced by agents
- **Fleet View**: multi-repo operations, progress across fleet runs
- **Settings**: team management, secrets, infra config, model routing, triggers

### 6. Governance Layer

Runtime-enforced controls, not prompt-based suggestions.

- **Identity**: each agent gets a scoped identity (e.g., `kata-agent-spec-0001-specialist-3`)
- **Permissions**: deny lists for commands, file paths, network endpoints
- **Audit trail**: every agent action is logged with timestamp, environment ID, and spec reference
- **Approval gates**: configurable checkpoints where execution pauses for human review
- **Secret scoping**: secrets are injected per-environment, rotated automatically, never written to logs or specs
- **Cost controls**: per-team budgets, per-spec token limits, alerting on overruns

---

## Tech Stack

### Frontend
- **Desktop shell**: Tauri 2.x (Rust backend, web frontend)
- **UI framework**: React + TypeScript
- **State management**: Zustand
- **Styling**: Tailwind CSS
- **Spec editor**: CodeMirror 6 (YAML/markdown mode with custom extensions)
- **Real-time**: WebSocket (native, no Socket.io overhead)
- **Mobile**: PWA first, then React Native if needed

### Backend
- **API server**: Node.js + Hono (lightweight, edge-compatible)
- **Database**: Convex (document tables, realtime subscriptions, server functions)
- **Queue**: BullMQ on Redis (agent dispatch, event processing)
- **Real-time**: WebSocket server (log streaming, status updates)
- **Auth**: Team SSO + API keys
- **Data access**: Convex functions + generated client/types

### Agent Runtime
- **LLM integration**: Multi-provider via unified adapter (borrow patterns from pi-mono's `pi-ai`)
- **Agent framework**: Custom runtime (borrow patterns from pi-mono's `pi-agent-core`)
- **Tool system**: Modular tool registration (file ops, git, browser, shell, HTTP)
- **Browser control**: Playwright (headless Chromium in each VM)
- **Container orchestration**: Docker API + Fly Machines API (for managed cloud)

### Infrastructure
- **Container images**: Pre-built base images per language ecosystem (Node, Python, Go, Rust, Java)
- **Secrets management**: Vault or sealed secrets
- **Observability**: OpenTelemetry for traces, Prometheus for metrics
- **CI/CD**: GitHub Actions

### Monorepo Structure

```
kata-cloud-agents/
├── apps/
│   ├── desktop/          # Tauri app shell
│   ├── web/              # Web app (shared UI with desktop)
│   └── mobile/           # PWA / React Native
├── packages/
│   ├── ui/               # Shared React components
│   ├── spec-engine/      # Spec parsing, validation, diffing
│   ├── dispatcher/       # Agent dispatch and scheduling
│   ├── agent-runtime/    # Agent execution framework
│   ├── infra-adapters/   # Cloud environment provisioning
│   ├── governance/       # Permissions, audit, cost controls
│   ├── gateway/          # API server + WebSocket
│   ├── db/               # Convex schema, functions, and client helpers
│   └── shared/           # Types, utils, constants
├── agents/
│   ├── coordinator/      # Coordinator agent prompt + tools
│   ├── specialist/       # Specialist agent prompt + tools
│   └── verifier/         # Verifier agent prompt + tools
├── containers/
│   ├── base/             # Base agent VM image
│   ├── node/             # Node.js dev environment
│   ├── python/           # Python dev environment
│   └── multi/            # Multi-language environment
├── docs/
└── infrastructure/
    ├── docker/
    ├── fly/
    └── terraform/
```

---

## Milestone Plan

### M0: Foundation (Weeks 1-3)

**Goal**: Monorepo scaffolding, core types, basic desktop shell, database schema.

- Initialize Tauri + React monorepo with turborepo
- Define core TypeScript types (Spec, Agent, Environment, Task, Artifact)
- Convex schema and function scaffolding (users, teams, specs, agent_runs, audit_log)
- Basic Tauri desktop window with navigation shell
- API server skeleton (Hono) with health check + auth middleware
- WebSocket server skeleton for real-time updates
- CI pipeline (lint, typecheck, build, test)

**Deliverable**: Desktop app opens, connects to local API server, can create a user account.

### M1: Spec Engine + Single Agent (Weeks 4-7)

**Goal**: Write a spec, dispatch one agent to a local Docker container, see results.

- Spec YAML schema + parser + validator
- Spec editor UI (CodeMirror with YAML mode, live validation)
- Spec versioning (every save creates a version)
- Single-agent Coordinator: reads spec, produces a task list
- Docker-based InfraAdapter: provision a container from a base image
- Agent runtime: execute shell commands, read/write files, stream logs
- Agent Monitor UI: live log streaming, status indicator
- Result viewer: show agent output, task completion status

**Deliverable**: User writes a spec like "Add a health check endpoint to this Express app", clicks Run. A Docker container spins up, clones the repo, the Coordinator agent plans and executes, logs stream in real-time, and the result (code diff + test output) appears in the UI.

### M2: Verification + Browser Control (Weeks 8-10)

**Goal**: Agents verify their own work using browser automation and produce artifacts.

- Verifier agent role with Playwright integration
- Browser control tools: navigate, click, type, screenshot, record
- Verification criteria in spec schema (browser tests, unit tests, visual checks)
- Artifact storage: screenshots, videos, test reports
- Artifact viewer UI: image gallery, video playback, test result tables
- Spec auto-update: Verifier writes verification results back to the spec

**Deliverable**: After the Specialist writes code, the Verifier opens a browser in the container, navigates the app, takes screenshots, runs tests, and produces a verification report with visual artifacts.

### M3: Multi-Agent Orchestration (Weeks 11-14)

**Goal**: Coordinator decomposes specs into parallel tasks, Specialists execute concurrently.

- Task graph generation by Coordinator (dependencies, parallel groups)
- Parallel Specialist dispatch (multiple containers per spec)
- Inter-agent communication (Coordinator monitors Specialist progress)
- Blocker surfacing: Specialists can pause and request human input
- Spec bidirectional sync: agents write decisions/findings back
- Multi-model routing: configure which LLM each agent role uses
- Fleet View UI: see all agents for a spec, their status, and dependencies

**Deliverable**: A spec with 5 tasks runs 3 Specialists in parallel, each in their own container. The Coordinator monitors progress. One Specialist hits a blocker, the human gets notified, resolves it, and execution resumes.

### M4: Governance + Teams (Weeks 15-18)

**Goal**: Team management, permissions, audit trails, cost controls.

- Team CRUD + invite flow
- Role-based access (admin, member, viewer)
- Agent identity system (scoped credentials per run)
- Command deny lists + network policies
- Audit log (every agent action, searchable, filterable)
- Cost tracking: token usage per spec, per team, per agent
- Budget alerts and hard limits
- Approval gates: configurable pause points in execution

**Deliverable**: A team admin configures permissions, sets a budget, and deploys agents with scoped credentials. Every action is auditable. Execution pauses at configured gates for human approval.

### M5: Triggers + Integrations (Weeks 19-22)

**Goal**: Agents triggered by external events, not just manual clicks.

- Webhook receiver (GitHub, Linear, Slack, generic)
- Scheduled triggers (cron-style)
- Event-to-spec mapping: "when a Linear ticket moves to In Progress, run spec X"
- GitHub integration: create branches, open PRs, post comments
- Slack integration: trigger agents from Slack, receive notifications
- Linear integration: read tickets, update status, link specs to issues

**Deliverable**: A developer moves a Linear ticket to "In Progress". Kata automatically dispatches an agent that reads the ticket, generates a spec, executes it, opens a PR, and posts the result back to the ticket.

### M6: Managed Cloud + Fleet Operations (Weeks 23-28)

**Goal**: First-party managed infrastructure, multi-repo fleet dispatch.

- Kata Managed cloud backend (Fly Machines or equivalent)
- Fleet dispatch: one spec applied across N repositories
- Progress aggregation: unified view of fleet status
- Managed secrets injection
- Environment snapshotting and caching (faster cold starts)
- Web app with full feature parity
- Mobile PWA with push notifications

**Deliverable**: A team lead writes a spec like "Update all 50 microservices to use the new logging library". Kata provisions 50 containers, runs agents in parallel, tracks progress in the Fleet View, and produces 50 PRs.

### M7: Open Source + Self-Hosted (Weeks 29-34)

**Goal**: Open-source the core, provide a self-hosted option.

- Extract core engine as open-source (spec engine, agent runtime, infra adapters)
- Self-hosted deployment guide (Docker Compose, Kubernetes Helm chart)
- Plugin system for custom tools, adapters, and integrations
- Community contribution guidelines
- Documentation site

---

## Recommended First Milestone

**Start with M1: Spec Engine + Single Agent.**

Rationale: M0 (foundation) and M1 together prove the core value proposition end-to-end in roughly 7 weeks. A user writes a spec, an agent executes it in a container, and the result appears in the desktop app. This validates three things simultaneously: the spec format works, the agent runtime works, and the desktop shell works. Everything else (verification, multi-agent, governance, triggers, fleet) layers on top of this foundation without requiring architectural changes.

M2 (verification) follows immediately because self-verification is the primary differentiator. An agent that can prove its own work via browser screenshots and test runs is categorically different from one that just produces a diff.

---

## Key Design Decisions

**Why Tauri over Electron**: Smaller binary (~10MB vs ~150MB), lower memory footprint, Rust backend for performance-critical paths (log streaming, file watching). The ecosystem is mature enough as of 2026. Web frontend stays React either way, so switching cost is low if needed.

**Why living specs over plain prompts**: Prompts are fire-and-forget. Living specs persist, version, and auto-update. They become the audit trail, the documentation, and the source of truth. Teams can review spec diffs in the same way they review code diffs. This is Augment's core insight and it's correct.

**Why multi-agent over single-agent**: A single agent doing everything (plan, code, verify) conflates concerns and makes failures opaque. Separating Coordinator/Specialist/Verifier gives clear failure boundaries, enables parallel execution, and lets you route each role to the optimal model.

**Why runtime governance over prompt governance**: A system prompt saying "don't delete production data" is a suggestion. A deny list on `rm -rf /` enforced by the container runtime is a guarantee. Enterprise teams require the latter. Build it from day one.

**Why managed cloud + open source**: Managed cloud is the business model (per-agent-minute billing). Open source is the distribution model (adoption, community, trust). The two aren't in tension. The managed offering handles infrastructure so teams don't have to. The open-source core lets teams who need full control self-host.

---

## Open Questions

1. **Spec format**: YAML + markdown (proposed above) vs. a custom DSL vs. a structured UI-first approach? YAML is flexible but error-prone. A UI-first approach is friendlier but less expressive.

2. **Model routing strategy**: Should the Coordinator always be the strongest model (Opus-class), or should users control this? What's the default for Specialists? Cost implications are significant at fleet scale.

3. **Container caching**: Cold starts for full dev environments take 30-60 seconds. Snapshotting warmed containers can reduce this to <5 seconds but adds infrastructure complexity. When should this be introduced?

4. **Pricing model**: Per-agent-minute? Per-token? Per-spec-run? Flat team pricing with usage caps? This affects architecture (metering, billing, quotas).

5. **Git workflow**: Should agents work on branches and open PRs (GitHub flow) or commit directly to a staging branch? What about repos with trunk-based development?

6. **Offline / local-first**: How much should work without cloud connectivity? Spec editing is obvious. Can agents run locally as a fallback?
