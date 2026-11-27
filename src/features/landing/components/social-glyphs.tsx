import type { ReactNode } from 'react';

/** The four networks as white glyphs, for the phone footer on navy (`PWA · Pied de page mobile · C`). */
type Props = { className?: string };

export function WhatsAppGlyph({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 24 24" className={className}>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

export function TikTokGlyph({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 352.28 398.67" className={className}>
      <path
        fill="currentColor"
        d="M241.76 261.13V127.66c25.76 18.49 57.32 29.38 91.37 29.38V106c-19.67-4.21-37-14.77-49.76-29.43-20.58-13.42-35.43-34.88-40.06-59.91h-48.08l-.11 263.2c-1.1 29.47-25.36 53.13-55.1 53.13-18.42 0-34.72-9.1-44.75-23.01-17.57-9.25-29.6-27.67-29.6-48.86 0-30.44 24.77-55.21 55.21-55.21 5.68 0 11.13.94 16.29 2.55v-51.49C71.83 158.5 19.14 212.08 19.14 277.78c0 31.78 12.34 60.71 32.46 82.31C71.23 373.87 95.12 382 120.88 382c66.65 0 120.88-54.23 120.88-120.88Z"
      />
    </svg>
  );
}

export function InstagramGlyph({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 24 24" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function FacebookGlyph({ className }: Props): ReactNode {
  return (
    <svg aria-hidden={true} viewBox="0 0 24 24" className={className}>
      <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v8h4v-8h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5Z" fill="currentColor" />
    </svg>
  );
}

export const SOCIAL_GLYPHS = { whatsapp: WhatsAppGlyph, tiktok: TikTokGlyph, instagram: InstagramGlyph, facebook: FacebookGlyph } as const;
