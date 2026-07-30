"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("w-full pr-10", className)}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent"
        title={visible ? "Hide password" : "Show password"}
        type="button"
        onClick={() => setVisible((current) => !current)}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
