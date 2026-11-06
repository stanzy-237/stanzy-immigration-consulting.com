'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';

/** A strong ease-out: fast start, gentle landing. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * Fades and lifts its content in the first time it scrolls into view. Only
 * transform and opacity move; with « reduce motion » it simply appears
 * (wrap the page in `<MotionConfig reducedMotion="user">`).
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  ...props
}: { children: ReactNode; delay?: number; y?: number } & Omit<HTMLMotionProps<'div'>, 'children'>): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
