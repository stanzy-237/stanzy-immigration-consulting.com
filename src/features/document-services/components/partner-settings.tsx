'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { NoteEditor } from '@/features/document-services/components/note-editor';
import { unknownPlaceholders, type NoteDoc } from '@/features/document-services/lib/handoff';
import { toMinor } from '@/features/invoices/lib/money';
import { useTRPC } from '@/trpc/client';

const field =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3 text-sm text-navy-deep focus:border-navy-deep focus:outline-none';
const EMPTY: NoteDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * On a service's page (#148): the partner it is handed to (name, WhatsApp,
 * email) and the note's template, its placeholders ({client}…) filled in
 * for each request.
 */
export function PartnerSettings({ serviceId }: { serviceId: string }): ReactNode {
  const t = useTranslations('DocumentServices.handoff');
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.documentServices.handoff.partner.queryOptions({ serviceId }));
  const [name, setName] = useState(data.partnerName ?? '');
  const [phone, setPhone] = useState(data.partnerPhone ?? '');
  const [email, setEmail] = useState(data.partnerEmail ?? '');
  const [share, setShare] = useState(data.partnerShare === null ? '' : String(data.partnerShare));
  const shareAmount = share.trim() === '' ? null : toMinor(share, 'XAF');
  const shareInvalid = share.trim() !== '' && shareAmount === null;
  const [template, setTemplate] = useState<NoteDoc>(data.handoffTemplate ?? EMPTY);
  const unknown = unknownPlaceholders(template);
  const save = useMutation(
    trpc.documentServices.handoff.savePartner.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.documentServices.handoff.pathKey() });
        toast.add({ title: t('settings.saved'), type: 'success' });
      },
      onError: (error) => {
        const known = t.has(`errors.${error.message}`);
        toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: 'warning' });
      },
    }),
  );
  const empty = JSON.stringify(template) === JSON.stringify(EMPTY);

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm"
    >
      <div>
        <h2 id={`${ids}-title`} className="font-heading text-lg font-bold text-navy-deep">
          {t('settings.title')}
        </h2>
        <p className="mt-1 text-sm text-slate">{t('settings.intro')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            ['name', name, setName, 'text', 120],
            ['phone', phone, setPhone, 'tel', 30],
            ['email', email, setEmail, 'email', 200],
          ] as const
        ).map(([key, value, set, type, max]) => (
          <label key={key} htmlFor={`${ids}-${key}`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep">
            {t(`settings.${key}`)}
            <input
              id={`${ids}-${key}`}
              type={type}
              value={value}
              maxLength={max}
              onChange={(event) => set(event.target.value)}
              className={field}
            />
          </label>
        ))}
      </div>
      <label htmlFor={`${ids}-share`} className="grid grid-cols-1 gap-1 text-sm font-semibold text-navy-deep sm:w-1/3">
        {t('settings.partnerShare')}
        <input
          id={`${ids}-share`}
          inputMode="numeric"
          value={share}
          aria-invalid={shareInvalid}
          aria-describedby={`${ids}-share-hint`}
          onChange={(event) => setShare(event.target.value)}
          className={`${field} tabular-nums`}
        />
        <span id={`${ids}-share-hint`} className={`text-xs font-normal ${shareInvalid ? 'text-crimson' : 'text-slate'}`}>
          {shareInvalid ? t('settings.partnerShareInvalid') : t('settings.partnerShareHint')}
        </span>
      </label>
      <div className="grid grid-cols-1 gap-1">
        <p className="text-sm font-semibold text-navy-deep">{t('settings.template')}</p>
        <NoteEditor initial={template} label={t('settings.template')} onChange={setTemplate} />
        {unknown.length > 0 ? (
          <p className="text-sm text-honey">{t('settings.unknown', { fields: unknown.map((one) => `{${one}}`).join(', ') })}</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={save.isPending || shareInvalid}
        onClick={() =>
          save.mutate({
            serviceId,
            partnerName: name,
            partnerPhone: phone,
            partnerEmail: email,
            partnerShare: shareAmount,
            template: empty ? null : template,
          })
        }
        className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-navy-deep px-5 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
      >
        <Save aria-hidden={true} className="size-4" />
        {save.isPending ? t('settings.saving') : t('settings.save')}
      </button>
    </section>
  );
}
