import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function Disclosure({
  summary,
  children,
  defaultOpen = false
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group rounded-lg border border-line bg-panel" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          size={16}
          className="shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}
