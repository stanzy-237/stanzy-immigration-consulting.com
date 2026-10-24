import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import type { CrsProfile } from '@/features/crs/lib/compute-crs';
import { api } from '@/trpc/react';

/** The signed-in Account's saved simulations: reopen, rename, delete. */
export function SavedSimulations({ onOpen }: { onOpen: (profile: CrsProfile) => void }): ReactNode {
  const t = useTranslations('Crs.simulations');
  const utils = api.useUtils();
  const { data: simulations = [] } = api.crs.list.useQuery();
  const refresh = { onSuccess: () => void utils.crs.list.invalidate() };
  const remove = api.crs.delete.useMutation(refresh);
  const rename = api.crs.rename.useMutation(refresh);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const open = async (id: string): Promise<void> => {
    const simulation = await utils.crs.get.fetch({ id });
    onOpen(simulation.profile);
  };

  return (
    <section aria-labelledby="crs-simulations-title" className="mt-4 rounded-2xl border border-fog bg-white p-5">
      <h2 id="crs-simulations-title" className="font-heading text-lg font-bold text-navy-deep">
        {t('title')}
      </h2>
      {simulations.length === 0 ? (
        <p className="mt-2 text-sm text-slate">{t('empty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-fog">
          {simulations.map((simulation) => (
            <li key={simulation.id} className="py-3">
              {renaming?.id === simulation.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    rename.mutate(renaming);
                    setRenaming(null);
                  }}
                >
                  <input
                    aria-label={t('renameLabel', { name: simulation.name })}
                    className="h-10 flex-1 rounded-lg border border-fog px-3 text-sm"
                    value={renaming.name}
                    maxLength={80}
                    onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                  />
                  <button type="submit" className="rounded-lg bg-navy-deep px-3 text-sm font-semibold text-white">
                    {t('confirmRename')}
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex-1 text-sm font-semibold text-navy-deep">{simulation.name}</span>
                  <span className="font-heading text-sm font-bold text-rouge">{simulation.total}</span>
                  <button type="button" className="text-sm font-semibold text-steel-blue hover:underline" onClick={() => void open(simulation.id)}>
                    {t('open')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-steel-blue hover:underline"
                    onClick={() => setRenaming({ id: simulation.id, name: simulation.name })}
                  >
                    {t('rename')}
                  </button>
                  <button type="button" className="text-sm font-semibold text-rouge hover:underline" onClick={() => remove.mutate({ id: simulation.id })}>
                    {t('delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
