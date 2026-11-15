'use client';

import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Download, FileOutput, Mail, MessageCircle, RotateCcw, Save, Send, Share2 } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import NextLink from 'next/link';
import { useId, useState, type ReactNode } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { NoteEditor } from '@/features/document-services/components/note-editor';
import type { NoteDoc } from '@/features/document-services/lib/handoff';
import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';
import { PdfWorkbench } from '@/features/pdf-tools/components/pdf-workbench';
import { readSource } from '@/features/pdf-tools/lib/browser-pdf';
import type { Source } from '@/features/pdf-tools/lib/pages';
import { browserEngine, downloadPdf } from '@/features/pdf-tools/views/pdf-tools-view';
import { useTRPC } from '@/trpc/client';
import type { RouterOutputs } from '@/trpc/types';

type Handoff = RouterOutputs['documentServices']['handoff']['get'];

const card = 'grid grid-cols-1 gap-4 rounded-2xl border border-fog-light bg-white p-5 shadow-sm';
const action =
  'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';

/** The note's PDF, as the server draws it from the saved note. */
export const handoffNoteUrl = (requestId: string): string => `/api/requirements/${requestId}/handoff-note`;

/** WhatsApp on the partner's number (any chat without one), the message written. */
export const whatsappUrl = (phone: string | null, text: string): string =>
  `https://wa.me/${(phone ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

/**
 * « Transmission au partenaire » on a service request, for the consultant
 * (#148): the note (from the service's template, its fields filled in),
 * the pieces handed over to attach, and « Exporter vers l'Outil PDF »,
 * where the note then the pieces are organised, compressed, and sent to
 * the partner on WhatsApp or by email.
 */
export function HandoffPanel({ requestId }: { requestId: string }): ReactNode {
  const t = useTranslations('DocumentServices.handoff');
  const locale = useLocale();
  const format = useFormatter();
  const ids = useId();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(trpc.documentServices.handoff.get.queryOptions({ requestId }));
  const [note, setNote] = useState<NoteDoc>(data.note);
  // Bumped to start the editor again (« Repartir du modèle »).
  const [edition, setEdition] = useState(0);
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Source[] | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: trpc.documentServices.handoff.get.queryKey({ requestId }) });
  const failed = (error: { message: string }) => {
    const known = t.has(`errors.${error.message}`);
    toast.add({ title: t(known ? `errors.${error.message}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
  };
  const saveNote = useMutation(trpc.documentServices.handoff.saveNote.mutationOptions());
  const service = data.service.name[locale] ?? data.service.name.fr ?? '';
  const pieces = data.pieces.filter((piece) => !left.has(piece.id));

  const save = async () => {
    try {
      await saveNote.mutateAsync({ requestId, note });
      void refresh();
      toast.add({ title: t('panel.noteSaved'), type: 'success' });
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    }
  };

  const reset = async () => {
    try {
      await saveNote.mutateAsync({ requestId, note: null });
      const fresh = await queryClient.fetchQuery(trpc.documentServices.handoff.get.queryOptions({ requestId }));
      setNote(fresh.note);
      setEdition((current) => current + 1);
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    }
  };

  // The note saved first (its PDF is drawn from it), then the note and each piece read as the Outil PDF reads files.
  const open = async () => {
    setLoading(true);
    try {
      await saveNote.mutateAsync({ requestId, note });
      void refresh();
      const read = async (url: string, name: string, id: string): Promise<Source | null> => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(String(response.status));
          return await readSource(await response.blob(), name, id);
        } catch {
          toast.add({ title: t('export.loadFailed', { name }), type: 'warning' });
          return null;
        }
      };
      const loaded = await Promise.all([
        read(handoffNoteUrl(requestId), 'note.pdf', 'note'),
        ...pieces.map((piece) => read(piece.url, piece.fileName, piece.id)),
      ]);
      setSources(loaded.filter((source): source is Source => source !== null));
    } catch (error) {
      failed({ message: error instanceof Error ? error.message : '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-labelledby={`${ids}-title`} className={card}>
      <div>
        <h2 id={`${ids}-title`} className="font-heading text-lg font-bold text-navy-deep">
          {t('panel.title')}
        </h2>
        {data.partner.name || data.partner.email || data.partner.phone ? (
          <p className="mt-1 text-sm text-slate">
            {t('panel.to', {
              partner: [data.partner.name, data.partner.phone, data.partner.email].filter(Boolean).join(' · '),
            })}
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate">
            {t('panel.noPartner')}{' '}
            <NextLink href={`/services/${data.service.id}`} className="font-semibold text-rouge hover:text-crimson">
              {t('panel.settingsLink')}
            </NextLink>
          </p>
        )}
        {data.sentAt && data.sentTo ? (
          <p className="mt-1 text-sm text-leaf">
            {t('panel.sentOn', {
              to: data.sentTo,
              date: format.dateTime(data.sentAt, { day: 'numeric', month: 'long', year: 'numeric' }),
            })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <h3 className="text-sm font-semibold text-navy-deep">{t('panel.note')}</h3>
        <p className="text-xs text-slate">{data.hasTemplate ? t('panel.noteHint') : t('panel.noTemplate')}</p>
        <NoteEditor key={edition} initial={note} label={t('panel.note')} onChange={setNote} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saveNote.isPending}
            onClick={() => void save()}
            className={`${action} border-2 border-navy-deep text-navy-deep hover:bg-navy-deep hover:text-white`}
          >
            <Save aria-hidden={true} className="size-4" />
            {t('panel.saveNote')}
          </button>
          {data.hasTemplate && data.saved ? (
            <button
              type="button"
              disabled={saveNote.isPending}
              onClick={() => void reset()}
              className={`${action} text-slate hover:text-navy-deep`}
            >
              <RotateCcw aria-hidden={true} className="size-4" />
              {t('panel.reset')}
            </button>
          ) : null}
        </div>
      </div>

      <fieldset className="grid grid-cols-1 gap-2">
        <legend className="mb-1 text-sm font-semibold text-navy-deep">{t('panel.pieces')}</legend>
        {data.pieces.length === 0 ? (
          <p className="text-sm text-slate">{t('panel.noPieces')}</p>
        ) : (
          <>
            <p className="text-xs text-slate">{t('panel.piecesHint')}</p>
            {data.pieces.map((piece) => (
              <label key={piece.id} className="flex min-h-11 items-center gap-3 rounded-lg bg-off-white px-3 text-sm text-navy-deep">
                <input
                  type="checkbox"
                  checked={!left.has(piece.id)}
                  onChange={(event) =>
                    setLeft((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.delete(piece.id);
                      else next.add(piece.id);
                      return next;
                    })
                  }
                  className="size-5 accent-rouge"
                />
                <span className="min-w-0">
                  <span className="font-semibold">{piece.label[locale as 'fr' | 'en'] ?? piece.label.fr}</span>
                  <span className="block truncate text-xs text-slate">{piece.fileName}</span>
                </span>
              </label>
            ))}
          </>
        )}
      </fieldset>

      <button
        type="button"
        disabled={loading}
        onClick={() => void open()}
        className={`${action} w-fit bg-rouge text-white hover:bg-crimson`}
      >
        <FileOutput aria-hidden={true} className="size-4" />
        {loading ? t('panel.exporting') : t('panel.export')}
      </button>

      {sources ? (
        <HandoffExport
          requestId={requestId}
          data={data}
          service={service}
          sources={sources}
          onClose={() => setSources(null)}
          onSent={() => void refresh()}
        />
      ) : null}
    </section>
  );
}

/** The Outil PDF on the note and the pieces; once ready, share it, download it, or email it to the partner. */
function HandoffExport({
  requestId,
  data,
  service,
  sources,
  onClose,
  onSent,
}: {
  requestId: string;
  data: Handoff;
  service: string;
  sources: Source[];
  onClose: () => void;
  onSent: () => void;
}): ReactNode {
  const t = useTranslations('DocumentServices.handoff');
  const tools = useTranslations('PdfTools');
  const format = useFormatter();
  const trpc = useTRPC();
  const [ready, setReady] = useState<File | null>(null);
  const email = useMutation(trpc.documentServices.handoff.email.mutationOptions());
  const [sending, setSending] = useState(false);
  const text = t('export.whatsappText', { client: data.values.client, service });
  const share =
    ready && typeof navigator !== 'undefined' && navigator.canShare?.({ files: [ready] }) ? ready : null;

  const send = async () => {
    if (!ready || !data.partner.email) return;
    setSending(true);
    try {
      const uploaded = await uploadEncryptedFile(ready, { uploadRoute: '/api/requirements/handoff-upload', payload: { requestId } });
      await email.mutateAsync({ requestId, file: uploaded });
      toast.add({ title: t('export.emailed', { to: data.partner.email }), type: 'success' });
      onSent();
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      const known = t.has(`errors.${reason}`);
      toast.add({ title: t(known ? `errors.${reason}` : 'errors.UNKNOWN'), type: known ? 'warning' : 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-dvh gap-4 overflow-y-auto p-5 sm:max-w-6xl">
        <div>
          <DialogTitle className="font-heading text-xl font-bold text-navy-deep">{t('export.title', { service })}</DialogTitle>
          <DialogDescription className="text-sm text-slate">{t('export.intro')}</DialogDescription>
        </div>
        {ready ? (
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-leaf-tint p-4">
            <p className="text-sm font-semibold text-navy-deep">
              {t('export.ready', {
                size: tools('size', { size: format.number(ready.size / 1024 / 1024, { maximumFractionDigits: 1 }) }),
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {share ? (
                <button
                  type="button"
                  onClick={() => void navigator.share({ files: [share], title: share.name, text }).catch(() => undefined)}
                  className={`${action} bg-navy-deep text-white hover:bg-navy-80`}
                >
                  <Share2 aria-hidden={true} className="size-4" />
                  {t('export.share')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void ready.arrayBuffer().then((bytes) => downloadPdf(new Uint8Array(bytes), ready.name))}
                className={`${action} border-2 border-navy-deep text-navy-deep hover:bg-navy-deep hover:text-white`}
              >
                <Download aria-hidden={true} className="size-4" />
                {t('export.download')}
              </button>
              <a
                href={whatsappUrl(data.partner.phone, text)}
                target="_blank"
                rel="noopener"
                className={`${action} border-2 border-leaf text-leaf hover:bg-leaf hover:text-white`}
              >
                <MessageCircle aria-hidden={true} className="size-4" />
                {t('export.whatsapp')}
              </a>
              {data.partner.email ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void send()}
                  className={`${action} bg-rouge text-white hover:bg-crimson`}
                >
                  <Mail aria-hidden={true} className="size-4" />
                  {sending ? t('export.emailing') : t('export.email', { to: data.partner.email })}
                </button>
              ) : null}
            </div>
            <p className="text-xs text-slate">{data.partner.email ? t('export.whatsappHint') : `${t('export.whatsappHint')} ${t('export.noEmail')}`}</p>
          </div>
        ) : null}
        <PdfWorkbench
          engine={browserEngine}
          initialSources={sources}
          finish={{
            label: t('export.finish'),
            icon: Send,
            run: async (pdf, meta) => setReady(new File([pdf.slice()], meta.name, { type: 'application/pdf' })),
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
