# KAT-151 Desktop Shell Spike Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evaluate all ten `@kata-shadcn/application-shell*` candidates against the current desktop shell and the full command-center scope in `docs/PROJECT_PLAN.md`, select a baseline, and land a proof-of-concept shell swap in the desktop app.

**Architecture:** First, treat the work as an evidence-gathering spike: inspect and temp-install every candidate, then record a consistent comparison matrix and recommendation in the approved design doc. Second, convert the winning shell into a narrow desktop shell adapter by changing only shell composition, route metadata, and shell state, while keeping page rendering route-driven through `Layout` and `Outlet`.

**Tech Stack:** React 18, React Router 6 (`MemoryRouter`), Zustand, Tailwind CSS, Vitest + Testing Library, Tauri desktop app, shadcn CLI with private `@kata-shadcn` registry.

---

### Task 1: Build the Comparison Matrix and Install All Candidates

**Files:**
- Modify: `docs/plans/2026-02-28-kat-151-desktop-shell-spike-design.md`
- Inspect: `docs/PROJECT_PLAN.md`
- Inspect: `docs/screenshots/app-shells/*`
- Temp output: `tmp/registry-install/application-shell1`
- Temp output: `tmp/registry-install/application-shell2`
- Temp output: `tmp/registry-install/application-shell3`
- Temp output: `tmp/registry-install/application-shell4`
- Temp output: `tmp/registry-install/application-shell5`
- Temp output: `tmp/registry-install/application-shell6`
- Temp output: `tmp/registry-install/application-shell7`
- Temp output: `tmp/registry-install/application-shell8`
- Temp output: `tmp/registry-install/application-shell9`
- Temp output: `tmp/registry-install/application-shell10`

**Step 1: Add a comparison matrix section to the design doc before evaluating**

```md
## Comparison Matrix

| Shell | Current Fit | Future Command-Center Fit | Breakpoint Fit | Nav Flexibility | Content Flexibility | Opinionation Cost | Dependency Cost | Disposition | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| application-shell1 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell2 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell3 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell4 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell5 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell6 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell7 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell8 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell9 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
| application-shell10 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | |
```

**Step 2: Verify registry credentials are available**

Run: `echo "$REGISTRY_TOKEN" | wc -c`
Expected: non-zero count greater than `1`

**Step 3: Install all ten candidates into temp paths**

Run:

```bash
for n in 1 2 3 4 5 6 7 8 9 10; do
  npx shadcn add @kata-shadcn/application-shell${n} --path ./tmp/registry-install/application-shell${n} --yes
done
```

Expected: each install completes successfully and only writes under `tmp/registry-install`

**Step 4: Confirm temp installs did not touch production paths**

Run: `git status --short`
Expected: only the design doc and `tmp/registry-install/*` appear as new/modified files

**Step 5: Commit the comparison setup**

```bash
git add docs/plans/2026-02-28-kat-151-desktop-shell-spike-design.md
git commit -m "docs: add shell comparison matrix for kat-151"
```

### Task 2: Rank All Ten Shells and Select the Baseline

**Files:**
- Modify: `docs/plans/2026-02-28-kat-151-desktop-shell-spike-design.md`
- Inspect: `apps/desktop/src/App.tsx`
- Inspect: `apps/desktop/src/routes.ts`
- Inspect: `apps/desktop/src/components/Layout.tsx`
- Inspect: `apps/desktop/src/components/Sidebar.tsx`
- Inspect: `apps/desktop/src/store/app.ts`

**Step 1: Write the failing documentation expectation**

Add a `## Recommendation` section to the design doc with placeholders that must be replaced by actual findings:

```md
## Recommendation

- Preferred candidate: TBD
- Decision: adopt | adapt | reject
- Required deltas:
  - TBD
- Rejected candidates:
  - TBD
```

The document should still be incomplete until every shell has a recorded disposition.

**Step 2: Fill the matrix by reviewing each installed shell against the approved rubric**

Use this exact checklist for each shell:

```md
- Current integration fit with `Layout` + `Outlet`
- Future fit with the command-center scope in `docs/PROJECT_PLAN.md`
- Sidebar/grouping flexibility for Dashboard, Spec Editor, Agent Monitor, Artifacts, Fleet, Settings
- Generic content-region suitability
- Desktop-first breakpoint behavior
- Opinionation cost (for example IDE-style forced structure)
- Dependency impact and adapter cost
```

**Step 3: Finalize the recommendation in the design doc**

Replace placeholders with a concrete decision:

```md
## Recommendation

- Preferred candidate: `@kata-shadcn/application-shellX`
- Decision: adapt
- Required deltas:
  - Keep existing `MemoryRouter` and `Outlet`
  - Map existing `routes` metadata into the shell nav API
  - Add one small shell-state field if the chosen shell needs it
- Rejected candidates:
  - `application-shell9`: too IDE-specific for the command-center IA
```

**Step 4: Remove rejected temp installs only after the winner is chosen**

Run:

```bash
# Replace X with the winning shell number.
for n in 1 2 3 4 5 6 7 8 9 10; do
  [ "$n" != "X" ] && rm -rf "tmp/registry-install/application-shell${n}"
done
```

Expected: rejected temp inspection artifacts are removed while the selected shell's temp install remains available for implementation reference

**Step 5: Commit the completed assessment**

```bash
git add docs/plans/2026-02-28-kat-151-desktop-shell-spike-design.md
git commit -m "docs: record shell evaluation and recommendation for kat-151"
```

### Task 3: Add or Update Tests for the Chosen Shell Contract

**Files:**
- Modify: `tests/unit/desktop/layout.test.tsx`
- Modify: `tests/unit/desktop/sidebar.test.tsx`
- Modify: `tests/unit/desktop/navigation.test.tsx`
- Modify: `tests/unit/desktop/store.test.ts`
- Optional create: `tests/unit/desktop/routes.test.ts`

**Step 1: Write the failing test for the selected shell layout**

If the chosen shell keeps a sidebar + main layout, update the layout test to assert the new shell landmarks and wrapper hooks instead of the current custom structure:

```tsx
test('renders the selected application shell frame', () => {
  renderLayout();
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByTestId('desktop-shell-frame')).toBeInTheDocument();
});
```

**Step 2: Run the layout test to verify it fails**

Run: `pnpm exec vitest run tests/unit/desktop/layout.test.tsx`
Expected: FAIL because `desktop-shell-frame` does not exist yet

**Step 3: Write the failing navigation test for the chosen shell behavior**

If the chosen shell needs grouped navigation or header actions, encode that in tests before implementation:

```tsx
test('keeps primary desktop destinations visible in shell navigation', () => {
  render(<App />);
  expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /specs/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /agents/i })).toBeInTheDocument();
});
```

If route metadata changes are needed, add a targeted route-shape test:

```ts
import { routes } from '../../../apps/desktop/src/routes';

test('all navigable routes expose shell-safe metadata', () => {
  for (const route of routes.filter((route) => route.nav !== false)) {
    expect(route.label).toBeTruthy();
    expect(route.icon).toBeTruthy();
  }
});
```

**Step 4: Run the desktop shell tests to verify they fail in the expected places**

Run:

```bash
pnpm exec vitest run \
  tests/unit/desktop/layout.test.tsx \
  tests/unit/desktop/sidebar.test.tsx \
  tests/unit/desktop/navigation.test.tsx \
  tests/unit/desktop/store.test.ts
```

Expected: FAIL only on the new selected-shell expectations

**Step 5: Commit the test updates**

```bash
git add tests/unit/desktop/layout.test.tsx tests/unit/desktop/sidebar.test.tsx tests/unit/desktop/navigation.test.tsx tests/unit/desktop/store.test.ts tests/unit/desktop/routes.test.ts
git commit -m "test: define desktop shell contract for kat-151"
```

### Task 4: Implement the Shell Adapter and Minimal State Changes

**Files:**
- Modify: `apps/desktop/src/components/Layout.tsx`
- Modify: `apps/desktop/src/components/Sidebar.tsx`
- Modify: `apps/desktop/src/routes.ts`
- Modify: `apps/desktop/src/store/app.ts`
- Optional modify: `apps/desktop/src/App.tsx`
- Optional modify: `apps/desktop/src/index.css`

**Step 1: Copy only the selected shell’s relevant structure into production code**

Do not import directly from `tmp/registry-install`. Instead, copy the minimal shell structure needed into the desktop app and adapt it to the existing route model.

Start with a shell frame that keeps `Outlet` in the main content region:

```tsx
export function Layout() {
  return (
    <div data-testid="desktop-shell-frame" className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-950">
        <Outlet />
      </main>
    </div>
  );
}
```

Then replace the wrapper internals with the chosen shell’s structure while preserving:
- one `navigation` landmark
- one `main` landmark
- one route-driven content outlet

**Step 2: Keep `routes.ts` as the navigation source of truth**

Only add the smallest metadata needed by the chosen shell. If grouping is required, prefer one additive optional field:

```ts
export interface AppRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
  end?: boolean;
  nav?: boolean;
  navGroup?: 'primary' | 'secondary';
}
```

Do not duplicate route definitions in the shell component.

**Step 3: Expand the Zustand store only for shell interaction state**

If the selected shell requires more than `sidebarCollapsed`, keep the changes narrow:

```ts
interface AppState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
}
```

Do not add page data or feature state to this store as part of the spike.

**Step 4: Adapt `Sidebar.tsx` into a shell adapter**

Map the existing route array into the chosen shell’s nav primitives instead of hardcoding destinations twice:

```tsx
const navItems = routes.filter((item) => item.nav !== false);

return (
  <nav aria-label="Primary" className="...">
    {navItems.map((item) => (
      <NavLink key={item.path} to={item.path} end={item.end}>
        <item.icon className="h-4 w-4" />
        <span>{item.label}</span>
      </NavLink>
    ))}
  </nav>
);
```

If the chosen shell already provides its own sidebar primitive, keep this file as a thin adapter or delete it and move the mapping into `Layout.tsx`.

**Step 5: Run the targeted shell tests and iterate until they pass**

Run:

```bash
pnpm exec vitest run \
  tests/unit/desktop/layout.test.tsx \
  tests/unit/desktop/sidebar.test.tsx \
  tests/unit/desktop/navigation.test.tsx \
  tests/unit/desktop/store.test.ts
```

Expected: PASS

**Step 6: Commit the shell adapter implementation**

```bash
git add apps/desktop/src/components/Layout.tsx apps/desktop/src/components/Sidebar.tsx apps/desktop/src/routes.ts apps/desktop/src/store/app.ts apps/desktop/src/App.tsx apps/desktop/src/index.css
git commit -m "feat: add desktop shell spike poc for kat-151"
```

### Task 5: Run Full Verification and Record Final Results

**Files:**
- Modify: `docs/plans/2026-02-28-kat-151-desktop-shell-spike-design.md`
- Verify: `apps/desktop/src/components/Layout.tsx`
- Verify: `apps/desktop/src/components/Sidebar.tsx`
- Verify: `apps/desktop/src/routes.ts`
- Verify: `apps/desktop/src/store/app.ts`

**Step 1: Run the scaffold and unit tests relevant to the desktop app**

Run:

```bash
pnpm --filter @kata/desktop test
pnpm exec vitest run tests/unit/desktop/layout.test.tsx tests/unit/desktop/sidebar.test.tsx tests/unit/desktop/navigation.test.tsx tests/unit/desktop/store.test.ts
```

Expected: PASS

**Step 2: Run desktop lint and typecheck**

Run:

```bash
pnpm --filter @kata/desktop lint
pnpm --filter @kata/desktop typecheck
```

Expected: PASS

**Step 3: Run the local parity gate if the final diff touches shared CI-relevant files**

Run: `pnpm ci:checks`
Expected: PASS

If `pnpm ci:checks` is too slow during iteration, still require it before closing the ticket.

**Step 4: Manually launch the desktop app and verify shell behavior**

Run: `pnpm desktop:tauri:dev`
Expected:
- the selected shell renders
- the app still opens on Dashboard
- navigation reaches Specs, Agents, Artifacts, Fleet, and Settings
- shell interactions (collapse, open, grouped sections, or header actions) work as expected

**Step 5: Update the design doc with final verification notes**

Append a short verification section:

```md
## Verification

- `pnpm --filter @kata/desktop test`
- `pnpm exec vitest run tests/unit/desktop/layout.test.tsx tests/unit/desktop/sidebar.test.tsx tests/unit/desktop/navigation.test.tsx tests/unit/desktop/store.test.ts`
- `pnpm --filter @kata/desktop lint`
- `pnpm --filter @kata/desktop typecheck`
- `pnpm desktop:tauri:dev`
```

**Step 6: Commit the verification notes**

```bash
git add docs/plans/2026-02-28-kat-151-desktop-shell-spike-design.md
git commit -m "docs: add verification notes for kat-151 shell spike"
```
