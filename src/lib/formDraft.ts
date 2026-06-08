/**
 * Pure sessionStorage-backed form draft persistence core (no React).
 *
 * Shared by the React hooks layer in `useFormDraft.ts`. Every storage access is
 * SSR-guarded and wrapped in try/catch so a missing or hostile sessionStorage
 * implementation can never throw into render or submit paths.
 */

/** Namespace for all form drafts. Distinct from `blarney.registrationCheckout`. */
export const DRAFT_KEY_PREFIX = "blarney.formDraft.";

/** Envelope schema version. Bump when the envelope shape itself changes. */
export const DRAFT_ENVELOPE_VERSION = 1;

/** Drafts older than this are treated as expired and discarded on load. */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Field names/ids matching this pattern are never persisted. Defensive even for
 * fields that should already be excluded by type/autocomplete heuristics.
 */
export const SENSITIVE_NAME_PATTERN =
  /password|passwd|pwd|token|secret|cvv|cvc|card|cardnumber|jwt|auth|session|cookie|otp|__chair/i;

/**
 * Persisted envelope. `version` is the envelope schema version; `formVersion` is
 * the caller's payload-shape version so callers can invalidate old drafts.
 */
export type FormDraftEnvelope<T> = {
  version: number;
  formVersion: number;
  savedAt: number;
  data: T;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function assertValidFormId(formId: string): boolean {
  // A "." would let a caller escape the namespace (e.g. collide with the
  // checkout key). Reject loudly in dev, no-op safely in prod.
  if (formId.includes(".")) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `formId must not contain ".": received "${formId}"`,
      );
    }

    return false;
  }

  return true;
}

function draftKey(formId: string): string {
  return `${DRAFT_KEY_PREFIX}${formId}`;
}

function safeRemove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // sessionStorage may be unavailable; nothing else to do.
  }
}

function isEnvelope(value: unknown): value is FormDraftEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const envelope = value as Record<string, unknown>;

  return (
    typeof envelope.version === "number" &&
    typeof envelope.formVersion === "number" &&
    typeof envelope.savedAt === "number" &&
    "data" in envelope
  );
}

/**
 * Load a draft. Returns null (and self-heals by clearing the key) on any of:
 * SSR, invalid formId, missing key, parse failure, shape mismatch, envelope or
 * form version mismatch, or TTL expiry.
 */
export function loadFormDraft<T>(
  formId: string,
  formVersion: number,
): T | null {
  if (!isBrowser() || !assertValidFormId(formId)) {
    return null;
  }

  const key = draftKey(formId);
  let raw: string | null;

  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    safeRemove(key);
    return null;
  }

  if (
    !isEnvelope(parsed) ||
    parsed.version !== DRAFT_ENVELOPE_VERSION ||
    parsed.formVersion !== formVersion ||
    Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS
  ) {
    safeRemove(key);
    return null;
  }

  return parsed.data as T;
}

/** Persist a draft. Silent no-op on SSR, invalid formId, or write failure. */
export function saveFormDraft<T>(
  formId: string,
  formVersion: number,
  data: T,
): void {
  if (!isBrowser() || !assertValidFormId(formId)) {
    return;
  }

  const envelope: FormDraftEnvelope<T> = {
    version: DRAFT_ENVELOPE_VERSION,
    formVersion,
    savedAt: Date.now(),
    data,
  };

  try {
    window.sessionStorage.setItem(draftKey(formId), JSON.stringify(envelope));
  } catch {
    // Quota exceeded or unavailable storage; drafting is best-effort.
  }
}

/** Remove a draft. Silent no-op on SSR or invalid formId. */
export function clearFormDraft(formId: string): void {
  if (!isBrowser() || !assertValidFormId(formId)) {
    return;
  }

  safeRemove(draftKey(formId));
}

type PersistableElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const ALLOWED_INPUT_TYPES = new Set([
  "text",
  "email",
  "tel",
  "url",
  "number",
  "search",
  "date",
  "time",
  "datetime-local",
]);

const BLOCKED_INPUT_TYPES = new Set([
  "password",
  "file",
  "hidden",
  "submit",
  "button",
  "reset",
  "image",
]);

const BLOCKED_AUTOCOMPLETE = new Set([
  "off",
  "current-password",
  "new-password",
  "one-time-code",
]);

/**
 * Whether a form control's value may be persisted to a draft.
 *
 * Radio/checkbox controls are intentionally excluded here: their persistence is
 * value-keyed and handled by the uncontrolled serializer in the hooks layer.
 * This predicate only governs value-bearing text-like inputs, selects, and
 * textareas.
 */
export function isPersistableField(element: Element): element is PersistableElement {
  if (element instanceof HTMLSelectElement) {
    return !matchesSensitive(element);
  }

  if (element instanceof HTMLTextAreaElement) {
    return !matchesSensitive(element);
  }

  if (!(element instanceof HTMLInputElement)) {
    return false;
  }

  const type = element.type.toLowerCase();

  if (BLOCKED_INPUT_TYPES.has(type) || !ALLOWED_INPUT_TYPES.has(type)) {
    return false;
  }

  if (BLOCKED_AUTOCOMPLETE.has(element.autocomplete.toLowerCase())) {
    return false;
  }

  return !matchesSensitive(element);
}

function matchesSensitive(element: PersistableElement): boolean {
  if (element.hasAttribute("data-no-persist")) {
    return true;
  }

  return (
    SENSITIVE_NAME_PATTERN.test(element.name) ||
    SENSITIVE_NAME_PATTERN.test(element.id)
  );
}
