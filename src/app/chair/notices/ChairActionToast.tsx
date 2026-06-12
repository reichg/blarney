// Chair binding over the shared action toast in src/components/notices.
// Chair modules and their test doubles resolve the toast through this path.
export {
  ActionToastProvider as ChairActionToastProvider,
  useActionToast as useChairActionToast,
} from "@/components/notices/ActionToast";
export type { ChairNotice } from "@/app/chair/notices/type";
