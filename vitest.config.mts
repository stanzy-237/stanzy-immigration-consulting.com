import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Node env for pure-logic tests; browser-like tests opt-in with
    // `// @vitest-environment jsdom` at the top of the file so the heavier
    // environment only loads where it is actually needed.
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/components/**', 'jsdom'],
      ['tests/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['tests/setup.ts'],
    // Unit tests stub the DB and never read runtime config.
    env: { SKIP_ENV_VALIDATION: '1' },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
