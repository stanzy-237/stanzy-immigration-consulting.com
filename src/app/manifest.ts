import type { MetadataRoute } from 'next';

/**
 * Web app manifest, served at `/manifest.webmanifest`. Makes the app
 * installable. French-first, so `start_url` and `lang` point at `/fr`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Stanzy — Conseil en immigration canadienne',
    short_name: 'Stanzy',
    description:
      'Outils gratuits Entrée Express, blog et services de conseil en immigration canadienne.',
    start_url: '/fr',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    background_color: '#F7F8FC',
    theme_color: '#0D1F4E',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
