'use client';

import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from 'react';

import { EASE_OUT } from '@/components/ui/reveal';
import { CallIllustration, PhoneIllustration, ReplayIllustration } from '@/features/consultation/components/step-illustrations';
import { LABEL_CLASS, SECTION_TITLE_CLASS } from '@/features/consultation/lib/styles';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'before', Illustration: PhoneIllustration },
  { key: 'during', Illustration: CallIllustration },
  { key: 'after', Illustration: ReplayIllustration },
] as const satisfies readonly { key: string; Illustration: ComponentType<{ className?: string; playing?: boolean }> }[];

/** How far along the path the plane must be for each stop to show (desktop wave, mobile line alike). */
const REACHED = [0, 0.5, 0.92];

const WAVE = 'M0 70 C 160 -10, 300 140, 490 60 S 820 -10, 980 70';
const LINE = 'M2 0V236';

/**
 * « Comment se passe la consultation »: three stops on a dashed route
 * (docs/design/consultation-motion.md, row « Journey path »). As the section
 * crosses the viewport the route draws and a plane follows it; each stop
 * appears when the plane reaches it. Desktop: a wave across; mobile: a line
 * down. Reduced motion: the route drawn, the plane parked at the last stop,
 * the stops fade in.
 */
export function ConsultationJourney({ minutes }: { minutes: number }): ReactNode {
  const t = useTranslations('Consultation.page.steps');
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 65%'] });
  const progress = useTransform(scrollYProgress, (p) => (reduce ? 1 : p));
  const [reached, setReached] = useState(1);
  const reach = (p: number) => {
    const count = REACHED.filter((at) => p >= at).length;
    // Once shown, a stop stays: scrolling back up never hides it again.
    setReached((current) => Math.max(current, count));
  };
  useMotionValueEvent(progress, 'change', reach);
  // With reduced motion every stop is shown (fading in, without the lift).
  const shown = reduce ? REACHED.length : reached;

  return (
    <section ref={ref} aria-labelledby="consultation-steps" className="bg-off-white px-5 py-14 md:px-7 lg:py-22">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:gap-12">
        <h2 id="consultation-steps" className={SECTION_TITLE_CLASS}>
          {t('title')}
        </h2>
        <ol className="relative flex flex-col gap-7 lg:flex-row lg:gap-6 lg:pt-2">
          {/* Desktop: the wave from the first stop to the last. */}
          <Route
            path={WAVE}
            viewBox="0 0 980 120"
            progress={progress}
            className="absolute top-10 left-1/8 hidden w-3/4 lg:block"
            planeSize={44}
          />
          {/* Mobile: a line down the illustrations' column. */}
          <Route
            path={LINE}
            viewBox="0 0 4 236"
            progress={progress}
            className="absolute top-17.5 left-11 h-59 w-1 lg:hidden"
            planeSize={24}
          />
          {STEPS.map(({ key, Illustration }, index) => {
            const last = index === STEPS.length - 1;
            return (
              <motion.li
                key={key}
                initial={false}
                animate={index < shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: index < shown ? 0.06 : 0 }}
                className="relative flex items-center gap-4 lg:flex-1 lg:flex-col lg:items-center lg:gap-3.5 lg:text-center"
              >
                <Illustration playing={inView && !reduce} className="size-22.5 shrink-0 lg:size-42" />
                <span
                  aria-hidden={true}
                  className={cn(
                    'hidden size-8 shrink-0 items-center justify-center rounded-full font-heading text-body-sm leading-4.5 font-extrabold text-white lg:flex',
                    last ? 'bg-rouge' : 'bg-navy-deep',
                  )}
                >
                  {index + 1}
                </span>
                <div className="flex flex-1 flex-col gap-1 lg:items-center lg:gap-3.5">
                  <p className={cn(LABEL_CLASS, 'text-rouge')}>
                    <span className="lg:hidden">{index + 1} · </span>
                    {t(`${key}.eyebrow`)}
                  </p>
                  <h3 className="font-heading text-body-lg leading-6 font-bold text-ink lg:text-h4 lg:leading-6.5">
                    {t(`${key}.title`, { minutes })}
                  </h3>
                  <p className="text-body-sm leading-5 text-slate lg:max-w-85 lg:text-body lg:leading-6">
                    <span className="lg:hidden">{t(`${key}.short`)}</span>
                    <span className="hidden lg:inline">{t(`${key}.body`)}</span>
                  </p>
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/**
 * A dashed route that draws with `progress` (0 → 1), and the plane riding its tip.
 * The dashes are masked by a solid copy whose length grows, so they never stretch.
 */
function Route({
  path,
  viewBox,
  progress,
  className,
  planeSize,
}: {
  path: string;
  viewBox: string;
  progress: MotionValue<number>;
  className: string;
  planeSize: number;
}): ReactNode {
  const pathRef = useRef<SVGPathElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  useMotionValueEvent(progress, 'change', (p) => placePlane(pathRef, planeRef, p));
  useEffect(() => placePlane(pathRef, planeRef, progress.get()), [progress]);

  return (
    <svg aria-hidden={true} viewBox={viewBox} overflow="visible" className={className}>
      <defs>
        <mask id={`route-${planeSize}`} maskUnits="userSpaceOnUse">
          <motion.path d={path} fill="none" stroke="white" strokeWidth="12" strokeLinecap="round" style={{ pathLength: progress }} />
        </mask>
      </defs>
      <path
        ref={pathRef}
        d={path}
        mask={`url(#route-${planeSize})`}
        fill="none"
        className="stroke-rouge"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={planeSize > 30 ? '2 12' : '1 10'}
      />
      <g ref={planeRef} opacity={0}>
        <path
          d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"
          transform={`scale(${planeSize / 24}) translate(-12 -12)`}
          className="fill-navy-deep"
        />
      </g>
    </svg>
  );
}

/** Puts the plane at `p` along the path, its nose along the way it is going. */
function placePlane(
  pathRef: RefObject<SVGPathElement | null>,
  planeRef: RefObject<SVGGElement | null>,
  p: number,
): void {
  const path = pathRef.current;
  const plane = planeRef.current;
  if (!path || !plane || typeof path.getTotalLength !== 'function') return;
  const length = path.getTotalLength();
  const at = Math.min(Math.max(p, 0), 1) * length;
  const here = path.getPointAtLength(at);
  const ahead = path.getPointAtLength(Math.min(at + 1, length));
  const behind = path.getPointAtLength(Math.max(at - 1, 0));
  // The icon's nose points up (−y): turn it 90° past the direction of travel.
  const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI + 90;
  plane.setAttribute('transform', `translate(${here.x} ${here.y}) rotate(${angle})`);
  plane.setAttribute('opacity', p > 0 ? '1' : '0');
}
