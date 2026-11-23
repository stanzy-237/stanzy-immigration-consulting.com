/**
 * « De quoi voulez-vous parler ? » (booking step 2): the same four subjects as
 * « Ce qu'on aborde » on the public page. Shared by the browser and the server.
 */
export const TOPIC_KEYS = ['eligibility', 'points', 'documents', 'next'] as const;

export type TopicKey = (typeof TOPIC_KEYS)[number];
