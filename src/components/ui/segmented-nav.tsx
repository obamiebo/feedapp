"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

function isRouteActive(pathname: string, href: string, allHrefs: string[]) {
  if (pathname === href) return true;
  const moreSpecificSiblingMatches = allHrefs.some(
    (other) => other !== href && other.startsWith(href) && pathname.startsWith(other)
  );
  if (moreSpecificSiblingMatches) return false;
  return pathname.startsWith(`${href}/`);
}

export function SegmentedNav({
  items
}: {
  items: Array<{ href: Route; label: string; icon?: ReactNode }>;
}) {
  const pathname = usePathname();
  const allHrefs = items.map((item) => item.href as string);

  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1" aria-label="Section navigation">
      {items.map(({ href, label, icon }) => {
        const isActive = isRouteActive(pathname, href as string, allHrefs);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-brand text-white shadow-sm" : "text-muted hover:bg-panel-muted hover:text-ink"
            )}
          >
            {icon}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
