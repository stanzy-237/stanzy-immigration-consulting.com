'use client';

import { ArrowDown, CalendarDays, PenLine, Stamp, Type } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { fieldStyle, PdfPages } from '@/features/shared/components/signing/pdf-pages';
import { SignaturePad } from '@/features/shared/components/signing/signature-pad';
import type { Ink } from '@/features/signatures/lib/inks';
import { NAME_MAX, type FieldKind, type SignatureField } from '@/features/signatures/lib/signature-schema';

const ICONS: Record<FieldKind, typeof PenLine> = { SIGNATURE: PenLine, NAME: Type, DATE: CalendarDays, STAMP: Stamp };

const fieldId = (index: number) => `signature-field-${index}`;

/**
 * Signing a PDF online (#96), as in Documenso, for a Demande de signature
 * and a Contrat alike: the Client clicks each framed field on the page — a
 * Signature opens a dialog to draw it (black or blue ink), the Nom complet
 * asks their name, the Date fills in — then « Terminer » asks them to
 * confirm they read and accept it, and `onSign` gets the name and the drawn
 * PNG. `actions` adds buttons to the bar at the bottom.
 */
export function SigningFlow({
  url,
  fields,
  document,
  signerName,
  pending,
  onSign,
  actions,
}: {
  url: string;
  fields: SignatureField[];
  /** Its title, in the confirmation. */
  document: string;
  /** The name the Account goes by, offered for the Nom complet. */
  signerName: string;
  pending: boolean;
  onSign: (signed: { name: string; signature: string }) => void;
  actions?: ReactNode;
}): ReactNode {
  const t = useTranslations('Signatures');
  const format = useFormatter();
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [filled, setFilled] = useState<ReadonlySet<number>>(new Set());
  const [drawing, setDrawing] = useState<number | null>(null);
  const [naming, setNaming] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const today = format.dateTime(new Date(), { dateStyle: 'short', timeZone: 'Africa/Douala' });

  // The fields the Client fills; the consultant's stamp is drawn by the server.
  const theirs = fields.flatMap((field, index) => (field.kind === 'STAMP' ? [] : [index]));
  const done = theirs.filter((index) => filled.has(index)).length;
  const complete = done === theirs.length;

  const fill = (index: number) => setFilled((current) => new Set(current).add(index));
  const unfill = (index: number) =>
    setFilled((current) => {
      const next = new Set(current);
      next.delete(index);
      return next;
    });

  const open = (field: SignatureField, index: number) => {
    if (field.kind === 'SIGNATURE') {
      if (signature && !filled.has(index)) fill(index);
      else setDrawing(index);
    } else if (field.kind === 'NAME') {
      if (name && !filled.has(index)) fill(index);
      else setNaming(index);
    } else if (field.kind === 'DATE') {
      if (filled.has(index)) unfill(index);
      else fill(index);
    }
  };

  const nextField = () => {
    const next = theirs.find((index) => !filled.has(index));
    if (next === undefined) return;
    const element = window.document.getElementById(fieldId(next));
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
  };

  return (
    <>
      <PdfPages
        url={url}
        overlay={(page) =>
          fields.map((field, index) =>
            field.page === page ? (
              <FieldButton
                key={index}
                id={fieldId(index)}
                field={field}
                value={
                  !filled.has(index)
                    ? null
                    : field.kind === 'SIGNATURE'
                      ? { image: signature! }
                      : { text: field.kind === 'NAME' ? name! : today }
                }
                onClick={() => open(field, index)}
              />
            ) : null,
          )
        }
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-fog-light bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-navy-deep" aria-live="polite">
            {t('sign.progress', { done, total: theirs.length })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {complete ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
              >
                <PenLine aria-hidden={true} className="size-4" />
                {t('sign.finish')}
              </button>
            ) : (
              <button
                type="button"
                onClick={nextField}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80"
              >
                <ArrowDown aria-hidden={true} className="size-4" />
                {t('sign.next')}
              </button>
            )}
          </div>
        </div>
      </div>

      <DrawDialog
        open={drawing !== null}
        onOpenChange={(next) => !next && setDrawing(null)}
        onApply={(png) => {
          setSignature(png);
          if (drawing !== null) fill(drawing);
          setDrawing(null);
        }}
      />
      <NameDialog
        open={naming !== null}
        initial={name ?? signerName}
        onOpenChange={(next) => !next && setNaming(null)}
        onApply={(value) => {
          setName(value);
          if (naming !== null) fill(naming);
          setNaming(null);
        }}
      />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        document={document}
        // Without a Nom complet field, the name is asked here: it goes in the record of the signature.
        name={fields.some((field) => field.kind === 'NAME') ? name : null}
        initialName={signerName}
        pending={pending}
        onSign={(signedName) => onSign({ name: signedName, signature: signature! })}
      />
    </>
  );
}

/** One field over the page: framed until filled, then showing what fills it. */
function FieldButton({
  id,
  field,
  value,
  onClick,
}: {
  id: string;
  field: SignatureField;
  value: { image: string } | { text: string } | null;
  onClick: () => void;
}): ReactNode {
  const t = useTranslations('Signatures');
  const Icon = ICONS[field.kind];
  const label = t(`fields.${field.kind}`);

  if (field.kind === 'STAMP') {
    return (
      <span
        className="absolute flex items-center justify-center gap-1 rounded-md border-2 border-dashed border-navy-deep/40 bg-navy-deep/5 text-xs font-semibold text-navy-deep"
        style={fieldStyle(field)}
      >
        <Stamp aria-hidden={true} className="size-3.5 shrink-0" />
        <span className="truncate">{t('sign.prompts.STAMP')}</span>
      </span>
    );
  }

  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-label={value ? t('sign.filledLabel', { field: label }) : t(`sign.prompts.${field.kind}`)}
      className={
        value
          ? 'absolute flex items-center overflow-hidden rounded-md border border-transparent px-1 hover:border-fog focus-visible:outline-2 focus-visible:outline-navy-deep'
          : 'absolute flex animate-pulse items-center justify-center gap-1 rounded-md border-2 border-dashed border-rouge bg-rouge/10 text-xs font-semibold text-rouge hover:animate-none hover:bg-rouge/20 focus-visible:animate-none focus-visible:outline-2 focus-visible:outline-navy-deep'
      }
      style={fieldStyle(field)}
    >
      {value === null ? (
        <>
          <Icon aria-hidden={true} className="size-3.5 shrink-0" />
          <span className="truncate">{t(`sign.prompts.${field.kind}`)}</span>
        </>
      ) : 'image' in value ? (
        // eslint-disable-next-line @next/next/no-img-element -- the signature just drawn, as a data URL
        <img src={value.image} alt="" className="size-full object-contain object-left" />
      ) : (
        <span className="truncate text-sm text-pen-black">{value.text}</span>
      )}
    </button>
  );
}

/** Draws the signature, in black or blue ink; « Appliquer » fills the field. */
function DrawDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (png: string) => void;
}): ReactNode {
  // The ink chosen stays for the next time.
  const [ink, setInk] = useState<Ink>('blue');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-4 p-5 sm:max-w-lg">
        {/* Mounted while open: a blank pad each time. */}
        {open ? <DrawForm ink={ink} onInk={setInk} onCancel={() => onOpenChange(false)} onApply={onApply} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DrawForm({
  ink,
  onInk,
  onCancel,
  onApply,
}: {
  ink: Ink;
  onInk: (ink: Ink) => void;
  onCancel: () => void;
  onApply: (png: string) => void;
}): ReactNode {
  const t = useTranslations('Signatures.sign.draw');
  const ids = useId();
  const [png, setPng] = useState<string | null>(null);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('title')}</DialogTitle>
        <DialogDescription id={`${ids}-body`} className="text-sm text-slate">
          {t('body')}
        </DialogDescription>
      </DialogHeader>
      <div role="radiogroup" aria-label={t('ink')} className="flex items-center gap-2">
        <span aria-hidden={true} className="text-sm font-semibold text-navy-deep">
          {t('ink')}
        </span>
        {(['black', 'blue'] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={ink === choice}
            onClick={() => onInk(choice)}
            className={
              ink === choice
                ? 'inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-navy-deep px-3 text-sm font-semibold text-navy-deep'
                : 'inline-flex h-9 items-center gap-1.5 rounded-full border-2 border-fog-light px-3 text-sm font-semibold text-slate hover:border-fog'
            }
          >
            <span
              aria-hidden={true}
              className={choice === 'black' ? 'size-3.5 rounded-full bg-pen-black' : 'size-3.5 rounded-full bg-pen-blue'}
            />
            {t(choice)}
          </button>
        ))}
      </div>
      <SignaturePad ink={ink} onChange={setPng} describedBy={`${ids}-body`} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          disabled={!png}
          onClick={() => png && onApply(png)}
          className="inline-flex h-11 items-center rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          {t('apply')}
        </button>
      </div>
    </>
  );
}

function NameField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}): ReactNode {
  const t = useTranslations('Signatures.sign');
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-navy-deep">
        {t('name')}
      </label>
      <input
        id={id}
        value={value}
        required={true}
        minLength={3}
        maxLength={NAME_MAX}
        autoComplete="name"
        autoFocus={autoFocus}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none"
      />
      <p id={`${id}-hint`} className="text-xs text-slate">
        {t('nameHint')}
      </p>
    </div>
  );
}

/** The Nom complet fields: the name typed once fills them all. */
function NameDialog({
  open,
  initial,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  initial: string;
  onOpenChange: (open: boolean) => void;
  onApply: (name: string) => void;
}): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-4 p-5 sm:max-w-md">
        {open ? <NameForm initial={initial} onCancel={() => onOpenChange(false)} onApply={onApply} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  initial,
  onCancel,
  onApply,
}: {
  initial: string;
  onCancel: () => void;
  onApply: (name: string) => void;
}): ReactNode {
  const t = useTranslations('Signatures.sign.nameDialog');
  const [value, setValue] = useState(initial);
  const ready = value.trim().length >= 3;
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) onApply(value.trim());
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('title')}</DialogTitle>
      </DialogHeader>
      <NameField value={value} onChange={setValue} autoFocus={true} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex h-11 items-center rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          {t('apply')}
        </button>
      </div>
    </form>
  );
}

/** « Terminer »: « J'ai lu et j'accepte », then the signature goes to the server. */
function ConfirmDialog({
  open,
  onOpenChange,
  document,
  name,
  initialName,
  pending,
  onSign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: string;
  /** The name the fields carry; null asks for it here. */
  name: string | null;
  initialName: string;
  pending: boolean;
  onSign: (name: string) => void;
}): ReactNode {
  const t = useTranslations('Signatures.sign');
  const [accepted, setAccepted] = useState(false);
  const [typed, setTyped] = useState(initialName);
  const signedName = (name ?? typed).trim();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-5 p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-bold text-navy-deep">
            {t('confirm.title', { document })}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-slate">{t('confirm.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        {name === null ? <NameField value={typed} onChange={setTyped} /> : null}
        <label className="flex items-start gap-3 text-sm text-navy-deep">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-rouge"
          />
          {t('accept')}
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">{t('confirm.cancel')}</AlertDialogCancel>
          <button
            type="button"
            disabled={!accepted || signedName.length < 3 || pending}
            onClick={() => onSign(signedName)}
            className="inline-flex items-center gap-2 rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            <PenLine aria-hidden={true} className="size-4" />
            {pending ? t('signing') : t('submit')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

