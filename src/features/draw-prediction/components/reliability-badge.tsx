import { Gauge } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Reliability } from '@/features/draw-prediction/lib/predict-next-draws';

const TONE: Record<Reliability['level'] | 'unknown', string> = {
  high: 'border-leaf-line bg-leaf-tint text-leaf',
  medium: 'border-honey-line bg-honey-tint text-honey',
  low: 'border-rose bg-blush text-rouge',
  unknown: 'border-fog-light bg-off-white text-slate',
};

/** « Fiabilité élevée »: a pill toned by how often the method found the group's past Tirages. */
export function ReliabilityBadge({ reliability, label }: { reliability: Reliability | null; label: string }): ReactNode {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-label text-xs font-bold uppercase tracking-wider ${TONE[reliability?.level ?? 'unknown']}`}
    >
      <Gauge aria-hidden={true} className="size-3.5" />
      {label}
    </span>
  );
}
