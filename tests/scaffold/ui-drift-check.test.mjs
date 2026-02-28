import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scriptPath = path.join(repoRoot, 'scripts/check-ui-drift.mjs');

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ui-drift-check-'));
}

function writeFile(root, relativePath, contents) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function writeDirectory(root, relativePath) {
  fs.mkdirSync(path.join(root, relativePath), { recursive: true });
}

function runCheck(root) {
  return spawnSync(process.execPath, [scriptPath, '--root', root], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

function withFixture(files, run) {
  const root = makeTempRoot();

  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      if (contents === null) {
        writeDirectory(root, relativePath);
        continue;
      }

      writeFile(root, relativePath, contents);
    }

    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

withFixture(
  {
    'apps/desktop/src/features/example.tsx':
      "import { Button } from '@kata/ui/components/ui/button';\nexport function Example() { return Button; }\n",
  },
  (root) => {
    const result = runCheck(root);

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);

withFixture(
  {
    'apps/desktop/src/features/example.tsx':
      "// import { Button } from '@/components/ui/button';\n/* import { Button } from '../components/ui/button'; */\nexport function Example() { return null; }\n",
  },
  (root) => {
    const result = runCheck(root);

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);

withFixture(
  {
    'apps/desktop/src/features/example.tsx':
      "const message = \"import { Button } from '@/components/ui'\";\nconst template = `export { Button } from '../components/ui'`;\nexport function Example() { return `${message} ${template}`; }\n",
  },
  (root) => {
    const result = runCheck(root);

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      String.raw`const pattern = /import .* from '@\/components\/ui\/button'/;
export { pattern };
`,
  },
  (root) => {
    const result = runCheck(root);

    assert.equal(result.status, 0, result.stderr || result.stdout);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/button.tsx': 'export const Button = null;\n',
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected local ui file to fail');
    assert.match(output, /apps[\\/]desktop[\\/]src[\\/]components[\\/]ui[\\/]button\.tsx/);
    assert.match(output, /local ui file/i);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/button/index.tsx': 'export const Button = null;\n',
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected nested local ui file to fail');
    assert.match(output, /apps[\\/]desktop[\\/]src[\\/]components[\\/]ui[\\/]button[\\/]index\.tsx/);
    assert.match(output, /local ui file/i);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/button': null,
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected local ui directory to fail');
    assert.match(output, /apps[\\/]desktop[\\/]src[\\/]components[\\/]ui[\\/]button/);
    assert.match(output, /local ui directory/i);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/button/button.tsx': 'export const Button = null;\n',
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected deeply nested local ui file to fail');
    assert.match(output, /apps[\\/]desktop[\\/]src[\\/]components[\\/]ui[\\/]button[\\/]button\.tsx/);
    assert.match(output, /local ui file/i);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/date-picker/index.tsx': 'export const DatePicker = null;\n',
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected non-primitive local ui file to fail');
    assert.match(output, /apps[\\/]desktop[\\/]src[\\/]components[\\/]ui[\\/]date-picker[\\/]index\.tsx/);
    assert.match(output, /local ui file/i);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/date-picker': null,
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected non-primitive local ui directory to fail');
    assert.match(output, /apps[\\/]desktop[\\/]src[\\/]components[\\/]ui[\\/]date-picker/);
    assert.match(output, /local ui directory/i);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      "import { Button } from '../components/ui/button';\nexport function Page() { return Button; }\n",
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected local primitive import to fail');
    assert.match(output, /apps[\\/]web[\\/]src[\\/]routes[\\/]page\.tsx/);
    assert.match(output, /relative import.*components\/ui/i);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      "import { Button } from '@/components/ui/button';\nexport function Page() { return Button; }\n",
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected alias ui import to fail');
    assert.match(output, /apps[\\/]web[\\/]src[\\/]routes[\\/]page\.tsx/);
    assert.match(output, /forbidden alias import.*@\/components\/ui\/button/i);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      "import { Button } from '@/components/ui';\nimport { Card } from '../components/ui';\nexport function Page() { return Button ?? Card; }\n",
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected local barrel imports to fail');
    assert.match(output, /apps[\\/]web[\\/]src[\\/]routes[\\/]page\.tsx/);
    assert.match(output, /forbidden alias import.*@\/components\/ui/i);
    assert.match(output, /forbidden relative import.*\.\.\/components\/ui/i);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      "const loadButton = () => `${import('../components/ui/button')}`;\nexport { loadButton };\n",
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected template expression dynamic import to fail');
    assert.match(output, /apps[\\/]web[\\/]src[\\/]routes[\\/]page\.tsx/);
    assert.match(output, /forbidden relative dynamic import.*\.\.\/components\/ui\/button/i);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      "const loadButton = () => require('../components/ui/button');\nconst loadCard = () => require('@/components/ui/card');\nexport { loadButton, loadCard };\n",
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected CommonJS ui requires to fail');
    assert.match(output, /apps[\\/]web[\\/]src[\\/]routes[\\/]page\.tsx/);
    assert.match(output, /forbidden relative require.*\.\.\/components\/ui\/button/i);
    assert.match(output, /forbidden alias require.*@\/components\/ui\/card/i);
  },
);

withFixture(
  {
    'apps/web/src/routes/page.tsx':
      "const loadButton = () => import(`../components/ui/button`);\nconst loadCard = () => import(`@/components/ui/card`);\nexport { loadButton, loadCard };\n",
  },
  (root) => {
    const result = runCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, 'expected template literal dynamic imports to fail');
    assert.match(output, /apps[\\/]web[\\/]src[\\/]routes[\\/]page\.tsx/);
    assert.match(output, /forbidden relative dynamic import.*\.\.\/components\/ui\/button/i);
    assert.match(output, /forbidden alias dynamic import.*@\/components\/ui\/card/i);
  },
);

withFixture(
  {
    'apps/desktop/src/components/ui/date-picker': null,
    'apps/desktop/src/components/ui/date-picker/index.tsx': 'export const DatePicker = null;\n',
    'apps/web/src/routes/page.tsx':
      "const loadButton = () => require('@/components/ui/button');\nconst loadPicker = () => import(`../components/ui/date-picker`);\nexport { loadButton, loadPicker };\n",
  },
  (root) => {
    const result = runCheck(root);
    const outputLines = `${result.stdout}\n${result.stderr}`
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    assert.notEqual(result.status, 0, 'expected multiple violations to fail');
    assert.deepEqual(outputLines, [
      'apps/desktop/src/components/ui/date-picker: local ui directory is not allowed',
      'apps/desktop/src/components/ui/date-picker/index.tsx: local ui file is not allowed',
      'apps/web/src/routes/page.tsx: forbidden alias require "@/components/ui/button"',
      'apps/web/src/routes/page.tsx: forbidden relative dynamic import "../components/ui/date-picker" targeting /components/ui',
    ]);
  },
);
