#!/usr/bin/env node
// Sets up Stream Video for the Réunions (#94), once per Stream app:
// 1. the private R2 bucket as Stream's external storage, under meetings/,
//    so Enregistrements and Transcriptions outlive Stream's 2 weeks;
// 2. a test write there (Stream doesn't name R2: this is the check);
// 3. the default call type stores its files there;
// 4. with the site's address, Stream's webhook for files ready (an event hook).
//
//   node --env-file=.env scripts/setup-stream.mjs [https://your-site.com]
//
// Needs STREAM_API_KEY, STREAM_API_SECRET and the R2 variables in .env.

import { StreamClient } from '@stream-io/node-sdk';

const STORAGE = 'stanzy-r2';
// Keep in step with MEETING_STORAGE_PATH in src/features/meetings/server/webhook-route.ts.
const PATH = 'meetings/';

const REQUIRED = [
  'STREAM_API_KEY',
  'STREAM_API_SECRET',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PRIVATE_BUCKET',
];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`✗ Not set in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const site = process.argv[2]?.replace(/\/+$/, '');
// Updating the app or a call type can take Stream a few seconds: more than the SDK's 3 s default.
const client = new StreamClient(process.env.STREAM_API_KEY, process.env.STREAM_API_SECRET, { timeout: 15_000 });
const storage = {
  bucket: process.env.R2_PRIVATE_BUCKET,
  storage_type: 's3',
  path: PATH,
  aws_s3: {
    s3_region: 'auto',
    s3_api_key: process.env.R2_ACCESS_KEY_ID,
    s3_secret: process.env.R2_SECRET_ACCESS_KEY,
    s3_custom_endpoint_url: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  },
};

try {
  const { external_storages: existing } = await client.listExternalStorage();
  if (existing[STORAGE]) {
    await client.updateExternalStorage({ name: STORAGE, ...storage });
    console.log(`✓ External storage « ${STORAGE} » updated`);
  } else {
    await client.createExternalStorage({ name: STORAGE, ...storage });
    console.log(`✓ External storage « ${STORAGE} » created`);
  }

  try {
    const check = await client.checkExternalStorage({ name: STORAGE });
    console.log(`✓ Stream wrote a test file to R2 (${check.file_url})`);
  } catch (error) {
    console.error(`✗ Stream couldn't write to R2: ${error.message}`);
    console.error('  Check the R2 token can write to the private bucket. Fallback (#94): an AWS S3 bucket for recordings.');
    process.exit(1);
  }

  await client.video.updateCallType({ name: 'default', external_storage: STORAGE });
  console.log('✓ Réunions store their Enregistrements and Transcriptions there');

  if (site) {
    // Newer Stream apps take webhooks as event_hooks only (not webhook_url): ours replaces any
    // earlier one to the same route, and the app's other hooks are kept.
    const url = `${site}/api/meetings/webhook`;
    const { app } = await client.getApp();
    const others = (app.event_hooks ?? []).filter((hook) => !hook.webhook_url?.endsWith('/api/meetings/webhook'));
    await client.updateApp({
      event_hooks: [
        ...others,
        {
          hook_type: 'webhook',
          enabled: true,
          webhook_url: url,
          event_types: ['call.recording_ready', 'call.transcription_ready'],
        },
      ],
    });
    console.log(`✓ Stream's webhook → ${url}`);
  } else {
    console.log('• No site address given: the webhook was left as it is.');
  }
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
