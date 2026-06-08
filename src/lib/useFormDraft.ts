"use client";

/**
 * React hooks layer over the pure `formDraft` storage core.
 *
 * Provides two integration shapes:
 * - `useControlledFormDraft` for forms whose restorable state lives in React.
 * - `useUncontrolledFormDraft` for forms whose values live in the DOM.
 */

import {
  clearFormDraft,
  isPersistableField,
  loadFormDraft,
  saveFormDraft,
  type FormDraftEnvelope,
} from "@/lib/formDraft";
import { useCallback, useEffect, useRef, useState } from "react";

export type { FormDraftEnvelope };

/** Debounce window before a draft snapshot is written to storage. */
export const DRAFT_SAVE_DEBOUNCE_MS = 500;

export type ControlledFormDraftOptions<T> = {
  formId: string;
  formVersion: number;
  value: T;
  onRestore: (data: T) => void;
  enabled?: boolean;
  /**
   * Optional gate for whether a snapshot holds meaningful user content. When
   * provided, empty snapshots are not persisted and a restored-but-empty draft
   * is discarded without showing the restore notice. Omitting it preserves the
   * legacy "persist and restore everything" behavior.
   */
  hasContent?: (value: T) => boolean;
};

export type FormDraftHandle = {
  wasRestored: boolean;
  clearDraft: () => void;
};

/**
 * Persist a controlled snapshot. The empty initial snapshot must not clobber a
 * stored draft before restore runs, so saving is gated on the mount restore
 * effect having completed.
 */
export function useControlledFormDraft<T>({
  formId,
  formVersion,
  value,
  onRestore,
  enabled = true,
  hasContent,
}: ControlledFormDraftOptions<T>): FormDraftHandle {
  const [wasRestored, setWasRestored] = useState(false);
  const restoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRestoreRef = useRef(onRestore);
  const hasContentRef = useRef(hasContent);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    hasContentRef.current = hasContent;
  }, [hasContent]);

  const clearDraft = useCallback(() => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    clearFormDraft(formId);
    // Discarding (or clearing on submit) means there is nothing restored to
    // announce, so hide the notice.
    setWasRestored(false);
  }, [formId]);

  // One-time mount restore. Runs only on the client, so it cannot cause a
  // hydration mismatch. State is applied in a microtask so the restore is a
  // discrete update rather than a synchronous cascade within the effect.
  useEffect(() => {
    if (restoredRef.current) {
      return;
    }

    restoredRef.current = true;

    if (!enabled) {
      return;
    }

    const draft = loadFormDraft<T>(formId, formVersion);

    if (draft !== null) {
      const meaningful = hasContentRef.current
        ? hasContentRef.current(draft)
        : true;

      if (meaningful) {
        queueMicrotask(() => {
          onRestoreRef.current(draft);
          setWasRestored(true);
        });
      } else {
        // Stored draft is effectively empty; drop it instead of restoring an
        // untouched form and surfacing a misleading notice.
        clearFormDraft(formId);
      }
    }
    // Intentionally mount-only: restore must not re-run when value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced save. Skipped until restore has run so the initial snapshot does
  // not overwrite a stored draft before it is applied.
  useEffect(() => {
    if (!enabled || !restoredRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      // Clearing the form back to empty should also clear storage so an empty
      // draft never resurfaces a restore notice.
      if (hasContentRef.current && !hasContentRef.current(value)) {
        clearFormDraft(formId);
      } else {
        saveFormDraft(formId, formVersion, value);
      }

      saveTimerRef.current = null;
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [enabled, formId, formVersion, value]);

  return { wasRestored, clearDraft };
}

export type UncontrolledFormDraftOptions = {
  formId: string;
  formVersion: number;
  formRef: { current: HTMLFormElement | null };
  excludeFields?: readonly string[];
  enabled?: boolean;
};

export type UncontrolledFormDraftHandle = FormDraftHandle & {
  handleChange: () => void;
};

type UncontrolledDraftData = Record<string, string | string[]>;

function serializeForm(
  form: HTMLFormElement,
  exclude: ReadonlySet<string>,
): UncontrolledDraftData {
  const data: UncontrolledDraftData = {};

  for (const element of Array.from(form.elements)) {
    if (!isPersistableField(element)) {
      continue;
    }

    const { name, value } = element;

    if (!name || exclude.has(name) || value === "") {
      continue;
    }

    const existing = data[name];

    if (existing === undefined) {
      data[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      // Repeated name collapses to a positional array.
      data[name] = [existing, value];
    }
  }

  return data;
}

/** Restores stored values into the form and returns the count actually written. */
function restoreForm(form: HTMLFormElement, data: UncontrolledDraftData): number {
  let restoredCount = 0;

  for (const element of Array.from(form.elements)) {
    if (!isPersistableField(element)) {
      continue;
    }

    const stored = data[element.name];

    if (stored === undefined) {
      continue;
    }

    if (Array.isArray(stored)) {
      // Positional restore: consume one value per matching element occurrence.
      const next = stored.shift();

      if (next !== undefined) {
        element.value = next;
        restoredCount += 1;
      }
    } else {
      element.value = stored;
      delete data[element.name];
      restoredCount += 1;
    }
  }

  return restoredCount;
}

/**
 * Persist values that live in the DOM rather than React state. `handleChange`
 * should be wired to the form's `onInput`/`onChange`. File inputs are never
 * read or written.
 */
export function useUncontrolledFormDraft({
  formId,
  formVersion,
  formRef,
  excludeFields,
  enabled = true,
}: UncontrolledFormDraftOptions): UncontrolledFormDraftHandle {
  const [wasRestored, setWasRestored] = useState(false);
  const restoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excludeRef = useRef<ReadonlySet<string>>(new Set(excludeFields));

  useEffect(() => {
    excludeRef.current = new Set(excludeFields);
  }, [excludeFields]);

  const clearDraft = useCallback(() => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    clearFormDraft(formId);
    // Discarding (or clearing on submit) means there is nothing restored to
    // announce, so hide the notice.
    setWasRestored(false);
  }, [formId]);

  const handleChange = useCallback(() => {
    if (!enabled || !restoredRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      const form = formRef.current;

      if (form) {
        const data = serializeForm(form, excludeRef.current);

        // An all-empty form serializes to `{}`; persisting it would resurface a
        // restore notice for content the user never entered.
        if (Object.keys(data).length === 0) {
          clearFormDraft(formId);
        } else {
          saveFormDraft(formId, formVersion, data);
        }
      }

      saveTimerRef.current = null;
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }, [enabled, formId, formVersion, formRef]);

  // One-time mount restore. Client-only; no hydration mismatch.
  useEffect(() => {
    if (restoredRef.current) {
      return;
    }

    restoredRef.current = true;

    if (!enabled) {
      return;
    }

    const form = formRef.current;
    const draft = form
      ? loadFormDraft<UncontrolledDraftData>(formId, formVersion)
      : null;

    if (form && draft !== null) {
      // Clone array values so positional restore can mutate without touching
      // the source object.
      const cloned: UncontrolledDraftData = {};

      for (const [key, val] of Object.entries(draft)) {
        cloned[key] = Array.isArray(val) ? [...val] : val;
      }

      const restoredCount = restoreForm(form, cloned);

      if (restoredCount > 0) {
        queueMicrotask(() => {
          setWasRestored(true);
        });
      } else {
        // Draft held nothing that maps onto current fields; drop it so it does
        // not linger or trigger an empty restore notice.
        clearFormDraft(formId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  return { wasRestored, clearDraft, handleChange };
}
