import { createCn } from 'cn/config';

/**
 * Merges class names like clsx + tailwind-merge. The project's type sizes
 * (`--text-*` in globals.css) are declared as font sizes, or `cn('text-label', 'text-rose')`
 * would read `text-label` as a colour and drop it.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'h4', 'body-lg', 'body', 'body-sm', 'caption', 'label'] }],
    },
  },
});
