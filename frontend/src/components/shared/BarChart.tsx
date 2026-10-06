import { useId } from "react";

interface ChartPoint {
  label: string;
  amount: number;
}

interface BarChartProps {
  title: string;
  yLabel: string;
  xLabel: string;
  emptyMessage: string;
  color?: string;
  border?: string;
  points: ChartPoint[];
}

function formatTick(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${Math.round(value / 100000) / 10}M`;
  }

  if (abs >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  if (abs >= 10) {
    return String(Math.round(value));
  }

  return String(Math.round(value * 10) / 10);
}

function niceMax(value: number) {
  if (value <= 0) {
    return 1;
  }

  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / exp;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * exp;
}

function BarChart({
  title,
  yLabel,
  xLabel,
  emptyMessage,
  color = "#0f766e",
  border = "border-slate-200",
  points,
}: BarChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const displayPoints = points.slice(0, 8);
  const crowded = displayPoints.length > 5;
  const width = 560;
  const height = crowded ? 196 : 188;
  const left = 36;
  const right = 8;
  const top = 10;
  const bottom = crowded ? 42 : 28;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = niceMax(Math.max(...displayPoints.map((point) => point.amount), 1));
  const gridSteps = 8;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, index) => ({
    value: (maxValue * index) / gridSteps,
    major: index % 2 === 0,
  }));
  const slot = displayPoints.length === 0 ? 0 : plotWidth / displayPoints.length;
  const barWidth =
    displayPoints.length === 0 ? 0 : Math.min(28, Math.max(8, slot * 0.55));
  const extra =
    points.length > displayPoints.length
      ? `Top ${displayPoints.length} of ${points.length}`
      : "";

  return (
    <div
      className={`flex h-full min-h-17.25rem min-w-0 flex-col overflow-hidden rounded-2xl border border-l-4 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${border}`}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: color }}
            />
            <h2 className="truncate text-sm font-semibold text-slate-800">
              {title}
            </h2>
          </div>
          <p className="mt-0.5 pl-4 text-[11px] font-medium text-slate-400">
            {yLabel} · {xLabel}
            {extra ? ` · ${extra}` : ""}
          </p>
        </div>
      </div>

      {displayPoints.length === 0 ? (
        <p className="px-4 pb-6 pt-8 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-1 items-end px-2 pb-3 pt-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="font-ledger h-11.5rem w-full max-w-full"
            role="img"
            aria-label={`${title} chart`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor={color} stopOpacity="0.72" />
                <stop offset="100%" stopColor={color} stopOpacity="1" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => {
              const y = top + plotHeight - (tick.value / maxValue) * plotHeight;
              const isBase = tick.value === 0;

              return (
                <g key={tick.value}>
                  <line
                    x1={left}
                    y1={y}
                    x2={width - right}
                    y2={y}
                    stroke={isBase ? "#d8e2ea" : tick.major ? "#e8eef3" : "#f4f7fa"}
                    strokeWidth={isBase ? 1.15 : 1}
                    strokeDasharray={tick.major || isBase ? undefined : "3 4"}
                  />
                  {tick.major ? (
                    <text
                      x={left - 6}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fill="#94a3b8"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {formatTick(tick.value)}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {displayPoints.map((point, index) => {
              const x = left + index * slot + (slot - barWidth) / 2;
              const barHeight = Math.max(
                4,
                (point.amount / maxValue) * plotHeight
              );
              const y = top + plotHeight - barHeight;
              const maxChars = crowded ? 8 : 10;
              const shortLabel =
                point.label.length > maxChars
                  ? `${point.label.slice(0, maxChars - 1)}…`
                  : point.label;
              const labelX = x + barWidth / 2;
              const labelY = top + plotHeight + (crowded ? 12 : 16);

              return (
                <g key={`${point.label}-${index}`}>
                  <rect
                    className="anim-bar"
                    style={{ animationDelay: `${index * 55}ms` }}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    fill={`url(#${gradientId})`}
                  >
                    <title>{`${point.label}: ${formatTick(point.amount)}`}</title>
                  </rect>
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={crowded ? "end" : "middle"}
                    fill="#64748b"
                    fontSize="10"
                    fontWeight="500"
                    transform={
                      crowded
                        ? `rotate(-38, ${labelX}, ${labelY})`
                        : undefined
                    }
                  >
                    {shortLabel}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

export default BarChart;
