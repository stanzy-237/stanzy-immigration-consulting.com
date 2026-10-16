import type { ComponentType, SVGProps } from 'react';

import { cn } from '@/lib/utils';

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const SIZE: Record<'inline' | 'ui' | 'feature' | 'hero', number> = {
  inline: 16,
  ui: 20,
  feature: 24,
  hero: 32,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'size'> {
  icon: LucideIcon;
  size?: keyof typeof SIZE | number;
  label?: string;
}

/**
 * Brand-aligned wrapper over Lucide icons. Sizes come from the design md
 * (16 inline, 20 UI, 24 feature, 32 hero). Pass `label` for a decorative-vs-
 * meaningful split: provided → role="img" + aria-label; omitted → aria-hidden.
 * Maps to the "Iconography" section of the Stanzy Design System.
 */
export function Icon({
  icon: LucideComponent,
  size = 'ui',
  label,
  className,
  ...props
}: IconProps) {
  const px = typeof size === 'number' ? size : SIZE[size];
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);
  return (
    <LucideComponent
      width={px}
      height={px}
      strokeWidth={2}
      className={cn('shrink-0', className)}
      {...a11y}
      {...props}
    />
  );
}
