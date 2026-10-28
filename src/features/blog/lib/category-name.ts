/** A Catégorie d'article's name in the visitor's language (French otherwise). */
export const categoryName = (category: { nameFr: string; nameEn: string }, locale: string): string =>
  locale === 'en' ? category.nameEn : category.nameFr;
