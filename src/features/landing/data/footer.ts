
export type FooterLink = {
  key: string;
  labelKey: string;
  href: string;
  external?: boolean;
};

// Footer tool list matches the MagicPath design 1:1 — note it omits the
// Coffre-fort entry carried by the nav dropdown.
export const FOOTER_TOOL_LINKS: ReadonlyArray<FooterLink> = [
  { key: 'timeline', labelKey: 'timeline', href: '/outils/timeline' },
  { key: 'crs', labelKey: 'crs', href: '/outils/crs' },
  { key: 'fsw', labelKey: 'fsw', href: '/outils/67-points' },
  { key: 'nclc', labelKey: 'nclc', href: '/outils/nclc-clb' },
  { key: 'ita', labelKey: 'ita', href: '/outils/compte-a-rebours-ita' },
  { key: 'draw', labelKey: 'draw', href: '/outils/dernier-tirage' },
  { key: 'checklist', labelKey: 'checklist', href: '/outils/checklist' },
  { key: 'cnp', labelKey: 'cnp', href: '/outils/cnp' },
] as const;

export const FOOTER_SERVICE_LINKS: ReadonlyArray<FooterLink> = [
  {
    key: 'consultation',
    labelKey: 'consultation',
    href: '/services/consultation',
  },
  {
    key: 'accompagnement',
    labelKey: 'accompagnement',
    href: '/services/accompagnement',
  },
  {
    key: 'verification',
    labelKey: 'verification',
    href: '/services/verification',
  },
  {
    key: 'tcf',
    labelKey: 'tcf',
    href: 'https://tcf-express-academy.com',
    external: true,
  },
  { key: 'ede', labelKey: 'ede', href: '/services/ede' },
] as const;

export const FOOTER_CONTENT_LINKS: ReadonlyArray<FooterLink> = [
  { key: 'blog', labelKey: 'blog', href: '/blog' },
  {
    key: 'tiktok',
    labelKey: 'tiktok',
    href: 'https://www.tiktok.com/@stanzycanada',
    external: true,
  },
] as const;

export const FOOTER_LEGAL_LINKS: ReadonlyArray<FooterLink> = [
  { key: 'privacy', labelKey: 'privacy', href: '/legal/confidentialite' },
  { key: 'terms', labelKey: 'terms', href: '/legal/mentions-legales' },
  { key: 'cookies', labelKey: 'cookies', href: '/legal/conditions' },
] as const;

export type SocialLink = {
  key: 'facebook' | 'tiktok' | 'instagram' | 'whatsapp';
  // Brand SVGs sourced from svgl.app and vendored under public/icons/social/.
  iconSrc: string;
  href: string;
};

// Placeholder social URLs — real handles land in a follow-up.
export const FOOTER_SOCIALS: ReadonlyArray<SocialLink> = [
  { key: 'facebook', iconSrc: '/icons/social/facebook.svg', href: 'https://facebook.com/stanzycanada' },
  { key: 'tiktok', iconSrc: '/icons/social/tiktok.svg', href: 'https://www.tiktok.com/@stanzycanada' },
  { key: 'instagram', iconSrc: '/icons/social/instagram.svg', href: 'https://instagram.com/stanzycanada' },
  { key: 'whatsapp', iconSrc: '/icons/social/whatsapp.svg', href: 'https://wa.me/message/stanzycanada' },
] as const;

// Contact details come from the MagicPath design.
export const FOOTER_CONTACT = {
  email: 'mailto:contact@stanzy-immigration-consulting.com',
  phone: 'tel:+237679306015',
  bookingHref: '/services/consultation',
} as const;
