interface ChartPoint {
  label: string;
  amount: number;
}

interface PieChartProps {
  title: string;
  emptyMessage: string;
  color?: string;
  border?: string;
  points: ChartPoint[];
}

const SLICE_COLORS = [
  "#d97706",
  "#0f766e",
  "#0284c7",
  "#7c3aed",
  "#e11d48",
  "#65a30d",
];

const OTHER_COLOR = "#94a3b8";
const MAX_SLICES = 5;
const CX = 80;
const CY = 80;
const OUTER = 68;
const INNER = 42;

function polar(radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: CX + radius * Math.cos(radians),
    y: CY + radius * Math.sin(radians),
  };
}

function donutPath(startAngle: number, endAngle: number) {
  const sweep = Math.min(359.999, Math.max(0, endAngle - startAngle));

  if (sweep <= 0) {
    return "";
  }

  if (sweep >= 359.5) {
    const topOuter = polar(OUTER, 0);
    const bottomOuter = polar(OUTER, 180);
    const topInner = polar(INNER, 0);
    const bottomInner = polar(INNER, 180);

    return [
      `M ${topOuter.x} ${topOuter.y}`,
      `A ${OUTER} ${OUTER} 0 1 1 ${bottomOuter.x} ${bottomOuter.y}`,
      `A ${OUTER} ${OUTER} 0 1 1 ${topOuter.x} ${topOuter.y}`,
      `M ${topInner.x} ${topInner.y}`,
      `A ${INNER} ${INNER} 0 1 0 ${bottomInner.x} ${bottomInner.y}`,
      `A ${INNER} ${INNER} 0 1 0 ${topInner.x} ${topInner.y}`,
    ].join(" ");
  }

  const start = polar(OUTER, startAngle);
  const end = polar(OUTER, endAngle);
  const innerEnd = polar(INNER, endAngle);
  const innerStart = polar(INNER, startAngle);
  const large = sweep > 180 ? 1 : 0;

  return [
    `M ${start.x} ${start.y}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${end.x} ${end.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function buildSlices(points: ChartPoint[]) {
  const positive = points
    .filter((point) => point.amount > 0)
    .sort((left, right) => right.amount - left.amount);

  if (positive.length === 0) {
    return [];
  }

  const head = positive.slice(0, MAX_SLICES);
  const rest = positive.slice(MAX_SLICES);
  const otherAmount = rest.reduce((sum, point) => sum + point.amount, 0);
  const rows =
    otherAmount > 0
      ? [...head, { label: `Other (${rest.length})`, amount: otherAmount }]
      : head;
  const total = rows.reduce((sum, point) => sum + point.amount, 0);

  let angle = 0;

  return rows.map((point, index) => {
    const portion = point.amount / total;
    const sweep = portion * 360;
    const gap = rows.length > 1 && sweep > 8 ? 1.4 : 0;
    const startAngle = angle + gap / 2;
    const endAngle = angle + sweep - gap / 2;
    angle += sweep;

    return {
      ...point,
      portion,
      startAngle,
      endAngle,
      color: rows.length === index + 1 && otherAmount > 0
        ? OTHER_COLOR
        : SLICE_COLORS[index % SLICE_COLORS.length],
    };
  });
}

function PieChart({
  title,
  emptyMessage,
  color = "#d97706",
  border = "border-slate-200",
  points,
}: PieChartProps) {
  const slices = buildSlices(points);
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

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
            Qty by product
          </p>
        </div>
      </div>

      {slices.length === 0 ? (
        <p className="flex flex-1 items-center justify-center px-4 pb-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-4 pt-2 sm:flex-row sm:items-center">
          <div className="relative h-40 w-40 shrink-0">
            <svg
              viewBox="0 0 160 160"
              className="h-full w-full"
              role="img"
              aria-label={`${title} chart`}
            >
              <circle cx={CX} cy={CY} r={OUTER} fill="#f8fafc" />
              <circle cx={CX} cy={CY} r={INNER - 2} fill="#ffffff" />
              {slices.map((slice, index) => (
                <path
                  key={slice.label}
                  className="anim-pie"
                  style={{ animationDelay: `${index * 70}ms` }}
                  d={donutPath(slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                >
                  <title>
                    {`${slice.label}: ${slice.amount} (${Math.round(slice.portion * 100)}%)`}
                  </title>
                </path>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="font-ledger text-xl font-semibold leading-none text-slate-800">
                  {total}
                </p>
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  stock
                </p>
              </div>
            </div>
          </div>

          <ul className="min-h-0 w-full min-w-0 flex-1 space-y-1.5">
            {slices.map((slice) => (
              <li
                key={slice.label}
                className="flex min-w-0 items-center gap-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-600">
                  {slice.label}
                </span>
                <span className="font-ledger shrink-0 text-xs font-semibold text-slate-500">
                  {slice.amount}
                </span>
                <span className="font-ledger w-8 shrink-0 text-right text-[11px] text-slate-400">
                  {Math.round(slice.portion * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default PieChart;
