import { createTranslator } from 'next-intl';

import { DOCUMENT_GUIDES } from '@/features/checklist/data/document-guides';
import { buildChecklist, type ChecklistPerson, type ChecklistSlot } from '@/features/checklist/lib/build-checklist';
import { AREA_OF, type InterestAnswers } from '@/features/accompagnement/lib/interest-schema';
import { routing, toLocale, type Locale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

/** A name in each of the site's languages. */
export type Titles = Record<Locale, string>;

export type PlannedDocument = {
  title: string;
  kind: string;
  need: 'mandatory' | 'recommended';
  /** The Client said they don't have it: « Manquant ». */
  missing: boolean;
  clientNote: string | null;
  /** They asked Stanzy to get it (Cameroon only). */
  stanzy: boolean;
};
export type PlannedSection = { title: string; titles: Titles; documents: PlannedDocument[] };

/**
 * An Accompagnement Dossier's Sections IRCC and Documents, from the Demande
 * d'intérêt (#81): the Checklist's own logic (per person, IRCC's slots,
 * ★ Obligatoire then Recommandé), named in the Client's language. The
 * principal applicant's documents carry what the Demande said of their
 * area: « Je ne l'ai pas » or « Stanzy s'en charge » makes them Manquant,
 * and the area's note goes with them. Each Section is also named in every
 * language (`titles`), so it reads in whichever one the viewer uses.
 */
export function planDossier(answers: Pick<InterestAnswers, 'checklist' | 'areas'>, locale: unknown): PlannedSection[] {
  const lang = toLocale(locale);
  const guides = DOCUMENT_GUIDES[lang];
  const namers = routing.locales.map((code) => [code, sectionNamer(code)] as const);

  return buildChecklist(answers.checklist).flatMap((person) =>
    person.slots.map((slot) => {
      const titles = Object.fromEntries(namers.map(([code, name]) => [code, name(slot, person)])) as Titles;
      return {
        title: titles[lang],
        titles,
        documents: slot.pieces.map((piece) => {
          const area = person.kind === 'principal' ? AREA_OF[piece.document] : undefined;
          const said = area ? answers.areas[area] : undefined;
          return {
            title: guides[piece.document].name,
            kind: piece.document,
            need: piece.need,
            missing: said?.answer === 'missing' || said?.answer === 'stanzy',
            clientNote: said?.note || null,
            stanzy: said?.answer === 'stanzy' && piece.need === 'mandatory',
          };
        }),
      };
    }),
  );
}

/** « Diplômes – Requérant principal », in one language. */
function sectionNamer(lang: Locale) {
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Checklist.list' });
  return (slot: ChecklistSlot, person: ChecklistPerson): string => {
    const who = person.kind === 'child' ? t('people.child', { number: person.number ?? 1 }) : t(`people.${person.kind}`);
    return `${t(`slots.${slot.slot}`, { label: slot.label ?? '' })} – ${who}`;
  };
}
