import { createIngestHandler } from '@/features/draws/server/ingest-handler';
import { ingestNow } from '@/features/draws/server/ingest-now';
import { env } from '@/lib/env';

/**
 * POST /api/cron/draws, called once a day by .github/workflows/ingest-draws.yml
 * (and on demand from the Tableau de bord, through tRPC). The workflow sends
 * IRCC's feed when it could download it; otherwise the app reads it from
 * canada.ca itself.
 */
export const POST = createIngestHandler({ secret: env.CRON_SECRET, run: (feed) => ingestNow(feed) });
