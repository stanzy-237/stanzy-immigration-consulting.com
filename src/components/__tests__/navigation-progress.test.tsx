// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NavigationProgress } from '@/components/navigation-progress';
import { withIntl } from '@/features/auth/views/__tests__/test-utils';

const url = vi.hoisted(() => ({ pathname: '/fr/mon-espace', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => url.pathname,
  useSearchParams: () => new URLSearchParams(url.search),
}));

beforeEach(() => {
  vi.useFakeTimers();
  url.pathname = '/fr/mon-espace';
  url.search = '';
  window.history.replaceState(null, '', '/fr/mon-espace');
});
afterEach(() => vi.useRealTimers());

/** The bar and a link to another page (jsdom doesn't follow it). */
function setup() {
  const view = render(
    withIntl(
      <>
        <NavigationProgress />
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the bar reads clicks on any <a>, which is what <Link> renders */}
        <a href="/fr/mon-espace/services">Services</a>
      </>,
    ),
  );
  return view;
}

const follow = () => fireEvent.click(screen.getByText('Services'));

describe('NavigationProgress', () => {
  it('stays hidden for a quick page change, then shows while the page loads', () => {
    setup();
    follow();
    expect(screen.queryByRole('progressbar')).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('progressbar', { name: 'Chargement de la page' })).toBeInTheDocument();
  });

  it('finishes once the new page is in place, then goes away', () => {
    const { rerender } = setup();
    follow();
    act(() => vi.advanceTimersByTime(200));
    url.pathname = '/fr/mon-espace/services';
    rerender(withIntl(<NavigationProgress />));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    act(() => vi.advanceTimersByTime(200)); // fills the width
    act(() => vi.advanceTimersByTime(200)); // fades
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('never shows when the page arrives before the delay', () => {
    const { rerender } = setup();
    follow();
    url.pathname = '/fr/mon-espace/services';
    rerender(withIntl(<NavigationProgress />));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
