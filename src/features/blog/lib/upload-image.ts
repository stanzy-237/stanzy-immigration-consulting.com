/** The types and size the upload route accepts. */
export const BLOG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** `blog/<random>-<readable name>`: unique, and still recognisable in the bucket. */
export function blogImageKey(fileName: string, random: string): string {
  const readable = fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80);
  return `blog/${random}-${readable || 'image'}`;
}

/** Sends an image from the consultant's computer to the public R2 bucket; resolves to its public https address. */
export async function uploadBlogImage(file: File): Promise<string> {
  if (!BLOG_IMAGE_TYPES.includes(file.type) || file.size > BLOG_IMAGE_MAX_BYTES) {
    throw new Error('BLOG_IMAGE_REJECTED');
  }
  const prepared = await fetch('/api/blog/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size }),
  });
  if (!prepared.ok) throw new Error('BLOG_IMAGE_REJECTED');
  const { uploadUrl, url } = (await prepared.json()) as { uploadUrl: string; url: string };
  const stored = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!stored.ok) throw new Error('BLOG_IMAGE_REJECTED');
  return url;
}
