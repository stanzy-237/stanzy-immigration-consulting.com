/**
 * What pdf.js 6 calls but its legacy build no longer polyfills, all added in
 * Safari 17.4: without them an iPhone on iOS 17.1 or older can't open a PDF
 * (a Contrat to sign, the Outils PDF). Installed on the page and inside
 * pdf.js's worker (`pdf-worker.ts`); a browser that has them keeps its own.
 */
export function installPdfPolyfills(): void {
  if (typeof Promise.withResolvers !== 'function') {
    Object.defineProperty(Promise, 'withResolvers', {
      configurable: true,
      writable: true,
      value: function withResolvers<T>() {
        let resolve!: (value: T | PromiseLike<T>) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((onResolve, onReject) => {
          resolve = onResolve;
          reject = onReject;
        });
        return { promise, resolve, reject };
      },
    });
  }

  // pdf.js builds system fonts with it (our Contrats use standard, non-embedded fonts). A copy, not a move:
  // the original stays readable, which pdf.js doesn't rely on.
  if (typeof ArrayBuffer.prototype.transferToFixedLength !== 'function') {
    Object.defineProperty(ArrayBuffer.prototype, 'transferToFixedLength', {
      configurable: true,
      writable: true,
      value: function transferToFixedLength(this: ArrayBuffer, length = this.byteLength) {
        const copy = new ArrayBuffer(length);
        new Uint8Array(copy).set(new Uint8Array(this, 0, Math.min(length, this.byteLength)));
        return copy;
      },
    });
  }

  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any !== 'function') {
    Object.defineProperty(AbortSignal, 'any', {
      configurable: true,
      writable: true,
      value: function any(signals: AbortSignal[]) {
        const controller = new AbortController();
        for (const signal of signals) {
          if (signal.aborted) {
            controller.abort(signal.reason);
            break;
          }
          signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
        }
        return controller.signal;
      },
    });
  }
}
