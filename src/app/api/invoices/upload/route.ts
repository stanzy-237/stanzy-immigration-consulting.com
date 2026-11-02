// Encrypted Preuve de paiement uploads to Vercel Blob; see src/features/invoices/server/proof-upload-route.ts.
export { POST } from '@/features/invoices/server/proof-upload-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
