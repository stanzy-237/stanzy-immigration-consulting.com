import { createContext, useContext } from 'react';

/**
 * What a link asked the Dossier's documents to show (`?document=…&message=…`,
 * from a Notification, #92): that Document unfolded, that message scrolled
 * into view and highlighted.
 */
export type DocumentFocus = { documentId: string | null; messageId: string | null };

export const DocumentFocusContext = createContext<DocumentFocus>({ documentId: null, messageId: null });

export const useDocumentFocus = (): DocumentFocus => useContext(DocumentFocusContext);
