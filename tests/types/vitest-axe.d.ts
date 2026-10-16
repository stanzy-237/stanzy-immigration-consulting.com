/**
 * Augment Vitest's `Assertion` with vitest-axe matchers. The upstream
 * `vitest-axe` package does not ship type augmentation, and merging extra
 * matchers in requires repeating the exact signature `@testing-library/jest-dom`
 * uses so the two declarations merge cleanly.
 */
import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  // Must match the signature `@testing-library/jest-dom`'s augmentation uses
  // (single `T = any`), or TypeScript fails with TS2428.
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type */
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-object-type */
}
