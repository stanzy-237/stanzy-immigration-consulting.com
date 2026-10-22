/**
 * An Account's commercial journey (GLOSSARY: User → Lead → Client). Separate
 * from its access role: the consultant is never "a Client".
 */
export const ACCOUNT_STATUSES = ['USER', 'LEAD', 'CLIENT'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** An Account's access level. Only configuration grants CONSULTANT. */
export const ACCOUNT_ROLES = ['MEMBER', 'CONSULTANT'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

/** What moves an Account forward. Each event is valid from exactly one status. */
export type StatusEvent = 'START_ONBOARDING' | 'PURCHASE_ACCOMPAGNEMENT';

const TRANSITIONS: Record<StatusEvent, { from: AccountStatus; to: AccountStatus }> = {
  START_ONBOARDING: { from: 'USER', to: 'LEAD' },
  PURCHASE_ACCOMPAGNEMENT: { from: 'LEAD', to: 'CLIENT' },
};

export class InvalidStatusTransitionError extends Error {
  constructor(
    readonly status: AccountStatus,
    readonly event: StatusEvent,
  ) {
    super(`Cannot apply ${event} to an Account with status ${status}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

/**
 * The status after `event`. Forward only, one step at a time: anything else
 * (a jump, a repeat, going backwards) throws `InvalidStatusTransitionError`.
 */
export function nextStatus(current: AccountStatus, event: StatusEvent): AccountStatus {
  const transition = TRANSITIONS[event];
  if (transition.from !== current) throw new InvalidStatusTransitionError(current, event);
  return transition.to;
}

/** Whether `status` is `min` or further along USER < LEAD < CLIENT. */
export function hasStatusAtLeast(status: AccountStatus, min: AccountStatus): boolean {
  return ACCOUNT_STATUSES.indexOf(status) >= ACCOUNT_STATUSES.indexOf(min);
}
