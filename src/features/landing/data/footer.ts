import type { LucideIcon } from 'lucide-react';
import { Camera, MessageCircle, Music2, Share2 } from 'lucide-react';

import { SERVICE_ENTRIES, TOOL_ENTRIES } from './nav';

export const FOOTER_TOOL_LINKS = TOOL_ENTRIES.map((entry) => ({
  labelKey: entry.labelKey,
  href: entry.href,
}));

export const FOOTER_SERVICE_LINKS = SERVICE_ENTRIES.map((entry) => ({
  labelKey: entry.labelKey,
  href: entry.href,
}));

export type FooterLink = {
  key: string;
  labelKey: string;
  href: string;
  external?: boolean;
};

export const FOOTER_CONTENT_LINKS: ReadonlyArray<FooterLink> = [
  { key: 'blog', labelKey: 'blog', href: '/blog' },
  { key: 'faq', labelKey: 'faq', href: '/#faq' },
  {
    key: 'tiktok',
    labelKey: 'tiktok',
    href: 'https://www.tiktok.com/@stanzycanada',
    external: true,
  },
] as const;

export const FOOTER_LEGAL_LINKS: ReadonlyArray<FooterLink> = [
  { key: 'privacy', labelKey: 'privacy', href: '/legal/confidentialite' },
  { key: 'terms', labelKey: 'terms', href: '/legal/conditions' },
  { key: 'cookies', labelKey: 'cookies', href: '/legal/temoins' },
] as const;

export type SocialLink = {
  key: 'facebook' | 'tiktok' | 'instagram' | 'whatsapp';
  icon: LucideIcon;
  href: string;
};

// Placeholder social URLs — real handles land in a follow-up (see issue #12
// "Further Notes").
export const FOOTER_SOCIALS: ReadonlyArray<SocialLink> = [
  { key: 'facebook', icon: Share2, href: 'https://facebook.com/stanzycanada' },
  { key: 'tiktok', icon: Music2, href: 'https://www.tiktok.com/@stanzycanada' },
  { key: 'instagram', icon: Camera, href: 'https://instagram.com/stanzycanada' },
  { key: 'whatsapp', icon: MessageCircle, href: 'https://wa.me/message/stanzycanada' },
] as const;

// Contact details are placeholders until the Stanzy brand finalises them.
export const FOOTER_CONTACT = {
  email: 'mailto:bonjour@stanzy-immigration-consulting.com',
  phone: 'tel:+15145550199',
  bookingHref: '/services/consultation',
} as const;
