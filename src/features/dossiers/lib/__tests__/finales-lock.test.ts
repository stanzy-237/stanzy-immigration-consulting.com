import { describe, expect, it } from 'vitest';

import { finalesLocked } from '@/features/dossiers/lib/workflow';

describe('when the Finales lock', () => {
  it('locks once the Accompagnement has moved past « Vérification et dépôt »', () => {
    expect(finalesLocked('ACCOMPAGNEMENT', 'ita')).toBe(false);
    expect(finalesLocked('ACCOMPAGNEMENT', 'depot')).toBe(false);
    expect(finalesLocked('ACCOMPAGNEMENT', 'aor')).toBe(true);
  });

  it('never locks a Service documentaire', () => {
    expect(finalesLocked('SERVICE_DOCUMENTAIRE', 'livre')).toBe(false);
  });
});
