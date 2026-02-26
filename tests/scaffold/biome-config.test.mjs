import assert from 'node:assert/strict';
import fs from 'node:fs';

const biome = JSON.parse(fs.readFileSync('biome.json', 'utf8'));
assert.ok(biome.$schema, 'biome schema reference missing');
assert.equal(biome.linter.enabled, true, 'biome linter must be enabled');
assert.equal(biome.formatter.enabled, false, 'biome formatter must be disabled (Prettier handles formatting)');
assert.ok(biome.files.includes.some(p => p.includes('dist')), 'biome files.includes must have a dist exclusion pattern');
assert.ok(!biome.files.includes.some(p => p.includes('node_modules')), 'node_modules should not be in includes (Biome excludes it by default)');

const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert.equal(rootPkg.scripts['lint:biome'], 'biome check .', 'root lint:biome script must be "biome check ."');
assert.ok(rootPkg.devDependencies['@biomejs/biome'], '@biomejs/biome devDependency missing');
