import {
  clearFormDraft,
  DRAFT_ENVELOPE_VERSION,
  DRAFT_KEY_PREFIX,
  DRAFT_MAX_AGE_MS,
  loadFormDraft,
  saveFormDraft,
  SENSITIVE_NAME_PATTERN,
  type FormDraftEnvelope,
} from "@/lib/formDraft";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Minimal in-memory Storage stand-in. The storage core only ever touches
 * getItem/setItem/removeItem, so the rest of the Web Storage surface is omitted.
 * Backed by a real Map so the round-trip semantics match a browser exactly.
 */
function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    store,
    storage: {
      getItem: (key: string): string | null =>
        store.has(key) ? (store.get(key) as string) : null,
      setItem: (key: string, value: string): void => {
        store.set(key, value);
      },
      removeItem: (key: string): void => {
        store.delete(key);
      },
    } as unknown as Storage,
  };
}

const FORM_ID = "registration";
const FORM_VERSION = 3;
const KEY = `${DRAFT_KEY_PREFIX}${FORM_ID}`;

let memory: ReturnType<typeof createMemoryStorage>;

beforeEach(() => {
  memory = createMemoryStorage();
  // The storage core is SSR-guarded on `typeof window`, so simulate the browser
  // by stubbing a window that only exposes sessionStorage.
  vi.stubGlobal("window", { sessionStorage: memory.storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("formDraft storage core", () => {
  it("round-trips saved data under the namespaced draft key", () => {
    const data = { email: "golfer@example.com", name: "Pat" };

    saveFormDraft(FORM_ID, FORM_VERSION, data);

    expect(memory.store.has(KEY)).toBe(true);
    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toEqual(data);
  });

  it("persists a versioned, timestamped envelope around the payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));

    saveFormDraft(FORM_ID, FORM_VERSION, { ok: true });

    const envelope = JSON.parse(
      memory.store.get(KEY) as string,
    ) as FormDraftEnvelope<unknown>;

    expect(envelope.version).toBe(DRAFT_ENVELOPE_VERSION);
    expect(envelope.formVersion).toBe(FORM_VERSION);
    expect(envelope.savedAt).toBe(Date.parse("2026-06-07T12:00:00.000Z"));
    expect(envelope.data).toEqual({ ok: true });
  });

  it("returns null when no draft is stored", () => {
    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
  });

  it("returns null and self-heals on corrupt JSON", () => {
    memory.store.set(KEY, "{not valid json");

    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
    expect(memory.store.has(KEY)).toBe(false);
  });

  it("returns null and self-heals on a non-envelope shape", () => {
    memory.store.set(KEY, JSON.stringify({ data: "loose" }));

    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
    expect(memory.store.has(KEY)).toBe(false);
  });

  it("returns null and self-heals on envelope version mismatch", () => {
    const stale: FormDraftEnvelope<unknown> = {
      version: DRAFT_ENVELOPE_VERSION + 1,
      formVersion: FORM_VERSION,
      savedAt: Date.now(),
      data: { email: "stale@example.com" },
    };
    memory.store.set(KEY, JSON.stringify(stale));

    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
    expect(memory.store.has(KEY)).toBe(false);
  });

  it("returns null and self-heals on form version mismatch", () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "old@example.com" });

    // A caller that bumped its payload-shape version must not read the old draft.
    expect(loadFormDraft(FORM_ID, FORM_VERSION + 1)).toBeNull();
    expect(memory.store.has(KEY)).toBe(false);
  });

  it("returns null and self-heals once the draft outlives the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));

    saveFormDraft(FORM_ID, FORM_VERSION, { email: "fresh@example.com" });

    // Just inside the TTL window the draft is still readable.
    vi.setSystemTime(Date.now() + DRAFT_MAX_AGE_MS - 1);
    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toEqual({
      email: "fresh@example.com",
    });

    // One millisecond past the TTL it is discarded and the key cleared.
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "fresh@example.com" });
    vi.setSystemTime(Date.now() + DRAFT_MAX_AGE_MS + 1);
    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
    expect(memory.store.has(KEY)).toBe(false);
  });

  it("clears a stored draft", () => {
    saveFormDraft(FORM_ID, FORM_VERSION, { email: "bye@example.com" });
    expect(memory.store.has(KEY)).toBe(true);

    clearFormDraft(FORM_ID);

    expect(memory.store.has(KEY)).toBe(false);
  });

  it("does not collide with the registration checkout key", () => {
    // The checkout flow owns `blarney.registrationCheckout`; drafts must stay in
    // their own `blarney.formDraft.*` namespace.
    memory.store.set(
      "blarney.registrationCheckout",
      JSON.stringify({ checkoutId: "abc" }),
    );

    saveFormDraft(FORM_ID, FORM_VERSION, { email: "golfer@example.com" });
    clearFormDraft(FORM_ID);

    expect(memory.store.get("blarney.registrationCheckout")).toBe(
      JSON.stringify({ checkoutId: "abc" }),
    );
  });
});

describe("formDraft SSR and hostile-storage safety", () => {
  it("is a no-op on the server where window is undefined", () => {
    vi.stubGlobal("window", undefined);

    expect(() => saveFormDraft(FORM_ID, FORM_VERSION, { a: 1 })).not.toThrow();
    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
    expect(() => clearFormDraft(FORM_ID)).not.toThrow();
  });

  it("never throws when sessionStorage access throws", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    vi.stubGlobal("window", { sessionStorage: throwingStorage });

    expect(() => saveFormDraft(FORM_ID, FORM_VERSION, { a: 1 })).not.toThrow();
    expect(loadFormDraft(FORM_ID, FORM_VERSION)).toBeNull();
    expect(() => clearFormDraft(FORM_ID)).not.toThrow();
  });
});

describe("formDraft formId namespace guard", () => {
  it("throws in non-production when a formId would escape the namespace", () => {
    // A "." in the formId could collide with sibling keys such as the checkout
    // key, so it is rejected loudly outside production.
    const original = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "test");

    expect(() => saveFormDraft("a.b", FORM_VERSION, { a: 1 })).toThrow(
      /formId must not contain/,
    );
    expect(() => loadFormDraft("a.b", FORM_VERSION)).toThrow(
      /formId must not contain/,
    );

    vi.stubEnv("NODE_ENV", original ?? "test");
  });

  it("no-ops safely in production for an invalid formId", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => saveFormDraft("a.b", FORM_VERSION, { a: 1 })).not.toThrow();
    expect(loadFormDraft("a.b", FORM_VERSION)).toBeNull();
    expect(memory.store.size).toBe(0);

    vi.unstubAllEnvs();
  });
});

describe("SENSITIVE_NAME_PATTERN", () => {
  it("matches credential, token, and chair-control field names", () => {
    for (const name of [
      "password",
      "passwd",
      "pwd",
      "token",
      "csrfToken",
      "secret",
      "cvv",
      "cvc",
      "card",
      "cardNumber",
      "jwt",
      "auth",
      "sessionId",
      "cookie",
      "otp",
      "__chair",
      "__chairToken",
    ]) {
      expect(SENSITIVE_NAME_PATTERN.test(name)).toBe(true);
    }
  });

  it("does not match ordinary buyer/profile field names", () => {
    for (const name of ["email", "name", "phone", "message", "quantity"]) {
      expect(SENSITIVE_NAME_PATTERN.test(name)).toBe(false);
    }
  });
});
