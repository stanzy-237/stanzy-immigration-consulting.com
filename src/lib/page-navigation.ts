/** The parts of a click the browser decides on. */
export type LinkClick = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

/** The parts of a link that say where it goes and how. */
export type LinkTarget = { href: string; target: string; download: boolean };

/** Whether clicking `link` from `current` makes the app change page. */
export function isPageNavigation(click: LinkClick, link: LinkTarget, current: URL): boolean {
  // A new tab or window, or a click something else already took over.
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (link.target && link.target !== '_self') return false;
  if (link.download) return false;
  // Another site (the Tableau de bord's link to the site included) loads in full.
  const next = new URL(link.href);
  if (next.origin !== current.origin) return false;
  // Only the #fragment differs: the browser scrolls, nothing loads.
  return next.pathname !== current.pathname || next.search !== current.search;
}
