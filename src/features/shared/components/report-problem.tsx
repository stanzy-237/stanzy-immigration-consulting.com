'use client';

import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';
import { Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { recentRollbarItems } from '@/features/reports/lib/recent-errors';
import { MESSAGE_MAX, MESSAGE_MIN, pathOf } from '@/features/reports/lib/report-schema';
import { useTRPC } from '@/trpc/client';

/**
 * « Signaler un problème » (#160): the signed-in visitor says what went
 * wrong. The page they are on (its path only) and this tab's latest Rollbar
 * items go with it, for the consultant's Signalements.
 */
export function ReportProblemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  const t = useTranslations('Reports.dialog');
  const [sending, setSending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="gap-5 p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('title')}</DialogTitle>
          <DialogDescription className="text-sm text-slate">{t('description')}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: the closed menu item costs nothing. */}
        {open ? <ReportForm onSending={setSending} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReportForm({ onSending, onDone }: { onSending: (sending: boolean) => void; onDone: () => void }): ReactNode {
  const t = useTranslations('Reports.dialog');
  const trpc = useTRPC();
  const id = useId();
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState(false);
  const send = useMutation(trpc.reports.create.mutationOptions());

  const submit = async () => {
    const text = message.trim();
    if (text.length < MESSAGE_MIN) {
      setInvalid(true);
      return;
    }
    onSending(true);
    try {
      await send.mutateAsync({ message: text, path: pathOf(window.location.href), rollbarIds: recentRollbarItems() });
      onDone();
      toast.add({ title: t('sent'), type: 'success' });
    } catch (error) {
      const limited = error instanceof TRPCClientError && error.message === 'REPORT_LIMIT';
      toast.add({ title: limited ? t('limit') : t('failed'), type: 'error' });
    } finally {
      onSending(false);
    }
  };

  return (
    <form
      aria-label={t('title')}
      className="grid grid-cols-1 gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={`${id}-message`} className="text-sm font-semibold text-navy-deep">
        {t('label')}
      </label>
      <textarea
        id={`${id}-message`}
        rows={5}
        value={message}
        maxLength={MESSAGE_MAX}
        placeholder={t('placeholder')}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          setMessage(event.target.value);
          if (invalid) setInvalid(event.target.value.trim().length < MESSAGE_MIN);
        }}
        className="rounded-xl border-2 border-fog-light px-3 py-2 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge"
      />
      <p id={`${id}-hint`} className={invalid ? 'text-sm text-rouge' : 'text-xs text-slate'}>
        {invalid ? t('tooShort', { min: MESSAGE_MIN }) : t('hint')}
      </p>
      <DialogFooter className="mt-3">
        <DialogClose
          disabled={send.isPending}
          className="rounded-full border border-fog px-5 py-2 text-sm font-semibold text-navy-deep hover:bg-off-white disabled:opacity-50"
        >
          {t('cancel')}
        </DialogClose>
        <button
          type="submit"
          disabled={send.isPending}
          className="rounded-full bg-rouge px-5 py-2 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          {send.isPending ? t('sending') : t('send')}
        </button>
      </DialogFooter>
    </form>
  );
}

/** The Tableau de bord's header button (#160): an icon, named for screen readers, that opens the dialog. */
export function ReportProblemButton(): ReactNode {
  const t = useTranslations('Reports.dialog');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={t('title')}
        title={t('title')}
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-full text-navy-deep hover:bg-off-white"
      >
        <Flag aria-hidden={true} className="size-5" />
      </button>
      <ReportProblemDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
