import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useComplaints } from '../../context/ComplaintContext';

const COLORS = {
  'Under Process': '#C4F279',
  Pending: '#E8AA3A',
  Disposed: '#435F4B',
  Overdue: '#FF69B4',
} as const;

type SeriesKey = keyof typeof COLORS;
const SERIES: SeriesKey[] = [
  'Under Process',
  'Pending',
  'Disposed',
  'Overdue',
];

interface ChartRow {
  bureau: string;
  fullName: string;
  'Under Process': number;
  Pending: number;
  Disposed: number;
  Overdue: number;
}

interface PixelNetworkShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  dataKey?: string;
  payload?: ChartRow;
  activeBureau: string | null;
}

const PIXEL_SIZE = 3;
const PIXEL_GAP = 2;
const PIXEL_STEP = PIXEL_SIZE + PIXEL_GAP;
const GRID = '#292929';

const PixelNetworkShape: React.FC<PixelNetworkShapeProps> = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  dataKey,
  payload,
  activeBureau,
}) => {
  if (!payload || !dataKey || width < 4 || height < 2) return null;

  const key = dataKey as SeriesKey;
  const color = COLORS[key];
  const value = payload[key];
  if (!color || value <= 0) return null;

  const isActive = activeBureau === payload.bureau;
  const isDimmed = activeBureau !== null && !isActive;
  const innerWidth = Math.max(1, width - 5);
  const innerHeight = Math.max(1, height - 3);
  const cols = Math.max(1, Math.floor(innerWidth / PIXEL_STEP));
  const rows = Math.max(1, Math.floor(innerHeight / PIXEL_STEP));
  const seed = [...`${payload.bureau}-${key}`].reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );

  const pixels: Array<{ col: number; row: number; index: number }> = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hash = (col * 7 + row * 11 + seed) % 13;
      if (hash === 0 || hash === 5) continue;
      pixels.push({ col, row, index: pixels.length });
    }
  }
  if (pixels.length === 0) pixels.push({ col: 0, row: 0, index: 0 });

  const pixelMap = new Map(pixels.map((p) => [`${p.col}-${p.row}`, p]));
  const left = x + 2;
  const bottom = y + height - 2;

  return (
    <g
      opacity={isDimmed ? 0.22 : 1}
      style={{
        transition: 'opacity 160ms ease, filter 160ms ease',
        filter: isActive ? `drop-shadow(0 0 5px ${color}90)` : undefined,
      }}
    >
      {/* Subtle offset particles add a little depth. */}
      {pixels.map(({ col, row, index }) => {
        const px = left + col * PIXEL_STEP;
        const py = bottom - (row + 1) * PIXEL_STEP;
        return index % 2 === 0 ? (
          <rect key={`depth-${index}`} x={px + 2} y={py - 2}
            width={PIXEL_SIZE} height={PIXEL_SIZE} fill={color} opacity={0.16} />
        ) : null;
      })}

      {/* Link neighboring pixels into a fine network. */}
      {pixels.map(({ col, row, index }) => {
        const px = left + col * PIXEL_STEP + PIXEL_SIZE / 2;
        const py = bottom - (row + 1) * PIXEL_STEP + PIXEL_SIZE / 2;
        const right = pixelMap.has(`${col + 1}-${row}`);
        const up = pixelMap.has(`${col}-${row + 1}`);
        return (
          <g key={`links-${index}`}>
            {right && <line x1={px} y1={py} x2={px + PIXEL_STEP} y2={py}
              stroke={color} strokeWidth={0.65} strokeOpacity={isActive ? 0.55 : 0.24} />}
            {up && <line x1={px} y1={py} x2={px} y2={py - PIXEL_STEP}
              stroke={color} strokeWidth={0.65} strokeOpacity={isActive ? 0.55 : 0.24} />}
          </g>
        );
      })}

      {/* Dense luminous square particles. */}
      {pixels.map(({ col, row, index }) => {
        const px = left + col * PIXEL_STEP;
        const py = bottom - (row + 1) * PIXEL_STEP;
        const bright = index % 5 === 0 || isActive;
        return (
          <g key={`pixel-${index}`}>
            {bright && <rect x={px - 1} y={py - 1} width={PIXEL_SIZE + 2}
              height={PIXEL_SIZE + 2} fill={color} opacity={0.14} />}
            <rect x={px} y={py} width={PIXEL_SIZE} height={PIXEL_SIZE}
              fill={color} opacity={bright ? 1 : 0.76} />
          </g>
        );
      })}

      {isActive && <rect x={x - 1} y={y - 1} width={width + 1} height={height + 1}
        fill="none" stroke={color} strokeOpacity={0.35} strokeDasharray="2 3"
        pointerEvents="none" />}
    </g>
  );
};

export const WorkloadChart: React.FC = () => {
  const navigate = useNavigate();
  const { getStats } = useComplaints();
  const stats = getStats();
  const [activeBureau, setActiveBureau] = useState<string | null>(null);

  const data: ChartRow[] = useMemo(
    () =>
      stats.bureauWorkload.map((bureau) => ({
        bureau: bureau.code,
        fullName: bureau.name,
        'Under Process': bureau.underProcess,
        Pending: bureau.pending,
        Disposed: bureau.disposed,
        Overdue: bureau.overdue,
      })),
    [stats.bureauWorkload],
  );

  const goToBureau = (code: string) =>
    navigate(`/complaints?bureau=${encodeURIComponent(code)}`);

  const handleBarClick = (entry: { bureau?: string } | null | undefined) => {
    if (entry?.bureau) goToBureau(entry.bureau);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const bureau = stats.bureauWorkload.find((item) => item.code === label);
    const row = data.find((item) => item.bureau === label);

    return (
      <div className="min-w-[220px] border border-[#454545] bg-[#101010] p-3 font-mono text-xs shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-[#292929] pb-2">
          <div>
            <p className="font-semibold leading-5 text-[#F5F5F5]">
              {bureau?.name ?? label}
            </p>
            <p className="mt-0.5 text-[10px] tracking-wider text-[#888888]">
              BUREAU {label}
            </p>
          </div>
          <span className="mt-1 h-2 w-2 shrink-0 bg-[#C4F279]" />
        </div>

        <div className="space-y-2">
          {SERIES.map((key) => (
            <div key={key} className="flex items-center justify-between gap-5">
              <span className="flex items-center gap-2 text-[#B5B5B5]">
                <span className="h-2 w-2 shrink-0" style={{ backgroundColor: COLORS[key] }} />
                {key}
              </span>
              <span className="font-bold tabular-nums" style={{ color: COLORS[key] }}>
                {row?.[key] ?? 0}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-[#292929] pt-2 text-[10px] text-[#C4F279]">
          Click to open bureau complaints →
        </div>
      </div>
    );
  };

  const renderShape = (props: any) => (
    <PixelNetworkShape {...props} activeBureau={activeBureau} />
  );

  const minChartWidth = Math.max(320, data.length * 64);

  return (
    <div className="w-full">
      <div className="overflow-x-auto bg-[#080808]" aria-hidden="true">
        <div className="h-72 w-full" style={{ minWidth: minChartWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 18, right: 18, left: -15, bottom: 0 }}
              barCategoryGap="22%"
              barGap={3}
              onMouseMove={(state: any) => {
                const label = state?.activeLabel ?? null;
                setActiveBureau((previous) => previous === label ? previous : label);
              }}
              onMouseLeave={() => setActiveBureau(null)}
              onClick={(state: any) => {
                const row = state?.activePayload?.[0]?.payload;
                if (row?.bureau) handleBarClick(row);
                else if (state?.activeLabel) goToBureau(String(state.activeLabel));
              }}
              className="cursor-pointer"
            >
              <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />

              <XAxis
                dataKey="bureau"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: '#383838' }}
                tick={{ fill: '#B5B5B5', fontSize: 11, fontFamily: 'monospace' }}
                tickMargin={9}
              />

              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#888888', fontSize: 10, fontFamily: 'monospace' }}
                width={30}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(255,255,255,0.025)' }}
                wrapperStyle={{ outline: 'none', zIndex: 20 }}
              />

              <Legend
                iconType="square"
                iconSize={9}
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                formatter={(value) => <span className="ml-1 text-[#B5B5B5]">{value}</span>}
              />

              <Bar
                dataKey="Under Process"
                fill={COLORS['Under Process']}
                stackId="a"
                shape={renderShape}
                animationDuration={450}
              />
              <Bar
                dataKey="Pending"
                fill={COLORS.Pending}
                stackId="a"
                shape={renderShape}
                animationDuration={450}
              />
              <Bar
                dataKey="Disposed"
                fill={COLORS.Disposed}
                stackId="a"
                shape={renderShape}
                animationDuration={450}
              />
              <Bar
                dataKey="Overdue"
                fill={COLORS.Overdue}
                stackId="b"
                shape={renderShape}
                animationDuration={450}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ul className="sr-only" aria-label="Bureau-wise workload">
        {data.map((row) => (
          <li key={row.bureau}>
            <button
              type="button"
              onFocus={() => setActiveBureau(row.bureau)}
              onBlur={() => setActiveBureau(null)}
              onClick={() => handleBarClick(row)}
              aria-label={`${row.fullName} (${row.bureau}): ${row['Under Process']} under process, ${row.Pending} pending, ${row.Disposed} disposed, ${row.Overdue} overdue. Open in complaint registry.`}
            >
              {row.fullName}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
