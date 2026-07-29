import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "warning" | "critical" | "ok";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-bg text-muted",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
  ok: "bg-ok-bg text-ok"
};

export function StatusBadge({
  label,
  tone,
  className
}: {
  label: string;
  tone: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function priorityTone(priority: string): BadgeTone {
  switch (priority) {
    case "Critical":
      return "critical";
    case "High":
      return "warning";
    case "Medium":
      return "info";
    case "Low":
      return "ok";
    default:
      return "neutral";
  }
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "New":
      return "neutral";
    case "Assigned":
      return "info";
    case "In Progress":
      return "warning";
    case "Resolved":
      return "ok";
    case "Closed":
      return "neutral";
    case "Reopened":
      return "critical";
    default:
      return "neutral";
  }
}

export function slaTone({ breached, atRisk }: { breached: boolean; atRisk: boolean }): BadgeTone {
  if (breached) return "critical";
  if (atRisk) return "warning";
  return "ok";
}

export function slaLabel({ breached, atRisk }: { breached: boolean; atRisk: boolean }): string {
  if (breached) return "Breached";
  if (atRisk) return "At risk";
  return "On track";
}
