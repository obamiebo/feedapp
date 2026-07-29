export type BarDatum = { label: string; value: number; colorClassName: string };

export function BarChart({ data, height = 160 }: { data: BarDatum[]; height?: number }) {
  const max = Math.max(1, ...data.map((datum) => datum.value));
  const barAreaHeight = height - 36;
  const barWidth = 28;
  const gap = 24;
  const width = data.length * barWidth + Math.max(0, data.length - 1) * gap;

  return (
    <svg width="100%" viewBox={`0 0 ${Math.max(width, 1)} ${height}`} preserveAspectRatio="xMidYMax meet" className="overflow-visible">
      {data.map((datum, index) => {
        const barHeight = Math.max(3, (datum.value / max) * barAreaHeight);
        const x = index * (barWidth + gap);
        const y = barAreaHeight - barHeight;
        return (
          <g key={datum.label}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} className={datum.colorClassName}>
              <title>{`${datum.label}: ${datum.value}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={barAreaHeight + 16}
              textAnchor="middle"
              className="fill-ink text-[9px] font-semibold"
            >
              {datum.value}
            </text>
            <text x={x + barWidth / 2} y={barAreaHeight + 30} textAnchor="middle" className="fill-muted text-[8px]">
              {datum.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
