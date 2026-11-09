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
  /** A Demande de signature's id (SIGNATURE_*), a Contrat's (CONTRACT_*), a Réunion's (MEETING_*), a Demande d'intérêt's (INTEREST_*). */
  params?: { requestId?: string; contractId?: string; meetingId?: string; interestId?: string };
};

export function notificationHref(item: LinkTarget, audience: Audience, locale: string): string {
  const base = audience === 'client' ? `/${locale}/mon-espace` : '';
  const all = audience === 'client' ? `${base}/notifications` : '/notifications';
  if (item.kind === 'ACCOUNTS_SIGNED_UP') return '/comptes';
  // The site's page, with its language: from admin.<site> it redirects to the site.
  if (item.kind === 'DRAW_PUBLISHED') return `/${locale}/outils/dernier-tirage`;
  // A Demande d'intérêt (#81): the consultant's decision page, the User's own status.
  if (item.kind === 'INTEREST_SUBMITTED') return item.params?.interestId ? `/demandes/${item.params.interestId}` : '/demandes';
  if (item.kind === 'INTEREST_REJECTED') return `${base}/accompagnement`;
  // An order through a private link (#80): the consultant's « Commandes ».
  if (item.kind === 'SERVICE_ORDERED') return '/services#commandes';
  // A Réunion, with a Dossier or not, opens on its room; cancelled, on the Dossier's Réunions if any.
  if (item.kind.startsWith('MEETING_') && item.params?.meetingId) {
    if (item.kind === 'MEETING_CANCELLED' && item.dossier) return `${base}/dossiers/${item.dossier.id}?onglet=reunions`;
    return `${base}/reunions/${item.params.meetingId}`;
  }
  if (!item.dossier) return all;
  const dossier = `${base}/dossiers/${item.dossier.id}`;

  // The document to sign, open on its fields.
  if (
    (item.kind === 'SIGNATURE_REQUESTED' || item.kind === 'SIGNATURE_REMINDER') &&
    audience === 'client' &&
    item.params?.requestId
  ) {
    return `${dossier}/signer/${item.params.requestId}`;
  }
  // A Contrat to sign opens on its fields; otherwise the Dossier's Contrat panel.
  const contract = item.kind === 'CONTRACT_SENT' || item.kind === 'CONTRACT_REMINDER';
  if (contract && audience === 'client' && item.params?.contractId) {
    return `${dossier}/contrats/${item.params.contractId}`;
  }
  if (contract || item.kind === 'CONTRACT_SIGNED') return `${dossier}#contrats`;
  if (item.kind === 'DOSSIER_MESSAGE') return `${dossier}#messages`;
  // A service's hand-over (#80): the consultant's request page, the Client's Documents tab.
  if (item.kind === 'REQUIREMENTS_SUBMITTED' && audience === 'consultant' && item.params?.requestId) {
    return `${dossier}/services/${item.params.requestId}`;
  }
  if (item.kind === 'REQUIREMENTS_CONFIRMED') return `${dossier}?onglet=documents`;
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
