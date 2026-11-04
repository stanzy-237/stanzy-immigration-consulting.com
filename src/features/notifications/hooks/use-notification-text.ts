import { useLocale, useTranslations } from 'next-intl';

import { formatMoney } from '@/features/invoices/lib/money';
import { actorName, type NotificationItem } from '@/features/notifications/lib/notification-links';

/**
 * A Notification in the reader's language: `title` says what happened,
 * `detail` adds what helps (the message's words, the closing reason).
 */
export function useNotificationText() {
  const t = useTranslations('Notifications');
  const dossiers = useTranslations('Dossiers');
  const locale = useLocale();

  return (item: NotificationItem): { title: string; detail: string | null } => {
    const service = item.dossier ? dossiers(`services.${item.dossier.service}`) : '';
    const values = {
      actor: actorName(item, t('someone')),
      // The sign-ups summary carries its own count; grouped Notifications, how many they gathered.
      count: item.kind === 'ACCOUNTS_SIGNED_UP' ? Number(item.params.count ?? 0) : item.count,
      client: item.params.client ?? '',
      level: item.params.level ?? '',
      round: item.params.round ?? '',
      crs: item.params.crs ?? '',
      invitations: item.params.invitations ? new Intl.NumberFormat(locale).format(Number(item.params.invitations)) : '',
      document: item.document?.title ?? '',
      service,
      stage:
        item.dossier && item.params.stage
          ? dossiers(`stages.${item.dossier.service}.${item.params.stage}` as never)
          : '',
      // A Facture's number, or a Contrat's (kept in its params).
      number: item.invoice?.number ?? item.params.number ?? '',
      total: item.invoice ? formatMoney(item.invoice.total, item.invoice.currency, locale) : '',
    };
    const detail =
      item.kind === 'MESSAGE_POSTED' && item.comment?.body
        ? item.comment.body
        : item.kind === 'DOSSIER_CLOSED' && item.params.reason
          ? t('reason', { reason: item.params.reason })
          : null;
    return { title: t(`kinds.${item.kind}`, values), detail };
  };
}
