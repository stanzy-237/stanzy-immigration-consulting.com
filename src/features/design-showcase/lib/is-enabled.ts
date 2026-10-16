export function isDesignShowcaseEnabled() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_ENABLE_DESIGN_SHOWCASE === '1'
  );
}
