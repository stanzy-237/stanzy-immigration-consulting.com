export type ArticleSize = 'lg' | 'sm';

export type Article = {
  slug: string;
  size: ArticleSize;
  titleKey: string;
  excerptKey?: string;
  categoryKey: string;
  // Pre-formatted date string shown in French. Picked here (not computed) so
  // the content copy stays stable in snapshots and i18n stub translations.
  date: string;
  readingMinutes: number;
  image: string;
  imageAltKey: string;
  authorName: string;
  authorInitials: string;
};

// Six placeholder articles that match the MagicPath "Blog & Ressources"
// section 1:1 (project "Stanzy Design System", component "Stanzy Immigration
// — Navigation"). The first large card gets a 280px image and an excerpt;
// the other two large cards and the three small cards are compact.
export const ARTICLES: ReadonlyArray<Article> = [
  {
    slug: 'maximiser-crs-90-jours',
    size: 'lg',
    titleKey: 'article1Title',
    excerptKey: 'article1Excerpt',
    categoryKey: 'catExpressEntry',
    date: '12 oct. 2024',
    readingMinutes: 7,
    image:
      'https://images.unsplash.com/photo-1494726161322-5360d4d0ecca?w=800&q=85',
    imageAltKey: 'article1Alt',
    authorName: 'Stanzy Canada',
    authorInitials: 'SC',
  },
  {
    slug: 'documents-ita',
    size: 'lg',
    titleKey: 'article2Title',
    categoryKey: 'catDocuments',
    date: '5 oct. 2024',
    readingMinutes: 5,
    image:
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=600&q=85',
    imageAltKey: 'article2Alt',
    authorName: 'Stanzy Canada',
    authorInitials: 'SC',
  },
  {
    slug: 'pnp-vs-entree-express',
    size: 'lg',
    titleKey: 'article3Title',
    categoryKey: 'catStrategy',
    date: '28 sep. 2024',
    readingMinutes: 4,
    image:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=85',
    imageAltKey: 'article3Alt',
    authorName: 'Stanzy Canada',
    authorInitials: 'SC',
  },
  {
    slug: 'ielts-ou-tef',
    size: 'sm',
    titleKey: 'article4Title',
    categoryKey: 'catLanguage',
    date: '20 sep. 2024',
    readingMinutes: 3,
    image:
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=200&q=80',
    imageAltKey: 'article4Alt',
    authorName: 'Stanzy Canada',
    authorInitials: 'SC',
  },
  {
    slug: 'wes-procedure',
    size: 'sm',
    titleKey: 'article5Title',
    categoryKey: 'catWes',
    date: '14 sep. 2024',
    readingMinutes: 4,
    image:
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=200&q=80',
    imageAltKey: 'article5Alt',
    authorName: 'Stanzy Canada',
    authorInitials: 'SC',
  },
  {
    slug: 'erreurs-dossier-entree-express',
    size: 'sm',
    titleKey: 'article6Title',
    categoryKey: 'catAdvice',
    date: '8 sep. 2024',
    readingMinutes: 6,
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
    imageAltKey: 'article6Alt',
    authorName: 'Stanzy Canada',
    authorInitials: 'SC',
  },
] as const;
