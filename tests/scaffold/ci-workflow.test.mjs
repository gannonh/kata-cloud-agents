import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

// Triggers
assert.match(workflow, /pull_request:/, 'PR trigger missing');
assert.match(workflow, /push:/, 'push trigger missing');

// Concurrency
assert.match(workflow, /concurrency:/, 'concurrency group missing');
assert.match(workflow, /cancel-in-progress:\s*true/, 'cancel-in-progress missing');

// Verify job basics
assert.match(workflow, /pnpm install --frozen-lockfile/, 'frozen install missing');
assert.match(workflow, /pnpm ci:checks/, 'ci:checks command missing');
assert.match(workflow, /pnpm build/, 'build command missing');
assert.match(workflow, /playwright install --with-deps chromium/, 'playwright browser install missing');
assert.match(workflow, /pnpm test:e2e/, 'e2e command missing');

// Timeout
assert.match(workflow, /timeout-minutes:/, 'timeout-minutes missing');

// Turbo cache
assert.match(workflow, /\.turbo/, 'Turbo cache path missing');
assert.match(workflow, /actions\/cache/, 'actions/cache for Turbo missing');

// Tauri build job
assert.match(workflow, /tauri-build/, 'tauri-build job missing');
assert.match(workflow, /needs:\s*verify/, 'tauri-build must depend on verify');
assert.match(workflow, /macos/, 'macOS platform missing from tauri-build');
assert.match(workflow, /ubuntu-22\.04/, 'Ubuntu 22.04 platform missing from tauri-build');
assert.match(workflow, /windows-latest/, 'Windows platform missing from tauri-build');

// Rust setup in tauri-build
assert.match(workflow, /dtolnay\/rust-toolchain/, 'Rust toolchain setup missing');
assert.match(workflow, /swatinem\/rust-cache/, 'Rust cache missing');

// Linux system deps
assert.match(workflow, /libwebkit2gtk/, 'Linux webkit2gtk dependency missing');
