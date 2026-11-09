/**
 * A whole amount in words, as a Reconnaissance de réception de fonds writes it
 * (« deux cent cinquante mille »): French with its rules (vingt et un,
 * quatre-vingts, deux cents, mille invariable, millions), or English.
 */
export function amountInWords(amount: number, locale: string): string {
  const n = Math.trunc(Math.abs(amount));
  return locale === 'en' ? english(n) : french(n);
}

const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const FR_TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0–99. `final`: nothing follows, so « quatre-vingts » keeps its s. */
function frBelow100(n: number, final: boolean): string {
  if (n <= 16) return FR_UNITS[n]!;
  if (n < 20) return `dix-${FR_UNITS[n - 10]}`;
  if (n < 70) {
    const tens = FR_TENS[Math.floor(n / 10)]!;
    const unit = n % 10;
    if (unit === 0) return tens;
    return unit === 1 ? `${tens} et un` : `${tens}-${FR_UNITS[unit]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${frBelow100(n - 60, false)}`;
  if (n === 80) return final ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${frBelow100(n - 80, false)}`;
}

/** 0–999; `final` as above, for « deux cents » too. */
function frBelow1000(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return frBelow100(rest, final);
  const head = hundreds === 1 ? 'cent' : `${FR_UNITS[hundreds]} cent${rest === 0 && final ? 's' : ''}`;
  return rest === 0 ? head : `${head} ${frBelow100(rest, final)}`;
}

function french(n: number): string {
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  // Before « millions » and « milliards » (nouns) the s stays; before « mille » it goes.
  if (billions) parts.push(`${frBelow1000(billions, true)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(`${frBelow1000(millions, true)} million${millions > 1 ? 's' : ''}`);
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${frBelow1000(thousands, false)} mille`);
  if (rest) parts.push(frBelow1000(rest, true));
  return parts.join(' ');
}

const EN_UNITS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const tail =
    rest === 0 ? '' : rest < 20 ? EN_UNITS[rest]! : `${EN_TENS[Math.floor(rest / 10)]}${rest % 10 ? `-${EN_UNITS[rest % 10]}` : ''}`;
  if (hundreds === 0) return tail;
  return tail ? `${EN_UNITS[hundreds]} hundred ${tail}` : `${EN_UNITS[hundreds]} hundred`;
}

function english(n: number): string {
  if (n === 0) return 'zero';
  const scales: [number, string][] = [
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of scales) {
    const count = Math.floor(rest / size);
    if (count) parts.push(`${enBelow1000(count)} ${name}`);
    rest %= size;
  }
  if (rest) parts.push(enBelow1000(rest));
  return parts.join(' ');
}
