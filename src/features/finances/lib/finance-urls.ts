import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';

/** A Charge's receipt, decrypted by the server. */
export const receiptUrl = (chargeId: string): string => `/api/finances/receipts/${chargeId}`;

/** The year's Recettes and Charges as a CSV, for an accountant. */
export const exportUrl = (year: number, locale: string): string => `/api/finances/export?year=${year}&locale=${locale}`;

/** Encrypts a receipt in the browser and sends it to R2; the Charge's save records it. */
export const uploadReceipt = (file: File) =>
  uploadEncryptedFile(file, { uploadRoute: '/api/finances/upload', payload: {} });
