'use client';

import {
  BadgeCheck,
  BookCheck,
  ClipboardCheck,
  Fingerprint,
  GraduationCap,
  Languages,
  MailOpen,
  UserRoundPlus,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { motion, useInView, useScroll, useSpring } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useRef, type ReactNode } from 'react';

import { EASE_OUT } from '@/components/ui/reveal';
import { MapleLeaf } from '@/features/accompagnement/components/accompagnement-art';
import { WORKFLOWS } from '@/features/dossiers/data/workflows';

type Stage = (typeof WORKFLOWS.ACCOMPAGNEMENT)[number];

const ICONS: Record<Stage, LucideIcon> = {
  evaluation: ClipboardCheck,
  'test-langue': Languages,
  ede: GraduationCap,
  'profil-ee': UserRoundPlus,
  bassin: Waves,
  ita: MailOpen,
  depot: BadgeCheck,
  aor: Fingerprint,
  ppr: BookCheck,
  copr: BadgeCheck,
};

/** Soft shapes behind each stage's icon, turned a little differently each time. */
const BLOBS = [
  'M44 6c14 0 30 8 34 22s-2 32-14 40-32 10-44 2S2 44 6 30 30 6 44 6z',
  'M40 4c16 2 34 12 36 28s-8 34-24 40-34 0-44-12S0 32 8 20 24 2 40 4z',
  'M46 8c12 4 28 14 28 30s-14 32-30 36-30-6-36-18S4 26 14 16 34 4 46 8z',
];

/**
 * « Le chemin, étape par étape »: the 10 stages of an Accompagnement as a
 * story told on scroll. A rouge line fills the spine as the reader goes
 * down; each stage lights up when reached, its card coming in from its
 * side, and the last one ends on the maple leaf.
 */
export function StoryStages(): ReactNode {
  const stages = useTranslations('Dossiers.stages.ACCOMPAGNEMENT');
  const t = useTranslations('Accompagnement.page');
  const list = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: list, offset: ['start 70%', 'end 60%'] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const path = WORKFLOWS.ACCOMPAGNEMENT;

  return (
    <ol ref={list} className="relative mx-auto grid max-w-5xl gap-10 lg:gap-6">
      <span aria-hidden={true} className="absolute top-2 bottom-2 left-6 w-1 -translate-x-1/2 rounded-full bg-fog-light lg:left-1/2" />
      <motion.span
        aria-hidden={true}
        style={{ scaleY: fill }}
        className="absolute top-2 bottom-2 left-6 w-1 origin-top -translate-x-1/2 rounded-full bg-rouge lg:left-1/2"
      />
      {path.map((stage, index) => (
        <StageItem
          key={stage}
          stage={stage}
          index={index}
          last={index === path.length - 1}
          name={stages(stage)}
          text={t(`stageText.${stage}`)}
        />
      ))}
    </ol>
  );
}

function StageItem({
  stage,
  index,
  last,
  name,
  text,
}: {
  stage: Stage;
  index: number;
  last: boolean;
  name: string;
  text: string;
}): ReactNode {
  const ref = useRef<HTMLLIElement>(null);
  // Seen: it slides in, faded, as it enters the screen. Reached: it lights up two-fifths of the way up.
  const seen = useInView(ref, { once: true, margin: '0px 0px -5% 0px' });
  const reached = useInView(ref, { once: true, margin: '0px 0px -40% 0px' });
  const left = index % 2 === 0;
  const Icon = ICONS[stage];

  return (
    <li ref={ref} className="relative flex items-center gap-4 lg:grid lg:grid-cols-9 lg:gap-6">
      <motion.div
        initial={{ opacity: 0, x: left ? -24 : 24 }}
        animate={reached ? { opacity: 1, x: 0 } : seen ? { opacity: 0.45, x: 0 } : undefined}
        transition={{ duration: 0.55, ease: EASE_OUT }}
        className={`min-w-0 flex-1 lg:col-span-4 lg:row-start-1 ${left ? 'lg:col-start-1 lg:text-right' : 'lg:col-start-6'}`}
      >
        <div
          className={`flex items-center gap-4 rounded-3xl border p-5 shadow-sm transition-colors duration-500 ${
            left ? 'lg:flex-row-reverse' : ''
          } ${last ? 'border-rouge bg-blush' : reached ? 'border-fog-light bg-white' : 'border-transparent bg-white/60'}`}
        >
          <StageArt icon={Icon} index={index} last={last} reached={reached} />
          <div className="min-w-0">
            <h3 className="font-heading text-lg leading-snug font-bold text-navy-deep">{name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate">{text}</p>
          </div>
        </div>
      </motion.div>

      <div className="order-first flex w-12 shrink-0 justify-center lg:order-none lg:col-start-5 lg:row-start-1 lg:w-auto">
        <motion.span
          initial={false}
          animate={{ scale: reached ? 1 : 0.8 }}
          transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
          className={`relative z-10 flex size-12 items-center justify-center rounded-full font-heading font-bold ring-4 ring-off-white transition-colors duration-300 ${
            reached ? 'bg-rouge text-white' : 'bg-white text-slate'
          }`}
        >
          {last ? <MapleLeaf className="size-6" /> : index + 1}
        </motion.span>
      </div>
    </li>
  );
}

/** A stage's illustration: its icon on a soft shape, drawn in once the stage is reached. */
function StageArt({
  icon: Icon,
  index,
  last,
  reached,
}: {
  icon: LucideIcon;
  index: number;
  last: boolean;
  reached: boolean;
}): ReactNode {
  return (
    <span aria-hidden={true} className="relative flex size-20 shrink-0 items-center justify-center">
      <svg viewBox="0 0 80 80" className="absolute inset-0 size-full" style={{ rotate: `${index * 37}deg` }}>
        <motion.path
          d={BLOBS[index % BLOBS.length]}
          className={last ? 'fill-rouge' : 'fill-ice-blue'}
          initial={false}
          animate={{ scale: reached ? 1 : 0.6, opacity: reached ? 1 : 0.4 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          style={{ transformOrigin: '40px 40px' }}
        />
        <motion.circle
          cx="68"
          cy="14"
          r="4"
          className="fill-rose"
          initial={false}
          animate={{ scale: reached ? 1 : 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.2 }}
        />
        <motion.circle
          cx="10"
          cy="64"
          r="3"
          className="fill-steel-blue"
          initial={false}
          animate={{ scale: reached ? 1 : 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.3 }}
        />
      </svg>
      {last ? (
        <MapleLeaf className="relative size-9 text-white" />
      ) : (
        <Icon className="relative size-8 text-navy-deep" strokeWidth={1.75} />
      )}
    </span>
  );
}
