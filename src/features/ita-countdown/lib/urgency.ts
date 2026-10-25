export type Urgency = 'calm' | 'soon' | 'urgent';

/** How pressing the deadline is: over two weeks, over one, or the last week. */
export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft > 14) return 'calm';
  if (daysLeft > 7) return 'soon';
  return 'urgent';
}

/** Text and ring colours per urgency (green, amber, rouge). */
export const URGENCY_CLASSES: Record<Urgency, { text: string; stroke: string }> = {
  calm: { text: 'text-leaf', stroke: 'stroke-leaf' },
  soon: { text: 'text-honey', stroke: 'stroke-honey' },
  urgent: { text: 'text-rouge', stroke: 'stroke-rouge' },
};
