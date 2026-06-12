"use client";

import { useChairActionToast } from "@/app/chair/notices/ChairActionToast";
import { createUseActionNavigation } from "@/components/notices/useActionNavigation";

// Bound through the chair toast module path (not the shared core directly) so
// chair test doubles of ChairActionToast keep intercepting toasts.
export const useChairActionNavigation =
  createUseActionNavigation(useChairActionToast);
