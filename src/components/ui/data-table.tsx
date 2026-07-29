import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/cn";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowHref,
  getRowKey,
  emptyIcon,
  emptyMessage
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowHref?: (row: T) => Route;
  getRowKey: (row: T) => string;
  emptyIcon: LucideIcon;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={emptyIcon} message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted">
            {columns.map((column) => (
              <th key={column.key} className={cn("px-3 py-2.5 font-semibold", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={getRowKey(row)}
                className={cn(
                  "relative border-b border-line/70 last:border-0",
                  href ? "cursor-pointer transition-colors hover:bg-panel-muted" : undefined
                )}
              >
                {columns.map((column, index) => (
                  <td key={column.key} className={cn("px-3 py-3 align-middle text-ink", column.className)}>
                    {href && index === 0 ? (
                      <Link href={href} className="absolute inset-0" aria-label="Open" />
                    ) : null}
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
