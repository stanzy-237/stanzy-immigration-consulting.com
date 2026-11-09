import { describe, expect, it } from 'vitest';

import { isPageNavigation } from '@/lib/page-navigation';

const here = new URL('https://www.stanzy-immigration-consulting.com/fr/mon-espace?onglet=documents');
const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
const link = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({
  href: new URL(href, here).href,
  target: '',
  download: false,
  ...extra,
});

describe('isPageNavigation', () => {
  it('starts on a plain click to another page of the site', () => {
    expect(isPageNavigation(click, link('/fr/mon-espace/services'), here)).toBe(true);
  });

  it('leaves new tabs and windows to the browser', () => {
    const page = link('/fr/mon-espace/services');
    expect(isPageNavigation({ ...click, metaKey: true }, page, here)).toBe(false);
    expect(isPageNavigation({ ...click, ctrlKey: true }, page, here)).toBe(false);
    expect(isPageNavigation({ ...click, shiftKey: true }, page, here)).toBe(false);
    expect(isPageNavigation({ ...click, altKey: true }, page, here)).toBe(false);
    expect(isPageNavigation({ ...click, button: 1 }, page, here)).toBe(false);
    expect(isPageNavigation(click, link('/fr/mon-espace/services', { target: '_blank' }), here)).toBe(false);
  });

  it('ignores a click the page already handled', () => {
    expect(isPageNavigation({ ...click, defaultPrevented: true }, link('/fr/mon-espace/services'), here)).toBe(false);
  });

  it('leaves downloads and other sites to the browser', () => {
    expect(isPageNavigation(click, link('/api/contracts/c1/pdf', { download: true }), here)).toBe(false);
    expect(isPageNavigation(click, link('https://www.canada.ca/fr.html'), here)).toBe(false);
    expect(isPageNavigation(click, link('mailto:info@example.com'), here)).toBe(false);
  });

  it('leaves files served by the API to the browser, download attribute or not', () => {
    expect(isPageNavigation(click, link('/api/dossiers/files/v1'), here)).toBe(false);
  });

  it('stays put for the same page or a jump within it', () => {
    expect(isPageNavigation(click, link('/fr/mon-espace?onglet=documents'), here)).toBe(false);
    expect(isPageNavigation(click, link('/fr/mon-espace?onglet=documents#factures'), here)).toBe(false);
  });

  it('starts when only the query changes, as a tab does', () => {
    expect(isPageNavigation(click, link('/fr/mon-espace?onglet=reunions'), here)).toBe(true);
  });
});
