import { createTranslator } from 'next-intl';

import { DOCUMENT_GUIDES } from '@/features/checklist/data/document-guides';
import { buildChecklist, type ChecklistPerson } from '@/features/checklist/lib/build-checklist';
import { AREA_OF, type InterestAnswers } from '@/features/accompagnement/lib/interest-schema';
import { toLocale } from '@/i18n/routing';
import en from '@/messages/en.json';
import fr from '@/messages/fr.json';

const MESSAGES = { fr, en } as const;

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
export type PlannedSection = { title: string; documents: PlannedDocument[] };

/**
 * An Accompagnement Dossier's Sections IRCC and Documents, from the Demande
 * d'intérêt (#81): the Checklist's own logic (per person, IRCC's slots,
 * ★ Obligatoire then Recommandé), named in the Client's language. The
 * principal applicant's documents carry what the Demande said of their
 * area: « Je ne l'ai pas » or « Stanzy s'en charge » makes them Manquant,
 * and the area's note goes with them.
 */
export function planDossier(answers: Pick<InterestAnswers, 'checklist' | 'areas'>, locale: unknown): PlannedSection[] {
  const lang = toLocale(locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: 'Checklist.list' });
  const guides = DOCUMENT_GUIDES[lang];
  const personName = (person: ChecklistPerson) =>
    person.kind === 'child' ? t('people.child', { number: person.number ?? 1 }) : t(`people.${person.kind}`);

  return buildChecklist(answers.checklist).flatMap((person) =>
    person.slots.map((slot) => ({
      title: `${t(`slots.${slot.slot}`, { label: slot.label ?? '' })} – ${personName(person)}`,
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
    })),
  );
}
