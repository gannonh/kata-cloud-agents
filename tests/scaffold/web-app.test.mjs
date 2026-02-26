import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

const webPkg = JSON.parse(read('apps/web/package.json'));
assert.ok(webPkg.dependencies.react, 'web app missing react dependency');
assert.ok(webPkg.dependencies['@kata/ui'], 'web app must depend on @kata/ui');

const appFile = read('apps/web/src/App.tsx');
assert.match(
  appFile,
  /from '@kata\/ui\/components\/ui\/button'/,
  'App should import shadcn button from shared ui package',
);

const componentsConfig = JSON.parse(read('packages/ui/components.json'));
assert.equal(componentsConfig.style, 'default', 'shadcn style should be default');

const buttonFile = read('packages/ui/src/components/ui/button.tsx');
assert.match(buttonFile, /class-variance-authority/, 'Button should be shadcn-compatible (cva)');
