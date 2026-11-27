import { FOOTER_CONTACT, FOOTER_SOCIALS } from '@/features/landing/data/footer';
import { SITE_NAME } from '@/lib/share-metadata';

/**
 * Stanzy as an entity for search and AI engines: who it is, how to reach it,
 * where it works from and its profiles elsewhere (`sameAs`), from the same
 * contact data as the footer. The WhatsApp link is a channel, not a profile.
 */
export function organizationJsonLd(siteUrl: string, description: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${siteUrl}/#organization`,
    name: SITE_NAME,
    alternateName: 'Stanzy',
    url: siteUrl,
    logo: `${siteUrl}/logo2.png`,
    image: `${siteUrl}/og/fr/accueil.jpg`,
    description,
    email: FOOTER_CONTACT.email.replace(/^mailto:/, ''),
    telephone: FOOTER_CONTACT.phone.replace(/^tel:/, ''),
    address: { '@type': 'PostalAddress', addressLocality: 'Douala', addressCountry: 'CM' },
    areaServed: ['CM', 'CA'],
    knowsLanguage: ['fr', 'en'],
    sameAs: FOOTER_SOCIALS.filter((social) => social.key !== 'whatsapp').map((social) => social.href),
  };
}
