import { afterEach, describe, expect, it } from 'vitest';

import { installPdfPolyfills } from '@/features/pdf-tools/lib/pdf-polyfills';

// What iOS 17.1 lacks (added in Safari 17.4), taken away to see them put back.
const saved = {
  withResolvers: Promise.withResolvers,
  transferToFixedLength: ArrayBuffer.prototype.transferToFixedLength,
  any: AbortSignal.any,
};
const remove = () => {
  Reflect.deleteProperty(Promise, 'withResolvers');
  Reflect.deleteProperty(ArrayBuffer.prototype, 'transferToFixedLength');
  Reflect.deleteProperty(AbortSignal, 'any');
};

afterEach(() => {
  Object.assign(Promise, { withResolvers: saved.withResolvers });
  Object.defineProperty(ArrayBuffer.prototype, 'transferToFixedLength', { value: saved.transferToFixedLength, configurable: true, writable: true });
  Object.assign(AbortSignal, { any: saved.any });
});

describe('installPdfPolyfills', () => {
  it('gives an older Safari what pdf.js 6 calls: Promise.withResolvers', async () => {
    remove();
    installPdfPolyfills();
    const { promise, resolve } = Promise.withResolvers<number>();
    resolve(7);
    expect(await promise).toBe(7);
  });

  it('ArrayBuffer.prototype.transferToFixedLength, to the length asked', () => {
    remove();
    installPdfPolyfills();
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
    expect([...new Uint8Array(bytes.transferToFixedLength(2))]).toEqual([1, 2]);
    expect(bytes.transferToFixedLength().byteLength).toBe(4);
  });

  it('AbortSignal.any, aborted with the first signal', () => {
    remove();
    installPdfPolyfills();
    const first = new AbortController();
    const combined = AbortSignal.any([first.signal, new AbortController().signal]);
    expect(combined.aborted).toBe(false);
    first.abort('stop');
    expect(combined.aborted).toBe(true);
    expect(combined.reason).toBe('stop');
  });

  it('leaves a browser that has them alone', () => {
    installPdfPolyfills();
    expect(Promise.withResolvers).toBe(saved.withResolvers);
    expect(AbortSignal.any).toBe(saved.any);
  });
});
