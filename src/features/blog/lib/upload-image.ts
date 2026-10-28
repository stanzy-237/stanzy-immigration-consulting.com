import { upload } from '@vercel/blob/client';

/** The types and size the upload route accepts. */
export const BLOG_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Sends an image from the consultant's computer to Vercel Blob; resolves to its public https address. */
export async function uploadBlogImage(file: File): Promise<string> {
  if (!BLOG_IMAGE_TYPES.includes(file.type) || file.size > BLOG_IMAGE_MAX_BYTES) {
    throw new Error('BLOG_IMAGE_REJECTED');
  }
  const blob = await upload(`blog/${file.name}`, file, { access: 'public', handleUploadUrl: '/api/blog/upload' });
  return blob.url;
}
