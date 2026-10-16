// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Footer } from '@/components/ui/footer';

describe('Footer', () => {
  it('renders as a <footer> landmark with the given columns', () => {
    render(
      <Footer bottom={<p>© 2026 Stanzy</p>}>
        <div>Column 1</div>
        <div>Column 2</div>
      </Footer>,
    );
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('Column 1')).toBeInTheDocument();
    expect(screen.getByText('© 2026 Stanzy')).toBeInTheDocument();
  });

  it('passes axe', async () => {
    const { container } = render(
      <article>
        <Footer>
          <div>Links</div>
        </Footer>
      </article>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
