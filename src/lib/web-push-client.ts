/**
 * Web Push in the browser, shared by the Alertes tirages and the
 * notifications pushed to a phone (#92): what the device supports, its
 * service worker (`/sw.js`), and a new subscription.
 */

/** The VAPID public key, base64url, as the bytes `pushManager.subscribe` wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** iPadOS Safari reports a Mac browser; a Mac with a touch screen is an iPad. */
export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** This page's service worker registration, registering `/sw.js` when asked to. */
export async function registration(register: boolean): Promise<ServiceWorkerRegistration | undefined> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing || !register) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** A new push subscription for this device. Needs notification permission. */
export async function subscribeDevice(publicKey: string): Promise<PushSubscription> {
  const reg = await registration(true);
  if (!reg) throw new Error('No service worker');
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}
