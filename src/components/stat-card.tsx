import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type StatTone = "neutral" | "warning" | "critical" | "ok";

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "bg-brand/10 text-brand",
  warning: "bg-warning-bg text-warning",
  critical: "bg-critical-bg text-critical",
  ok: "bg-ok-bg text-ok"
};

export type StatTrend = {
  deltaPct: number | null;
  comparisonLabel: string;
  positive: boolean;
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  trend
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: StatTone;
  trend?: StatTrend;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={cn("flex size-10 items-center justify-center rounded-md", TONE_CLASSES[tone])} aria-hidden="true">
          <Icon size={18} />
        </div>
        {trend && trend.deltaPct !== null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              trend.positive ? "bg-ok-bg text-ok" : "bg-critical-bg text-critical"
            )}
          >
            {trend.positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(trend.deltaPct)}%
          </span>
        ) : null}
      </div>
      <div>
        <div className="text-sm font-medium text-muted">{label}</div>
        <div className="mt-1 text-2xl font-semibold text-ink">{value.toLocaleString()}</div>
        {trend ? <div className="mt-1 text-xs text-muted">{trend.comparisonLabel}</div> : null}
      </div>
    </div>
  );
}
