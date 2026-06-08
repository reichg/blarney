"use client";

import type { MouseEvent, ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  children: ReactNode;
  confirmMessage: string;
  className?: string;
  ariaLabel?: string;
};

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
  ariaLabel,
}: ConfirmSubmitButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <button
      aria-label={ariaLabel}
      className={className}
      onClick={handleClick}
      type="submit"
    >
      {children}
    </button>
  );
}
