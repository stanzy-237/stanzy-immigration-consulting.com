import type { ReactNode } from 'react';

import { PredictionBoard } from '@/features/draw-prediction/components/prediction-board';
import { SiteFooter } from '@/features/landing/components/site-footer';
import { SiteNav } from '@/features/landing/components/site-nav';

/** The Prochain tirage page: the Prédiction de tirage, by group, from the stored Tirages. */
export function DrawPredictionView(): ReactNode {
  return (
    <>
      <SiteNav />
      <main className="bg-off-white pb-16">
        <PredictionBoard />
      </main>
      <SiteFooter />
    </>
  );
}
