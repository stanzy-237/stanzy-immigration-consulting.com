import { AwsClient } from 'aws4fetch';

import { env } from '@/lib/env';

/**
 * Files in Cloudflare R2 (#87), through its S3 API. Two buckets:
 * `private` holds the Documents de service and Preuves de paiement (only
 * ciphertext, ADR 0007, read back through our own routes); `public` holds
 * what visitors load directly (blog images, the TikTok carousel), served
 * from NEXT_PUBLIC_R2_PUBLIC_URL.
 */
export type Bucket = 'private' | 'public';

/** How long a browser has to start an upload once given its address. */
const UPLOAD_SECONDS = 10 * 60;

type Config = { accountId: string; accessKeyId: string; secretAccessKey: string; buckets: Record<Bucket, string> };

function config(): Config {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PRIVATE_BUCKET, R2_PUBLIC_BUCKET } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PRIVATE_BUCKET || !R2_PUBLIC_BUCKET) {
    throw new Error('STORAGE_UNCONFIGURED');
  }
  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    buckets: { private: R2_PRIVATE_BUCKET, public: R2_PUBLIC_BUCKET },
  };
}

let cached: { client: AwsClient; config: Config } | null = null;

function r2() {
  if (!cached) {
    const c = config();
    cached = {
      config: c,
      client: new AwsClient({
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
        service: 's3',
        region: 'auto',
      }),
    };
  }
  return cached;
}

/** Whether this deploy can store files; without it uploads are refused with STORAGE_UNCONFIGURED. */
export function storageConfigured(): boolean {
  try {
    config();
    return true;
  } catch {
    return false;
  }
}

function objectUrl(bucket: Bucket, key: string): string {
  const { config: c } = r2();
  const path = key.split('/').map(encodeURIComponent).join('/');
  return `https://${c.accountId}.r2.cloudflarestorage.com/${c.buckets[bucket]}/${path}`;
}

/**
 * A short-lived address the browser PUTs the file to, straight to R2, with
 * exactly this `contentType`. The server picks `key`, so a browser can only
 * write where it was allowed to.
 */
export async function presignUpload(bucket: Bucket, key: string, contentType: string): Promise<string> {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set('X-Amz-Expires', String(UPLOAD_SECONDS));
  const signed = await r2().client.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), {
    aws: { signQuery: true },
  });
  return signed.url;
}

/**
 * A short-lived address to read a private object straight from R2: for files
 * too large to pass through our routes (a Réunion's Enregistrement, #94).
 * Only ever given to the consultant, after the route checked who asks.
 */
export async function presignDownload(bucket: Bucket, key: string, seconds = 5 * 60): Promise<string> {
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set('X-Amz-Expires', String(seconds));
  const signed = await r2().client.sign(new Request(url, { method: 'GET' }), { aws: { signQuery: true } });
  return signed.url;
}

/** The stored object's size in bytes, or null when it isn't there. */
export async function objectSize(bucket: Bucket, key: string): Promise<number | null> {
  const response = await r2().client.fetch(objectUrl(bucket, key), { method: 'HEAD' });
  if (!response.ok) return null;
  const size = Number(response.headers.get('content-length'));
  return Number.isFinite(size) ? size : null;
}

export async function readObject(bucket: Bucket, key: string): Promise<ArrayBuffer> {
  const response = await r2().client.fetch(objectUrl(bucket, key));
  if (!response.ok) throw new Error(`STORAGE_READ_FAILED ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Writes from the server (a signed PDF, the consultant's signature); the
 * browser's uploads go straight to R2. The address is signed first and the
 * bytes go on the call itself: a body carried by a prepared Request reaches
 * R2 as a stream of unknown length, which it refuses (411, under Next.js).
 */
export async function writeObject(
  bucket: Bucket,
  key: string,
  body: ArrayBuffer | Uint8Array<ArrayBuffer>,
  options: { contentType: string; cacheControl?: string },
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': options.contentType };
  if (options.cacheControl) headers['Cache-Control'] = options.cacheControl;
  const url = new URL(objectUrl(bucket, key));
  url.searchParams.set('X-Amz-Expires', String(UPLOAD_SECONDS));
  const signed = await r2().client.sign(new Request(url, { method: 'PUT', headers }), { aws: { signQuery: true } });
  const response = await fetch(signed.url, { method: 'PUT', body, headers });
  if (!response.ok) throw new Error(`STORAGE_WRITE_FAILED ${response.status}`);
}

/** Removes objects; a failure is logged, since the rows pointing to them are already gone. */
export async function deleteObjects(bucket: Bucket, keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      const response = await r2().client.fetch(objectUrl(bucket, key), { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new Error(`STORAGE_DELETE_FAILED ${response.status}`);
    } catch (error) {
      console.error('[storage] could not delete', key, error);
    }
  }
}

/** Where visitors load a public object from. */
export function publicObjectUrl(key: string): string {
  const base = env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) throw new Error('STORAGE_UNCONFIGURED');
  return `${base.replace(/\/+$/, '')}/${key}`;
}

/** Whether `key` is a plain object key under `prefix` (no `..`, no leading slash). */
export function isKeyUnder(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && !key.split('/').some((part) => part === '..' || part === '.' || part === '');
}
