import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(testDir, '..', '..', 'package.json');

describe('package independence', () => {
  it('does not depend on infra-adapters package', () => {
    const pkg = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(pkg.dependencies?.['@kata/infra-adapters']).toBeUndefined();
    expect(pkg.devDependencies?.['@kata/infra-adapters']).toBeUndefined();
    expect(pkg.peerDependencies?.['@kata/infra-adapters']).toBeUndefined();
  });
});
