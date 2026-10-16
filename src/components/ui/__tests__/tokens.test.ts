import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Contract test for the Stanzy design-system brand tokens.
 *
 * Seam: `src/app/globals.css` is the single source of truth for colour and
 * typography tokens. Every other primitive consumes them. This test fails if a
 * token the design md pins is dropped or changed by accident.
 *
 * The design md is the authority — see pasted brief on issue #3 and
 * GLOSSARY.md. Hex values here match it verbatim.
 */
const globalsCss = readFileSync(
  fileURLToPath(new URL('../../../app/globals.css', import.meta.url)),
  'utf8',
);

const requiredTokens: Record<string, string> = {
  '--rouge': '#cc1627',
  '--crimson': '#d93344',
  '--rose': '#ee8a93',
  '--blush': '#fcedef',
  '--navy-deep': '#0d1f4e',
  '--navy-80': '#1a3065',
  '--steel-blue': '#6b88b5',
  '--ice-blue': '#e8edf5',
  '--off-white': '#f7f8fc',
  '--fog': '#cbd5e0',
  '--slate': '#4a5568',
  '--ink': '#0d1f4e',
  '--success': '#2f855a',
  '--warning': '#b7791f',
};

describe('design-system tokens', () => {
  it.each(Object.entries(requiredTokens))(
    'defines %s = %s',
    (token, expected) => {
      const pattern = new RegExp(
        `${token.replace(/-/g, '\\-')}\\s*:\\s*([^;]+);`,
        'i',
      );
      const match = globalsCss.match(pattern);
      expect(match, `expected ${token} to be defined in globals.css`).not.toBe(
        null,
      );
      expect(match![1].trim().toLowerCase()).toBe(expected);
    },
  );

  it('maps shadcn --primary to the Rouge brand token', () => {
    expect(globalsCss).toMatch(/--primary:\s*var\(--rouge\)/);
  });

  it('maps shadcn --secondary to the Navy brand token', () => {
    expect(globalsCss).toMatch(/--secondary:\s*var\(--navy-deep\)/);
  });

  it('maps shadcn --background to Off-white', () => {
    expect(globalsCss).toMatch(/--background:\s*var\(--off-white\)/);
  });

  it('wires the three brand font families', () => {
    expect(globalsCss).toMatch(/--font-heading:\s*var\(--font-syne\)/);
    expect(globalsCss).toMatch(/--font-body:\s*var\(--font-work-sans\)/);
    expect(globalsCss).toMatch(/--font-label:\s*var\(--font-plus-jakarta\)/);
  });

  it('defines the design radius scale explicitly', () => {
    expect(globalsCss).toMatch(/--radius-sm:\s*4px/);
    expect(globalsCss).toMatch(/--radius-md:\s*8px/);
    expect(globalsCss).toMatch(/--radius-lg:\s*12px/);
    expect(globalsCss).toMatch(/--radius-xl:\s*16px/);
  });
});
