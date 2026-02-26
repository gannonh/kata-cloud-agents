import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = JSON.parse(fs.readFileSync('tsconfig.base.json', 'utf8'));
assert.equal(base.compilerOptions.strict, true);
assert.equal(base.compilerOptions.moduleResolution, 'Bundler');

const webTs = JSON.parse(fs.readFileSync('apps/web/tsconfig.json', 'utf8'));
assert.equal(webTs.extends, '../../tsconfig.base.json');

const eslintConfig = fs.readFileSync('eslint.config.mjs', 'utf8');
assert.match(eslintConfig, /typescript-eslint/);

const prettier = JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8'));
assert.equal(prettier.singleQuote, true);
