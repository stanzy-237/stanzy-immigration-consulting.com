'use client';

import { z } from 'zod';

import { checklistFormSchema, type ChecklistForm } from '@/features/checklist/lib/checklist-form';
import { useStoredForm, useStoredValue, writeStored } from '@/features/shared/hooks/use-stored-form';

/** Versioned, so a later change to the form discards old answers instead of breaking. */
export const CHECKLIST_ANSWERS_KEY = 'stanzy.checklist.answers.v1';
export const CHECKLIST_READY_KEY = 'stanzy.checklist.ready.v1';

const readySchema = z.array(z.string());

/** The Checklist answers kept in this browser (null on the server and during hydration). */
export const useStoredChecklistAnswers = (): ChecklistForm | null =>
  useStoredValue(CHECKLIST_ANSWERS_KEY, checklistFormSchema);

export const storeChecklistAnswers = (answers: ChecklistForm): void => writeStored(CHECKLIST_ANSWERS_KEY, answers);

/** A visitor's ticks, kept in this browser. */
export const useStoredReady = (): [string[], (next: string[]) => void] =>
  useStoredForm(CHECKLIST_READY_KEY, readySchema, []);
