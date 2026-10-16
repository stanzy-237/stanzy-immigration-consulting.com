import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
    ],
    // Node env for pure-logic tests; browser-like tests opt-in with
    // `// @vitest-environment jsdom` at the top of the file so the heavier
    // environment only loads where it is actually needed.
    environment: 'node',
    environmentMatchGlobs: [
      ['src/**/__tests__/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['tests/setup.ts'],
    // Unit tests stub the DB and never read runtime config.
    env: { SKIP_ENV_VALIDATION: '1' },
    server: {
      // next-intl ships ESM that imports `next/navigation` without an
      // extension. Inlining it forces Vite to run the imports through its
      // resolver (which honours our `resolve.alias` fix) rather than Node's.
      deps: { inline: [/next-intl/] },
    },
  },
  resolve: {
    alias: [
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
      // next-intl's client navigation helpers import `next/navigation` without
      // the `.js` extension; Vite's resolver does not honour Next's package
      // exports map, so point it at the actual file for test runs. The
      // `$` suffix anchors the match so sub-paths are untouched.
      {
        find: /^next\/navigation$/,
        replacement: fileURLToPath(
          new URL('./node_modules/next/navigation.js', import.meta.url),
        ),
      },
    ],
  },
});
