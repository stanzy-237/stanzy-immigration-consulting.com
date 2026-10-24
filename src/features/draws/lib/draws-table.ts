import type { DrawGroup } from '@/features/draws/lib/draw-type';
import type { DrawSummary } from '@/features/draws/lib/draw-summary';

export type SortField = 'round' | 'date' | 'type' | 'invitations' | 'crsMin';
export type GroupFilter = DrawGroup | 'ALL';

export type TableState = {
  query: string;
  group: GroupFilter;
  sort: SortField;
  dir: 'asc' | 'desc';
  page: number;
  perPage: number;
};

export const PER_PAGE_OPTIONS = [10, 15, 25] as const;

export const INITIAL_TABLE: TableState = { query: '', group: 'ALL', sort: 'round', dir: 'desc', page: 1, perPage: 10 };

export type TableAction =
  | { type: 'search'; query: string }
  | { type: 'filter'; group: GroupFilter }
  | { type: 'sort'; field: SortField }
  | { type: 'perPage'; perPage: number }
  | { type: 'page'; page: number };

/** Every change but paging itself goes back to page 1. Re-sorting a column flips it; a new column starts highest first. */
export function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'search':
      return { ...state, query: action.query, page: 1 };
    case 'filter':
      return { ...state, group: action.group, page: 1 };
    case 'sort':
      return state.sort === action.field
        ? { ...state, dir: state.dir === 'asc' ? 'desc' : 'asc', page: 1 }
        : { ...state, sort: action.field, dir: 'desc', page: 1 };
    case 'perPage':
      return { ...state, perPage: action.perPage, page: 1 };
    case 'page':
      return { ...state, page: action.page };
  }
}

/** How a row reads on screen, so search matches what the visitor sees. */
export type DrawText = {
  type: (draw: DrawSummary) => string;
  date: (draw: DrawSummary) => string;
  /** The date without the year, for tight spots. */
  shortDate: (draw: DrawSummary) => string;
};

function compare(sort: SortField, text: DrawText) {
  return (a: DrawSummary, b: DrawSummary): number => {
    switch (sort) {
      case 'round':
      case 'date':
        // Same date, or the split rounds 91a/91b: fall back to IRCC's order.
        return (sort === 'date' ? a.date.localeCompare(b.date) : 0) || a.roundNumber - b.roundNumber || a.round.localeCompare(b.round);
      case 'type':
        return text.type(a).localeCompare(text.type(b));
      case 'invitations':
        return a.invitations - b.invitations;
      case 'crsMin':
        return a.crsMin - b.crsMin;
    }
  };
}

/** The rows on the current page, after search, filter and sort. */
export function selectRows(draws: DrawSummary[], state: TableState, text: DrawText) {
  const needle = state.query.trim().toLowerCase();
  const matching = draws.filter((draw) => {
    if (state.group !== 'ALL' && draw.group !== state.group) return false;
    if (!needle) return true;
    const haystack = `#${draw.round} ${text.type(draw)} ${draw.typeLabel} ${draw.date} ${text.date(draw)} ${draw.crsMin}`;
    return haystack.toLowerCase().includes(needle);
  });
  const order = compare(state.sort, text);
  const sorted = matching.toSorted((a, b) => (state.dir === 'asc' ? order(a, b) : order(b, a)));
  const pageCount = Math.max(1, Math.ceil(sorted.length / state.perPage));
  const page = Math.min(state.page, pageCount);
  const start = (page - 1) * state.perPage;
  return { rows: sorted.slice(start, start + state.perPage), total: sorted.length, page, pageCount, start };
}

/** Page numbers to show: first, last, and the current page's neighbours, with gaps as null. */
export function pageWindow(page: number, pageCount: number): (number | null)[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const pages = [...wanted].toSorted((a, b) => a - b);
  return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1]! > 1 ? [null, n] : [n]));
}
