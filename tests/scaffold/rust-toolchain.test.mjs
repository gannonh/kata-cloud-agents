import assert from 'node:assert/strict';
import fs from 'node:fs';

const toolchain = fs.readFileSync('apps/desktop/src-tauri/rust-toolchain.toml', 'utf8');
assert.match(toolchain, /channel\s*=\s*"\d+\.\d+\.\d+"/, 'rust-toolchain.toml must pin a specific version');
