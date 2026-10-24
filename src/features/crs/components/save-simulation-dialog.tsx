'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const NAME_MAX = 80;

/**
 * Names a simulation before it is saved. Opens with `defaultName`, which
 * the visitor can keep or change; an empty name can't be saved.
 */
export function SaveSimulationDialog({
  open,
  defaultName,
  saving,
  failed,
  onSave,
  onClose,
}: {
  open: boolean;
  defaultName: string;
  saving: boolean;
  failed: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}): ReactNode {
  const t = useTranslations('Crs.saveDialog');
  const inputId = useId();
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent showCloseButton={false} className="gap-5 p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-h4 font-bold text-navy-deep">{t('title')}</DialogTitle>
          <DialogDescription className="text-body-sm text-slate">{t('description')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed) onSave(trimmed);
          }}
          className="space-y-5"
        >
          <div>
            <label htmlFor={inputId} className="mb-2 block font-label text-slate">
              {t('label')}
            </label>
            <input
              id={inputId}
              value={name}
              maxLength={NAME_MAX}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              aria-invalid={failed ? true : undefined}
              aria-describedby={failed ? `${inputId}-error` : undefined}
              className="h-12 w-full rounded-xl border border-fog bg-white px-4 text-body text-navy-deep outline-none transition-colors focus-visible:border-rouge focus-visible:ring-2 focus-visible:ring-rouge/20"
            />
            {failed ? (
              <p id={`${inputId}-error`} className="mt-2 text-body-sm font-medium text-rouge">
                {t('error')}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-fog px-5 py-2.5 text-body-sm font-semibold text-navy-deep transition-colors hover:bg-ice-blue"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={!trimmed || saving}
              className="rounded-full bg-navy-deep px-5 py-2.5 text-body-sm font-semibold text-white transition-colors hover:bg-navy-80 disabled:opacity-60"
            >
              {saving ? t('saving') : t('confirm')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
