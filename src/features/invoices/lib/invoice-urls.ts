import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';

/** A sent Facture's PDF, drawn by the server on the letterhead. */
export const invoicePdfUrl = (invoiceId: string): string => `/api/invoices/${invoiceId}/pdf`;

/** A Preuve de paiement, decrypted by the server. */
export const proofFileUrl = (proofId: string): string => `/api/invoices/proofs/${proofId}`;

/** Encrypts a Preuve de paiement in the browser and sends it to R2; `invoices.addProof` records it. */
export const uploadProofFile = (invoiceId: string, file: File) =>
  uploadEncryptedFile(file, { uploadRoute: '/api/invoices/upload', payload: { invoiceId } });
