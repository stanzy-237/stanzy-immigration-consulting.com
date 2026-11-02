#!/usr/bin/env node
// Checks the Cloudflare R2 setup (#87) the way the app uses it: the API token
// can write, size, read and delete in both buckets; the public bucket serves
// files at NEXT_PUBLIC_R2_PUBLIC_URL; and both buckets let the browser
// upload from the site (CORS). Leaves nothing behind.
//
//   node --env-file=.env scripts/check-r2.mjs [origin ...]
//
// Origins default to http://localhost:3000 and http://admin.localhost:3000.

import { AwsClient } from 'aws4fetch';

const REQUIRED = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PRIVATE_BUCKET',
  'R2_PUBLIC_BUCKET',
  'NEXT_PUBLIC_R2_PUBLIC_URL',
];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`✗ Not set in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const origins = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['http://localhost:3000', 'http://admin.localhost:3000'];
const r2 = new AwsClient({
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});
const endpoint = (bucket, key) => `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;
let failures = 0;
const check = (ok, message, hint) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) {
    failures += 1;
    if (hint) console.log(`    → ${hint}`);
  }
};

async function bucket(name, label, publicUrl) {
  const key = `setup-check/${Date.now()}.txt`;
  const body = `stanzy r2 check ${new Date().toISOString()}`;

  const put = await r2.fetch(endpoint(name, key), { method: 'PUT', body, headers: { 'Content-Type': 'text/plain' } });
  check(put.ok, `${label} (${name}): the token can write`, `R2 answered ${put.status}. Check the bucket name and that the token has Object Read & Write on it.`);
  if (!put.ok) return;

  const head = await r2.fetch(endpoint(name, key), { method: 'HEAD' });
  check(head.ok && Number(head.headers.get('content-length')) === body.length, `${label}: the size reads back`);
  const get = await r2.fetch(endpoint(name, key));
  check(get.ok && (await get.text()) === body, `${label}: the file reads back`);

  if (publicUrl) {
    const served = await fetch(`${publicUrl.replace(/\/+$/, '')}/${key}`).catch(() => null);
    check(served?.ok === true, `${label}: served at ${publicUrl}`, 'Turn on the bucket\'s public access (custom domain or r2.dev) and use that exact address.');
  }

  for (const origin of origins) {
    const preflight = await fetch(endpoint(name, key), {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    const allowed = preflight.headers.get('access-control-allow-origin');
    check(
      preflight.ok && (allowed === origin || allowed === '*'),
      `${label}: the browser may upload from ${origin}`,
      'Add this origin to the bucket\'s CORS policy (Settings → CORS policy).',
    );
  }

  const del = await r2.fetch(endpoint(name, key), { method: 'DELETE' });
  check(del.ok, `${label}: the token can delete`);
}

await bucket(process.env.R2_PRIVATE_BUCKET, 'Private bucket', null);
await bucket(process.env.R2_PUBLIC_BUCKET, 'Public bucket', process.env.NEXT_PUBLIC_R2_PUBLIC_URL);
console.log(failures === 0 ? '\nR2 is ready.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
