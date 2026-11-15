import { z } from 'zod';

import type { Answers } from '@/features/document-services/lib/requirements';

/**
 * The hand-off to a service's partner (#148): a note written from the
 * service's template, its placeholders filled in from the Client's details,
 * sent with the pieces handed over for the request.
 */

/** The placeholders a note can hold, as `{client}`. */
export const HANDOFF_FIELDS = [
  'client',
  'email',
  'telephone',
  'nationalite',
  'service',
  'date',
  'niu',
  'entreprise',
  'poste',
  'cnp',
  'date_premier_emploi',
  'comptes_salaire',
] as const;
export type HandoffField = (typeof HANDOFF_FIELDS)[number];

/** A note as the editor (Tiptap) keeps it. */
export type NoteNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NoteNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};
export type NoteDoc = { type: 'doc'; content?: NoteNode[] };

/** At most this much JSON: a note of a few pages. */
const NOTE_MAX_BYTES = 100_000;

/** A note from the editor: a document, of a sensible size. Its nodes are drawn by type; unknown ones are skipped. */
export const noteDocSchema = z.custom<NoteDoc>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'doc' &&
    JSON.stringify(value).length <= NOTE_MAX_BYTES,
  { message: 'HANDOFF_NOTE_INVALID' },
);

const PLACEHOLDER = /\{([a-z_]+)\}/g;
const known = (name: string): name is HandoffField => (HANDOFF_FIELDS as readonly string[]).includes(name);
const slashed = (day: string): string => day.split('-').reverse().join('/');

type Experience = { title: string; company: string; cnp: string; startOn: string; endOn: string | null };

/** What the Client told Stanzy: the account, their Demande d'intérêt (if any), the request's questionnaire. */
export type HandoffFacts = {
  client: { name: string; email: string };
  service: string;
  /** `YYYY-MM-DD`. */
  today: string;
  interest: { progress?: { citizenship?: string }; work?: { phone: string; experiences: Experience[] } } | null;
  request: Answers;
};

/**
 * Each placeholder's value: the job they hold now (else the latest), the
 * start of their first job, their salary accounts; blank when never said.
 */
export function handoffValues(facts: HandoffFacts): Record<HandoffField, string> {
  const jobs = [...(facts.interest?.work?.experiences ?? [])].sort((a, b) => a.startOn.localeCompare(b.startOn));
  const current = jobs.findLast((job) => job.endOn === null) ?? jobs.at(-1);
  const accounts = facts.request.salaryAccount ? facts.request.salaryAccounts : [];
  return {
    client: facts.client.name,
    email: facts.client.email,
    telephone: facts.interest?.work?.phone ?? '',
    nationalite: facts.interest?.progress?.citizenship ?? '',
    service: facts.service,
    date: slashed(facts.today),
    niu: facts.request.niu,
    entreprise: current?.company ?? '',
    poste: current?.title ?? '',
    cnp: current?.cnp ?? '',
    date_premier_emploi: jobs[0] ? slashed(jobs[0].startOn) : '',
    comptes_salaire: accounts
      .map((account) => `${account.company} (${slashed(account.startOn)} – ${account.endOn ? slashed(account.endOn) : '…'})`)
      .join('; '),
  };
}

const mapText = (node: NoteNode, change: (text: string) => string): NoteNode => ({
  ...node,
  ...(node.text !== undefined ? { text: change(node.text) } : {}),
  ...(node.content ? { content: node.content.map((child) => mapText(child, change)) } : {}),
});

/** `doc` with each known placeholder replaced in its text, the formatting kept; an unknown `{word}` stays. */
export function fillNote(doc: NoteDoc, values: Record<HandoffField, string>): NoteDoc {
  const fill = (text: string) => text.replace(PLACEHOLDER, (whole, name: string) => (known(name) ? values[name] : whole));
  return { ...doc, content: (doc.content ?? []).map((node) => mapText(node, fill)) };
}

/** The `{word}`s in `doc` that aren't placeholders: likely typos, shown in the template editor. */
export function unknownPlaceholders(doc: NoteDoc): string[] {
  const found = new Set<string>();
  const visit = (node: NoteNode) => {
    for (const [, name] of (node.text ?? '').matchAll(PLACEHOLDER)) if (!known(name!)) found.add(name!);
    node.content?.forEach(visit);
  };
  doc.content?.forEach(visit);
  return [...found];
}
