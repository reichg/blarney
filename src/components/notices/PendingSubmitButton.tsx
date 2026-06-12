"use client";

import type { PendingSubmitButtonProps } from "@/components/notices/type";
import { useFormStatus } from "react-dom";

// Submit button that disables itself while the surrounding form's server
// action is pending. Must be rendered inside a <form> for useFormStatus to
// observe the submission.
export function PendingSubmitButton({
  children,
  className,
  pendingLabel,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} disabled={pending} type="submit">
      {pending && pendingLabel !== undefined ? pendingLabel : children}
    </button>
  );
}
