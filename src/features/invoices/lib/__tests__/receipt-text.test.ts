import { describe, expect, it } from 'vitest';

import { contractBlocks } from '@/features/contracts/lib/contract-schema';
import { receiptText } from '@/features/invoices/lib/receipt-text';

const facts = {
  locale: 'fr',
  client: 'Aminata Diallo',
  service: 'Preuve de fonds (vous avez les fonds)',
  amount: 250_000,
  total: 600_000,
  balance: 350_000,
  currency: 'XAF' as const,
  receivedOn: '2026-11-09',
  method: 'CASH' as const,
  methodNote: null,
};

describe('receiptText', () => {
  it('fills the Reconnaissance de réception de fonds as Stanzy writes it', () => {
    const { title, body } = receiptText(facts);
    expect(title).toBe('Reconnaissance de réception de fonds');
    expect(body).toContain('reconnais avoir reçu de Monsieur/Madame Aminata Diallo, la somme de 250 000 FCFA, soit deux cent cinquante mille francs CFA');
    expect(body).toContain('La prestation concernée est la suivante : Preuve de fonds (vous avez les fonds).');
    expect(body).toContain('Le montant total convenu pour cette prestation est de 600 000 FCFA. La somme de 250 000 FCFA a été reçue le 09/11/2026. Le solde restant dû est de 350 000 FCFA.');
    expect(body).toContain('Fait à Douala, le 09/11/2026.');
  });

  it('ticks the way it was paid, « Autre » with what it was', () => {
    const cash = contractBlocks(receiptText(facts).body).filter((block) => block.kind === 'bullet').map((block) => block.text);
    expect(cash).toEqual(['[X] Espèces', '[  ] Virement bancaire', '[  ] Dépôt bancaire', '[  ] Mobile Money', '[  ] Chèque', '[  ] Autre']);
    const other = receiptText({ ...facts, method: 'OTHER', methodNote: 'Western Union' }).body;
    expect(other).toContain('[X] Autre : Western Union');
  });

  it('writes it in English for an English-speaking Client', () => {
    const { title, body } = receiptText({ ...facts, locale: 'en' });
    expect(title).toBe('Acknowledgement of receipt of funds');
    expect(body).toContain('two hundred fifty thousand CFA francs');
  });
});
