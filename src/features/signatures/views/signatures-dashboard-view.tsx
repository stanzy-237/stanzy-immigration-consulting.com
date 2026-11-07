'use client';

import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ImagePlus, PenLine } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useId, useState, type ChangeEvent, type ReactNode } from 'react';

import { QueryBoundary } from '@/components/query-boundary';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { SignaturePad } from '@/features/shared/components/signing/signature-pad';
import { INKS, type Ink } from '@/features/signatures/lib/inks';
import { ASSET_KINDS, ASSET_MAX_BYTES, ASSET_TYPES, type AssetKind } from '@/features/signatures/lib/signature-schema';
import { useTRPC } from '@/trpc/client';

/**
 * « Signatures » in the Tableau de bord (#96): the consultant's signature
 * and the company stamp, uploaded once, and every document still waiting
 * for a Client's signature.
 */
export function SignaturesDashboardView(): ReactNode {
  const t = useTranslations('Signatures.dashboard');
  return (
    <div className="mx-auto grid grid-cols-1 max-w-4xl gap-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-navy-deep md:text-3xl">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate">{t('intro')}</p>
      </div>
      <QueryBoundary fallback={<SectionSkeleton />}>
        <SigningAssets />
      </QueryBoundary>
      <QueryBoundary fallback={<SectionSkeleton />}>
        <PendingRequests />
      </QueryBoundary>
    </div>
  );
}

function SigningAssets(): ReactNode {
  const t = useTranslations('Signatures.dashboard.assets');
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.signatures.assets.queryOptions());
  return (
    <section className="grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <div>
        <h2 className="font-heading text-xl font-bold text-navy-deep">{t('title')}</h2>
        <p className="mt-1 text-sm text-slate">{t('hint')}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ASSET_KINDS.map((kind) => (
          <AssetSlot key={kind} kind={kind} updatedAt={data[kind]} />
        ))}
      </div>
    </section>
  );
}

function AssetSlot({ kind, updatedAt }: { kind: AssetKind; updatedAt: Date | null }): ReactNode {
  const t = useTranslations('Signatures.dashboard.assets');
  const format = useFormatter();
  const id = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const label = t(kind);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ASSET_TYPES.includes(file.type as (typeof ASSET_TYPES)[number]) || file.size > ASSET_MAX_BYTES) {
      toast.add({ title: t('failed'), type: 'warning' });
      return;
    }
    await send(file);
  };

  /** The image to the server, encrypted there like any other: chosen from a file, or drawn here. */
  const send = async (file: File) => {
    setSending(true);
    try {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', file);
      const response = await fetch('/api/signatures/assets', { method: 'POST', body: form });
      if (!response.ok) throw new Error(String(response.status));
      await queryClient.invalidateQueries({ queryKey: trpc.signatures.assets.queryKey() });
      toast.add({ title: t('saved'), type: 'success' });
    } catch {
      toast.add({ title: t('failed'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-off-white p-4">
      <p className="text-sm font-semibold text-navy-deep">{label}</p>
      <div className="grid h-32 place-items-center rounded-lg border-2 border-dashed border-fog bg-white">
        {updatedAt ? (
          // eslint-disable-next-line @next/next/no-img-element -- a private image, decrypted by the server per request
          <img
            src={`/api/signatures/assets/${kind.toLowerCase()}?v=${new Date(updatedAt).getTime()}`}
            alt={t('preview', { label })}
            className="max-h-28 max-w-full object-contain"
          />
        ) : (
          <span className="text-sm text-slate">{t('missing')}</span>
        )}
      </div>
      {updatedAt ? (
        <p className="text-xs text-slate">
          {t('updated', { date: format.dateTime(updatedAt, { day: 'numeric', month: 'long', year: 'numeric' }) })}
        </p>
      ) : null}
      <input
        id={id}
        type="file"
        accept={ASSET_TYPES.join(',')}
        disabled={sending}
        onChange={choose}
        aria-label={`${updatedAt ? t('replace') : t('add')} : ${label}`}
        className="peer sr-only"
      />
      <div className="flex flex-wrap gap-2">
        {/* The signature can also be drawn, as on a Contrat; the stamp is an image. */}
        {kind === 'SIGNATURE' ? (
          <button
            type="button"
            disabled={sending}
            onClick={() => setDrawing(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-navy-deep px-4 text-sm font-semibold text-white hover:bg-navy-80 disabled:opacity-50"
          >
            <PenLine aria-hidden={true} className="size-4" />
            {t('draw')}
          </button>
        ) : null}
        <label
          htmlFor={id}
          className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border-2 border-navy-deep px-4 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-navy-deep peer-disabled:cursor-wait peer-disabled:opacity-50"
        >
          <ImagePlus aria-hidden={true} className="size-4" />
          {sending ? t('uploading') : updatedAt ? t('replace') : t('add')}
        </label>
      </div>
      {drawing ? (
        <DrawSignature
          onClose={() => setDrawing(false)}
          onSave={async (file) => {
            setDrawing(false);
            await send(file);
          }}
        />
      ) : null}
    </div>
  );
}

/** The consultant signs on the pad, in black or blue ink; saved as the transparent PNG the Contrats carry. */
function DrawSignature({ onClose, onSave }: { onClose: () => void; onSave: (file: File) => Promise<void> }): ReactNode {
  const t = useTranslations('Signatures.dashboard.assets');
  const [ink, setInk] = useState<Ink>('black');
  const [png, setPng] = useState<string | null>(null);
  const hint = useId();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('drawTitle')}</DialogTitle>
          <DialogDescription id={hint} className="text-sm text-slate">
            {t('drawHint')}
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label={t('ink')} className="flex gap-2">
          {(Object.keys(INKS) as Ink[]).map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={ink === choice}
              onClick={() => setInk(choice)}
              className="inline-flex h-9 items-center gap-2 rounded-full border-2 border-fog-light px-3 text-sm font-semibold text-navy-deep aria-checked:border-navy-deep"
            >
              <span aria-hidden={true} className="size-3 rounded-full" style={{ backgroundColor: INKS[choice] }} />
              {t(`inks.${choice}`)}
            </button>
          ))}
        </div>
        <SignaturePad ink={ink} onChange={setPng} describedBy={hint} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-full px-4 text-sm font-semibold text-navy-deep hover:bg-off-white">
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={!png}
            onClick={async () => {
              if (!png) return;
              const blob = await (await fetch(png)).blob();
              await onSave(new File([blob], 'signature.png', { type: 'image/png' }));
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
          >
            {t('drawSave')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PendingRequests(): ReactNode {
  const t = useTranslations('Signatures.dashboard.pending');
  const dossiers = useTranslations('Dossiers');
  const format = useFormatter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.signatures.pending.queryOptions());
  return (
    <section className="grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
      <h2 className="font-heading text-xl font-bold text-navy-deep">{t('title')}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-slate">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {data.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-off-white px-3 py-2"
            >
              <span className="min-w-0 text-sm">
                <span className="block truncate font-semibold text-navy-deep">{request.document.title}</span>
                <span className="block truncate text-xs text-slate">
                  {request.dossier.account.name} · {dossiers(`services.${request.dossier.service}`)} ·{' '}
                  {t('sentOn', {
                    date: format.dateTime(request.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }),
                  })}
                </span>
              </span>
              <Link
                href={`/dossiers/${request.dossier.id}?document=${request.document.id}#documents`}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-rouge hover:text-crimson"
              >
                {t('open')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionSkeleton(): ReactNode {
  const t = useTranslations('Signatures.dashboard');
  return (
    <div role="status">
      <span className="sr-only">{t('loading')}</span>
      <Skeleton aria-hidden={true} className="h-56 rounded-2xl" />
    </div>
  );
}
