import { describe, expect, it } from 'vitest';

import { isDossierBlob } from '@/features/dossiers/lib/document-schema';
import { finalesLocked } from '@/features/dossiers/lib/workflow';

describe('which uploaded files a Dossier accepts', () => {
  const store = 'https://abc123.public.blob.vercel-storage.com';
  it('takes only Vercel Blob files under its own folder', () => {
    expect(isDossierBlob(`${store}/dossiers/dos_1/doc_1-x8Yz.bin`, 'dos_1')).toBe(true);
    expect(isDossierBlob(`${store}/dossiers/dos_12/doc_1.bin`, 'dos_1')).toBe(false);
    expect(isDossierBlob(`${store}/dossiers/dos_1/../dos_2/doc.bin`, 'dos_1')).toBe(false);
    expect(isDossierBlob('https://evil.example/dossiers/dos_1/doc.bin', 'dos_1')).toBe(false);
    expect(isDossierBlob('not a url', 'dos_1')).toBe(false);
  });
});

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
