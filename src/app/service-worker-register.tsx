'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (`/sw.js`) on the client. Registration is gated
 * to production builds: a service worker in `next dev` interferes with hot
 * reload and serves stale assets.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    };

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
