import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { Dashboard } from '../../../apps/desktop/src/pages/Dashboard';
import { Specs } from '../../../apps/desktop/src/pages/Specs';
import { Agents } from '../../../apps/desktop/src/pages/Agents';
import { Artifacts } from '../../../apps/desktop/src/pages/Artifacts';
import { Fleet } from '../../../apps/desktop/src/pages/Fleet';
import { Settings } from '../../../apps/desktop/src/pages/Settings';
import { NotFound } from '../../../apps/desktop/src/pages/NotFound';

describe('placeholder pages', () => {
  test.each([
    ['Dashboard', Dashboard],
    ['Specs', Specs],
    ['Agents', Agents],
    ['Artifacts', Artifacts],
    ['Fleet', Fleet],
    ['Settings', Settings],
    ['Page not found', NotFound],
  ])('%s page renders heading', (name, Component) => {
    render(<Component />);
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });
});
