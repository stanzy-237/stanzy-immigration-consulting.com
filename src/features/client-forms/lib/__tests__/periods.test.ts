import { describe, expect, it } from 'vitest';

import { gapsIn, requiredWindow } from '@/features/client-forms/lib/periods';

const today = new Date('2026-11-07T10:00:00Z');

describe('the period IRCC wants covered', () => {
  it('is the last 10 years, this month included', () => {
    expect(requiredWindow(today, null)).toEqual({ from: '2016-12', to: '2026-11' });
    expect(requiredWindow(today, '1980-05-12')).toEqual({ from: '2016-12', to: '2026-11' });
  });

  it('starts at the 18th birthday when that is later', () => {
    expect(requiredWindow(today, '2002-03-20')).toEqual({ from: '2020-03', to: '2026-11' });
  });
});

describe('the gaps', () => {
  const window = { from: '2016-12', to: '2026-11' };

  it('are the months no period covers, with overlaps and an open-ended period allowed', () => {
    expect(
      gapsIn(
        [
          { from: '2016-12', to: '2019-02' },
          { from: '2018-01', to: '2019-01' },
          { from: '2019-06', to: '2023-08' },
          { from: '2024-01', to: null },
        ],
        window,
      ),
    ).toEqual([
      { from: '2019-03', to: '2019-05' },
      { from: '2023-09', to: '2023-12' },
    ]);
  });

  it('include the start and the end of the window when uncovered, and ignore unreadable periods', () => {
    expect(gapsIn([{ from: '2018-01', to: '2025-12' }, { from: 'janvier', to: null }], window)).toEqual([
      { from: '2016-12', to: '2017-12' },
      { from: '2026-01', to: '2026-11' },
    ]);
    expect(gapsIn([], window)).toEqual([window]);
    expect(gapsIn([{ from: '2010-01', to: null }], window)).toEqual([]);
  });
});
