/**
 * The Rollbar occurrences sent from this tab, newest first (#160), so
 * « Signaler un problème » can link the report to what Rollbar saw.
 */
const KEEP = 5;
let recent: string[] = [];

export function rememberRollbarItem(uuid: string | undefined | null): void {
  if (!uuid) return;
  recent = [uuid, ...recent.filter((known) => known !== uuid)].slice(0, KEEP);
}

export const recentRollbarItems = (): string[] => [...recent];

/** Tests only. */
export const forgetRollbarItems = (): void => {
  recent = [];
};
