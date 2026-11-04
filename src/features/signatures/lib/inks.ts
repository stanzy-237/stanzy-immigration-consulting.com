/** The inks a Client signs with (#96), as Documenso offers: black and ballpoint blue (globals.css `pen-*`). */
export const INKS = { black: '#111111', blue: '#1d3fb8' } as const;
export type Ink = keyof typeof INKS;
