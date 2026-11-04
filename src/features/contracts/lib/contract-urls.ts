/** A Contrat's PDF: the signed one once signed (ADR 0007, decrypted by the server). */
export const contractPdfUrl = (contractId: string): string => `/api/contracts/${contractId}/pdf`;
