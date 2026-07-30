"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode;
  pendingChildren?: ReactNode;
};

export function PendingSubmitButton({ children, pendingChildren = "Saving...", disabled, ...props }: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingChildren : children}
    </button>
  );
}
