'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Download, Gauge, HardDrive, ShieldCheck } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { toast } from '@/components/ui/toast';
import { useCurrentAccount } from '@/features/auth/hooks/use-current-account';
import { withNext } from '@/features/auth/lib/safe-next-path';
import { PdfWorkbench, type WorkbenchEngine } from '@/features/pdf-tools/components/pdf-workbench';
import { FREE_COMPRESSIONS_PER_MONTH, MAX_SOURCE_BYTES } from '@/features/pdf-tools/lib/quota';
import { browserEngine, downloadPdf } from '@/features/pdf-tools/views/pdf-tools-view';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';
import { Link, useRouter } from '@/i18n/navigation';
import { track } from '@/lib/analytics';
import { useTRPC } from '@/trpc/client';

const PAGE = '/outils/pdf';
const PROMISES = [
  { key: 'private', icon: ShieldCheck },
  { key: 'heavy', icon: HardDrive },
  { key: 'free', icon: Gauge },
] as const;

/**
 * The Outil PDF in « Outils », free for everyone: assemble, reorder, rotate
 * and download with no account, files up to 100 Mo each, all in the browser
 * (nothing is uploaded). Compressing under IRCC's 4 Mo needs a free account:
 * 10 compressions per calendar month, counted on the server. A paid plan
 * comes later, with the AI tools.
 */
export function PublicPdfToolView({ engine = browserEngine }: { engine?: WorkbenchEngine }): ReactNode {
  const t = useTranslations('PdfTools.public');
  const format = useFormatter();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { account } = useCurrentAccount();
  const quota = useQuery({ ...trpc.pdfTools.quota.get.queryOptions(), enabled: Boolean(account) });
  const use = useMutation(trpc.pdfTools.quota.use.mutationOptions());
  const renews = (date: Date) => format.dateTime(date, { day: 'numeric', month: 'long' });

  const allow = async (): Promise<boolean> => {
    if (!account) {
      toast.add({ title: t('signInToCompress'), type: 'info' });
      // The sign-in opens as a dialog over this page: the pages added stay.
      router.push(withNext('/connexion', PAGE));
      return false;
    }
    const current = await queryClient.fetchQuery({ ...trpc.pdfTools.quota.get.queryOptions(), staleTime: 0 });
    if (current.limit !== null && current.used >= current.limit) {
      toast.add({ title: t('quotaReached', { date: renews(current.renewsAt) }), type: 'warning' });
      return false;
    }
    return true;
  };

  const used = async (): Promise<void> => {
    try {
      await use.mutateAsync();
      track('pdf.compressed');
    } catch {
      // Counted on the next try: the compression the visitor made stays theirs.
    } finally {
      void queryClient.invalidateQueries({ queryKey: trpc.pdfTools.quota.get.queryKey() });
    }
  };

  const note = !account
    ? t('noteSignedOut', { count: FREE_COMPRESSIONS_PER_MONTH })
    : quota.data
      ? quota.data.limit === null
        ? t('noteUnlimited')
        : t('noteLeft', {
            left: Math.max(0, quota.data.limit - quota.data.used),
            count: quota.data.limit,
            date: renews(quota.data.renewsAt),
          })
      : null;

  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-off-white">
        <section aria-labelledby="pdf-tool-title" className="bg-white px-5 py-12 md:px-7 md:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-rose bg-blush px-3.5 py-1.5">
              <span aria-hidden={true} className="h-1 w-4 shrink-0 rounded-full bg-rouge" />
              <span className="text-xs font-semibold tracking-widest text-rouge uppercase">{t('eyebrow')}</span>
            </div>
            <h1
              id="pdf-tool-title"
              className="mt-5 max-w-3xl font-heading text-[clamp(34px,4vw,50px)] leading-none font-bold tracking-tight text-navy-deep"
            >
              {t('titleLead')} <span className="text-rouge">{t('titleAccent')}</span>
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate">{t('subtitle')}</p>
            <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PROMISES.map(({ key, icon: Icon }) => (
                <li key={key} className="flex items-start gap-3 rounded-2xl bg-off-white p-4">
                  <span aria-hidden={true} className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ice-blue">
                    <Icon className="size-5 text-navy-deep" />
                  </span>
                  <span className="text-sm text-navy-deep">
                    {t(`promises.${key}`, { count: FREE_COMPRESSIONS_PER_MONTH })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 py-10 md:px-7">
          <PdfWorkbench
            engine={engine}
            maxSourceBytes={MAX_SOURCE_BYTES}
            compressGate={{ allow, used, note }}
            finish={{
              label: t('download'),
              icon: Download,
              run: async (pdf, meta) => {
                downloadPdf(pdf, meta.name);
                track('pdf.downloaded', { pages: meta.pageCount, compressed: meta.quality !== null });
              },
            }}
          />

          <section
            aria-labelledby="pdf-tool-next"
            className="flex flex-col gap-4 rounded-3xl bg-navy-deep p-6 text-white md:flex-row md:items-center md:p-8"
          >
            <div className="flex-1">
              <h2 id="pdf-tool-next" className="font-heading text-xl font-bold">
                {t('nextTitle')}
              </h2>
              <p className="mt-1 text-sm text-ice-blue">{t('nextBody')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/outils/checklist"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-navy-deep hover:bg-ice-blue"
              >
                {t('checklist')}
              </Link>
              <Link
                href="/services/accompagnement"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson"
              >
                {t('accompagnement')}
                <ArrowRight aria-hidden={true} className="size-4" />
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
