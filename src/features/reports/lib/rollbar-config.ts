import type Rollbar from 'rollbar';

/**
 * What Rollbar may know, in the browser and on the server (#160). Clients
 * hand Stanzy immigration documents: an error carries who it happened to as
 * an Account id and a role, never a name, an email, a typed value or a file.
 */

/** Who an error happened to: the Account's id and role, nothing else. */
export type ErrorPerson = { id: string; role: string };

/**
 * Field names removed wherever they appear in an item. Only names that hold
 * personal or secret data: Rollbar scrubs every key with these names, so
 * `message` or `name` would also blank the error's own text. Request bodies
 * go entirely (`scrubRequestBody`).
 */
export const SCRUB_FIELDS = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'secret',
  'email',
  'phone',
  'signature',
  'fileName',
  'wrappedKey',
  'iv',
  'objectKey',
  'address',
] as const;

/** The Account as Rollbar records it: id and role; email and username stay unset. */
export const rollbarPerson = (person: ErrorPerson | null): Rollbar.PersonParams => ({
  id: person?.id ?? null,
  role: person?.role,
});

/** What both sides share: release, environment, scrubbing, no IPs, no emails. */
export function baseRollbarConfig(accessToken: string | undefined): Rollbar.Configuration {
  return {
    accessToken,
    // Nothing is sent without a token (local dev, tests).
    enabled: Boolean(accessToken),
    environment: process.env.DEPLOY_ENV ?? 'development',
    codeVersion: process.env.RELEASE ?? 'local',
    captureUncaught: true,
    captureUnhandledRejections: true,
    captureEmail: false,
    captureUsername: false,
    captureIp: false,
    scrubFields: [...SCRUB_FIELDS],
    scrubRequestBody: true,
    scrubTelemetryInputs: true,
    // A tight budget: the free plan, and one bug in a loop must not spend it.
    itemsPerMinute: 10,
    maxItems: 50,
  };
}

/**
 * Session replay in the browser (#160), sent only with an error: every text
 * and every typed value masked, and images, canvases (the PDF pages drawn for
 * signing), videos and frames left out entirely, as grey boxes.
 */
export const REPLAY_OPTIONS = {
  enabled: true,
  autoStart: true,
  triggers: [{ type: 'occurrence', level: ['error', 'critical'] }],
  // The 20 seconds before an error: enough to see what was tapped, light on a phone's data.
  triggerDefaults: { samplingRatio: 1, preDuration: 20, postDuration: 5 },
  maskAllInputs: true,
  maskTextSelector: '*',
  maskTextFn: (text: string) => text.replace(/\S/g, '•'),
  maskInputFn: (text: string) => text.replace(/./g, '•'),
  blockSelector: 'img, picture, canvas, video, audio, iframe, object, embed, svg image',
  inlineImages: false,
  recordCanvas: false,
  collectFonts: false,
  inlineStylesheet: true,
  // No mouse trail; scrolls and inputs thinned out; no scripts, comments or head meta.
  sampling: { mousemove: false, scroll: 250, media: 800, input: 'last' },
  slimDOMOptions: {
    script: true,
    comment: true,
    headFavicon: true,
    headWhitespace: true,
    headMetaDescKeywords: true,
    headMetaSocial: true,
    headMetaRobots: true,
    headMetaHttpEquiv: true,
    headMetaAuthorship: true,
    headMetaVerification: true,
  },
} satisfies Rollbar.ReplayOptions & Record<string, unknown>;

/** Path segments that are secrets: a private Offre link's token. */
const SECRET_SEGMENT = /(\/services\/offre\/)[^/?#]+/g;

/** `url` without its query string, its hash or a secret path segment, as Rollbar may keep it. */
export function safeUrl(url: string): string {
  return url.replace(/[?#].*$/, '').replace(SECRET_SEGMENT, '$1[token]');
}

type Telemetry = { body?: { from?: string; to?: string; url?: string } };

/**
 * Rollbar's last word on an item before it leaves the browser: page and
 * navigation addresses lose their query strings and tokens.
 */
export function sanitizeItem(data: Record<string, unknown>): void {
  // The release: Rollbar's browser SDK leaves `codeVersion` out of its items.
  data.code_version = process.env.RELEASE ?? 'local';
  const request = data.request as { url?: string; query_string?: string } | undefined;
  if (request?.url) request.url = safeUrl(request.url);
  if (request) delete request.query_string;
  if (typeof data.context === 'string') data.context = safeUrl(data.context);
  const telemetry = (data.body as { telemetry?: Telemetry[] } | undefined)?.telemetry ?? [];
  for (const event of telemetry) {
    for (const key of ['from', 'to', 'url'] as const) {
      const value = event.body?.[key];
      if (typeof value === 'string') event.body![key] = safeUrl(value);
    }
  }
}

/** A Rollbar occurrence, from the Signalements list: Rollbar finds it by its UUID. */
export const rollbarOccurrenceUrl = (uuid: string): string =>
  `https://rollbar.com/occurrence/uuid/?uuid=${encodeURIComponent(uuid)}`;
