// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppShell } from '@/components/ui/app-shell';

describe('AppShell', () => {
  it('renders nav, main children, and footer slots', () => {
    render(
      <AppShell
        nav={<div data-testid="nav">nav</div>}
        footer={<div data-testid="footer">footer</div>}
      >
        <p>hello</p>
      </AppShell>,
    );
    expect(screen.getByTestId('nav')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('hello');
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('is valid without nav or footer', () => {
    render(
      <AppShell>
        <p>only content</p>
      </AppShell>,
    );
    expect(screen.getByRole('main')).toHaveTextContent('only content');
  });
});
