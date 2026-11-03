import type { RouterOutputs } from '@/trpc/types';

export type NotificationItem = RouterOutputs['notifications']['list']['items'][number];

/** Who reads the list: the Client opens « Mon espace », the consultant the Tableau de bord (admin.<site>). */
export type Audience = 'client' | 'consultant';

/**
 * Where a Notification takes its reader: the exact item. A Document opens
 * unfolded (`?document=`), its message highlighted (`&message=`); a stage
 * lands on the stepper (`#etapes`); a Facture on its panel or page.
 * `locale` prefixes the Client's paths; the dashboard's are short.
 */
/** What a link needs: the kind and the ids it points to (a listed Notification, or one just raised). */
export type LinkTarget = Pick<NotificationItem, 'kind'> & {
  dossier?: { id: string } | null;
  document?: { id: string } | null;
  comment?: { id: string } | null;
  invoice?: { id: string } | null;
};

export function notificationHref(item: LinkTarget, audience: Audience, locale: string): string {
  const base = audience === 'client' ? `/${locale}/mon-espace` : '';
  const all = audience === 'client' ? `${base}/notifications` : '/notifications';
  if (item.kind === 'ACCOUNTS_SIGNED_UP') return '/comptes';
  // The site's page, with its language: from admin.<site> it redirects to the site.
  if (item.kind === 'DRAW_PUBLISHED') return `/${locale}/outils/dernier-tirage`;
  if (!item.dossier) return all;
  const dossier = `${base}/dossiers/${item.dossier.id}`;

  if (item.invoice) return audience === 'client' ? `${dossier}#factures` : `/factures/${item.invoice.id}`;
  if (item.document) {
    const message = item.comment ? `&message=${item.comment.id}` : '';
    return `${dossier}?document=${item.document.id}${message}#documents`;
  }
  return `${dossier}#etapes`;
}

/** Who did it, as the reader sees it: the consultant is « Stanzy » to a Client. */
export function actorName(item: NotificationItem, fallback: string): string {
  if (!item.actor) return fallback;
  return item.actor.role === 'CONSULTANT' ? 'Stanzy' : item.actor.name;
}
