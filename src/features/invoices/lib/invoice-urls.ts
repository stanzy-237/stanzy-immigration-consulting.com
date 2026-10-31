import { uploadEncryptedFile } from '@/features/dossiers/lib/upload-version';
import { invoiceBlobPrefix } from '@/features/invoices/lib/invoice-schema';

/** A sent Facture's PDF, drawn by the server on the letterhead. */
export const invoicePdfUrl = (invoiceId: string): string => `/api/invoices/${invoiceId}/pdf`;

/** A Preuve de paiement, decrypted by the server. */
export const proofFileUrl = (proofId: string): string => `/api/invoices/proofs/${proofId}`;

/** Encrypts a Preuve de paiement in the browser and sends it to Blob; `invoices.addProof` records it. */
export const uploadProofFile = (invoiceId: string, file: File) =>
  uploadEncryptedFile(file, {
    path: `${invoiceBlobPrefix(invoiceId)}proof.bin`,
    handleUploadUrl: '/api/invoices/upload',
    clientPayload: { invoiceId },
  });
