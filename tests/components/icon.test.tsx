// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Plane } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Icon } from '@/components/ui/icon';

/**
 * Seam: the `Icon` wrapper's public contract (size prop → px, label → aria).
 * We don't test lucide itself, just our wrapper's behaviour.
 */
describe('Icon', () => {
  it('renders a decorative icon as aria-hidden by default', () => {
    const { container } = render(<Icon icon={Plane} data-testid="i" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).not.toHaveAttribute('role');
  });

  it('exposes a labelled icon with role=img + aria-label', () => {
    render(<Icon icon={Plane} label="Vol" />);
    const img = screen.getByRole('img', { name: 'Vol' });
    expect(img).toBeInTheDocument();
  });

  it('maps named sizes to the design-system px values', () => {
    const { container, rerender } = render(<Icon icon={Plane} size="inline" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
    rerender(<Icon icon={Plane} size="hero" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
  });

  it('passes axe with a label', async () => {
    const { container } = render(<Icon icon={Plane} label="Passeport" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
