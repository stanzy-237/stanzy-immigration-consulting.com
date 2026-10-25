/**
 * The pill code of a free-form Étape: the label's first word, accents and
 * symbols stripped, uppercased, at most 10 characters ("ETAPE" if nothing is
 * left).
 */
export function codeFromLabel(label: string): string {
  const firstWord = label.trim().split(/\s+/)[0] ?? '';
  const code = firstWord
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 10);
  return code || 'ETAPE';
}
