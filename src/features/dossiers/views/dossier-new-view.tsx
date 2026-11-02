'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useId, useState, type FormEvent, type ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { SERVICE_TYPES, WORKFLOWS, type ServiceType } from '@/features/dossiers/data/workflows';
import { accountSearchInput } from '@/features/dossiers/lib/dossier-schema';
// The dashboard runs on admin.<site>: plain links to its short paths (see dashboard-host).
import Link from 'next/link';
import { useTRPC } from '@/trpc/client';

const input =
  'h-11 w-full rounded-xl border-2 border-fog-light bg-white px-3.5 text-sm text-navy-deep focus:border-navy-deep focus:outline-none aria-invalid:border-rouge';
const label = 'mb-1.5 block text-sm font-semibold text-navy-deep';
const hint = 'mt-1 text-xs text-slate';

type Account = { id: string; name: string; email: string; status: 'USER' | 'LEAD' | 'CLIENT' };

/**
 * Ouvrir un dossier: pick an Account, a service and the stage it starts at.
 * Until the Demandes d'intérêt (#81) and orders (#80, #83) open Dossiers
 * themselves, this is how the consultant starts one.
 */
export function DossierNewView(): ReactNode {
  const t = useTranslations('Dossiers');
  const ids = useId();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [account, setAccount] = useState<Account | null>(null);
  const [service, setService] = useState<ServiceType>('ACCOMPAGNEMENT');
  const [startStage, setStartStage] = useState<string>(WORKFLOWS.ACCOMPAGNEMENT[0]);
  const [missingAccount, setMissingAccount] = useState(false);

  const open = useMutation(
    trpc.dossiers.dashboard.open.mutationOptions({
      onSuccess: ({ id }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.dossiers.dashboard.list.queryKey() });
        toast.add({ title: t('toast.opened'), type: 'success' });
        router.push(`/dossiers/${id}`);
      },
      onError: () => toast.add({ title: t('toast.failed'), type: 'error' }),
    }),
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setMissingAccount(!account);
    if (account) open.mutate({ accountId: account.id, service, startStage });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dossiers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-navy-deep">
        <ArrowLeft aria-hidden={true} className="size-4" />
        {t('detail.back')}
      </Link>
      <h1 className="font-heading text-3xl font-bold text-navy-deep">{t('new.title')}</h1>
      <p className="mt-1 text-sm text-slate">{t('new.intro')}</p>

      <form onSubmit={submit} noValidate className="mt-6 grid gap-5 rounded-2xl border border-fog-light bg-white p-5 shadow-sm">
        <AccountPicker
          id={`${ids}-account`}
          value={account}
          onChange={(next) => {
            setAccount(next);
            if (next) setMissingAccount(false);
          }}
          invalid={missingAccount}
        />

        <div>
          <label htmlFor={`${ids}-service`} className={label}>
            {t('new.service')}
          </label>
          <select
            id={`${ids}-service`}
            className={input}
            value={service}
            onChange={(event) => {
              const next = event.target.value as ServiceType;
              setService(next);
              setStartStage(WORKFLOWS[next][0]);
            }}
          >
            {SERVICE_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`services.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${ids}-stage`} className={label}>
            {t('new.startStage')}
          </label>
          <select
            id={`${ids}-stage`}
            className={input}
            value={startStage}
            aria-describedby={`${ids}-stage-hint`}
            onChange={(event) => setStartStage(event.target.value)}
          >
            {WORKFLOWS[service].map((stage, index) => (
              <option key={stage} value={stage}>
                {index + 1}. {t(`stages.${service}.${stage}` as never)}
              </option>
            ))}
          </select>
          <p id={`${ids}-stage-hint`} className={hint}>
            {t('new.startHint')}
          </p>
        </div>

        <button
          type="submit"
          disabled={open.isPending}
          className="inline-flex h-11 items-center justify-center rounded-full bg-rouge px-5 text-sm font-semibold text-white hover:bg-crimson disabled:opacity-50"
        >
          {t('new.submit')}
        </button>
      </form>
    </div>
  );
}

/** Finds an Account by name or email; once one is chosen, shows it with « Changer ». */
function AccountPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: Account | null;
  onChange: (account: Account | null) => void;
  invalid: boolean;
}): ReactNode {
  const t = useTranslations('Dossiers.new');
  const trpc = useTRPC();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const searchable = accountSearchInput.safeParse({ query: deferred }).success;
  const { data: matches, isPending } = useQuery({
    ...trpc.dossiers.dashboard.searchAccounts.queryOptions({ query: deferred }),
    enabled: searchable && !value,
  });

  if (value) {
    return (
      <div>
        <p className={label}>{t('account')}</p>
        <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-navy-deep px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy-deep">{value.name}</span>
            <span className="block truncate text-xs text-slate">
              {value.email} · {t(`accountStatus.${value.status}`)}
            </span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="shrink-0 text-sm font-semibold text-rouge hover:text-crimson">
            {t('change')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className={label}>
        {t('account')}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="off"
        className={input}
        value={query}
        placeholder={t('searchPlaceholder')}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p id={`${id}-hint`} className={invalid ? 'mt-1 text-sm text-rouge' : hint}>
        {invalid ? t('accountRequired') : t('searchHint')}
      </p>
      {searchable ? (
        <div className="mt-2">
          {isPending ? (
            <div role="status">
              <span className="sr-only">{t('loading')}</span>
              <div aria-hidden={true} className="grid gap-2">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
              </div>
            </div>
          ) : matches && matches.length > 0 ? (
            <ul className="grid gap-1.5">
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => onChange(match)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-fog-light px-3.5 py-2 text-left hover:border-navy-deep"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-navy-deep">{match.name}</span>
                      <span className="block truncate text-xs text-slate">{match.email}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate">
                      {match.status === 'CLIENT' ? <Check aria-hidden={true} className="size-3.5 text-leaf" /> : null}
                      {t(`accountStatus.${match.status}`)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate">{t('noMatch')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
