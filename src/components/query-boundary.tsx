'use client';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type ErrorBoundaryProps = {
  onReset: () => void;
  fallback: (error: Error, retry: () => void) => ReactNode;
  children: ReactNode;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  retry = () => {
    this.props.onReset();
    this.setState({ error: null });
  };

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.retry) : this.props.children;
  }
}

function QueryError({ retry, tone }: { retry: () => void; tone: 'light' | 'dark' }) {
  const t = useTranslations('Common.QueryError');
  const muted = tone === 'dark' ? 'text-white/70' : 'text-slate';
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-6">
      <p className={tone === 'dark' ? 'font-semibold text-white' : 'font-semibold text-navy-deep'}>{t('title')}</p>
      <p className={`text-sm ${muted}`}>{t('description')}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        {t('retry')}
      </Button>
    </div>
  );
}

/**
 * Where a `useSuspenseQuery` view waits and fails: `fallback` (a skeleton of
 * the content, never a « Chargement… » line) while its data arrives, and a
 * « Réessayer » panel if the query fails. Retrying refetches the query.
 */
export function QueryBoundary({
  fallback,
  tone = 'light',
  renderError,
  children,
}: {
  fallback: ReactNode;
  /** `dark` on navy sections. */
  tone?: 'light' | 'dark';
  /**
   * What to show instead of « Réessayer » for a failure this place explains
   * itself (an Article that doesn't exist), or `null` to show nothing (a
   * secondary block whose page already shows the error). `undefined` keeps
   * « Réessayer ».
   */
  renderError?: (error: Error) => ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallback={(error, retry) => {
            const custom = renderError?.(error);
            return custom === undefined ? <QueryError retry={retry} tone={tone} /> : custom;
          }}
        >
          <Suspense fallback={fallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
