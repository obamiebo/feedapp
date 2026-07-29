export type DonutSegment = { label: string; value: number; colorClassName: string };

export function Donut({
  segments,
  size = 140,
  strokeWidth = 16,
  centerLabel,
  centerValue
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="text-line"
          stroke="currentColor"
        />
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => {
                const fraction = segment.value / total;
                const dash = fraction * circumference;
                const gap = circumference - dash;
                const dashOffset = -offsetAccum;
                offsetAccum += dash;
                return (
                  <circle
                    key={segment.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    className={segment.colorClassName}
                    stroke="currentColor"
                  >
                    <title>{`${segment.label}: ${segment.value}`}</title>
                  </circle>
                );
              })
          : null}
      </svg>
      {centerValue !== undefined ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-ink">{centerValue}</span>
          {centerLabel ? <span className="text-xs text-muted">{centerLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
