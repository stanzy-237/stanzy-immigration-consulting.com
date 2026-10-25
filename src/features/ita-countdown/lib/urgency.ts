export type Urgency = 'calm' | 'soon' | 'urgent';

/** How pressing the deadline is: over two weeks, over one, or the last week. */
export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft > 14) return 'calm';
  if (daysLeft > 7) return 'soon';
  return 'urgent';
}

/** Text colour, and the ring around the days tile, per urgency (green, amber, rouge). */
export const URGENCY_CLASSES: Record<Urgency, { text: string; ring: string }> = {
  calm: { text: 'text-leaf', ring: 'ring-leaf' },
  soon: { text: 'text-honey', ring: 'ring-honey' },
  urgent: { text: 'text-rouge', ring: 'ring-rouge' },
};
