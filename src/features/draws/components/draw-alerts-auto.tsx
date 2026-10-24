'use client';

import { useDrawAlerts } from '@/features/draws/hooks/use-draw-alerts';

/**
 * Turns Alertes tirages on, on any page, for a device that already allows
 * Stanzy's notifications (and keeps the server's copy of its subscription
 * fresh). Renders nothing; the visible toggle lives on the draws page.
 */
export function DrawAlertsAuto(): null {
  useDrawAlerts();
  return null;
}
