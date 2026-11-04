/** One CSV cell: quoted when it holds the separator, a quote or a line break. */
const cell = (value: string | number): string => {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/**
 * Rows as a CSV a spreadsheet opens as it is: `;` between cells (French
 * Excel's default), CRLF lines, and a BOM so accents read as UTF-8.
 */
export const toCsv = (rows: (string | number)[][]): string =>
  `﻿${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
