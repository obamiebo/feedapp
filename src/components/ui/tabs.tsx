"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tabs({
  items,
  active,
  onChange,
  children
}: {
  items: Array<{ key: string; label: ReactNode }>;
  active: string;
  onChange: (key: string) => void;
  children: (activeKey: string) => ReactNode;
}) {
  return (
    <div>
      <div role="tablist" className="mb-4 flex flex-wrap gap-2 border-b border-line pb-3">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === active}
            onClick={() => onChange(item.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              item.key === active
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:bg-panel-muted hover:text-ink"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
