// tests/scaffold/rust-toolchain.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';

const toolchain = fs.readFileSync('apps/desktop/src-tauri/rust-toolchain.toml', 'utf8');
assert.match(toolchain, /channel\s*=\s*"stable"/, 'rust-toolchain.toml must pin stable channel');
