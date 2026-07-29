import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  breadcrumbHref,
  breadcrumbLabel
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbHref?: Route;
  breadcrumbLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      {breadcrumbHref ? (
        <Link
          href={breadcrumbHref}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-brand"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {breadcrumbLabel ?? "Back"}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-accent">{eyebrow}</div>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
