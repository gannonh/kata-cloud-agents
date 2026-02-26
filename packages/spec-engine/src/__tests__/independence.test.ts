import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package independence', () => {
  it('does not depend on infra-adapters package', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(pkg.dependencies?.['@kata/infra-adapters']).toBeUndefined();
  });
});
