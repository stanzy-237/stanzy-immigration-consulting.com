// Ingests IRCC's Express Entry rounds; see src/features/draws/server/ingest-route.ts.
export { POST } from '@/features/draws/server/ingest-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
