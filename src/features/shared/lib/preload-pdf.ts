import { preload } from 'react-dom';

/**
 * Starts downloading the PDF a signing page draws (#165) from the page's
 * HTML, while its JavaScript is still loading: `usePdfPages` then finds it
 * already on its way instead of asking for it after hydration. `anonymous`
 * matches that hook's plain same-origin `fetch(url)`, so the browser reuses
 * the preloaded response.
 */
export function preloadPdf(url: string): void {
  preload(url, { as: 'fetch', crossOrigin: 'anonymous' });
}
