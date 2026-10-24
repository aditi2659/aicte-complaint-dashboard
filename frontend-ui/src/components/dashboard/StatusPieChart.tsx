import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useComplaints } from '../../context/ComplaintContext';

type StatusEntry = {
  name: string;
  value: number;
  color: string;
};

type PixelArcShapeProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
  payload?: StatusEntry;
  index?: number;
};

const PIXEL_SIZE = 3;
const PIXEL_STEP = 6;

const PixelArcShape: React.FC<PixelArcShapeProps> = ({
  cx = 0,
  cy = 0,
  innerRadius = 55,
  outerRadius = 85,
  startAngle = 0,
  endAngle = 0,
  fill = '#C4F279',
  payload,
  index = 0,
}) => {
  const color = payload?.color ?? fill;
  const span = Math.abs(endAngle - startAngle);
  const midRadius = (innerRadius + outerRadius) / 2;
  const arcLength = (span * Math.PI / 180) * midRadius;
  const count = Math.max(1, Math.floor(arcLength / PIXEL_STEP));
  const thickness = Math.max(1, Math.floor((outerRadius - innerRadius - 4) / PIXEL_STEP));
  const pixels: Array<{ angle: number; radius: number; id: string }> = [];

  for (let i = 0; i < count; i++) {
    const angle = startAngle + (endAngle - startAngle) * ((i + 0.5) / count);
    for (let layer = 0; layer < thickness; layer++) {
      // Leave tiny gaps in a stable pattern so the ring reads as particles.
      if ((i + layer * 3 + index) % 9 === 0) continue;
      pixels.push({
        angle,
        radius: innerRadius + 3 + layer * PIXEL_STEP,
        id: `${i}-${layer}`,
      });
    }
  }

  const toPoint = (angle: number, radius: number) => {
    const radians = (-angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
  };

  const polarPoint = (angle: number, radius: number) => {
    const radians = (-angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
  };
  const startOuter = polarPoint(startAngle, outerRadius);
  const endOuter = polarPoint(endAngle, outerRadius);
  const startInner = polarPoint(startAngle, innerRadius);
  const endInner = polarPoint(endAngle, innerRadius);
  const largeArc = span > 180 ? 1 : 0;
  const sectorPath = [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    'Z',
  ].join(' ');

  return (
    <g style={{ filter: `drop-shadow(0 0 3px ${color}65)` }}>
      {/* Continuous hit area prevents hover flicker in the tiny particle gaps. */}
      <path d={sectorPath} fill="transparent" stroke="transparent" pointerEvents="all" />
      {/* Fine curved connectors between neighboring particle rows. */}
      {pixels.map((pixel, i) => {
        const next = pixels[i + 1];
        if (!next || pixel.id.split('-')[1] !== next.id.split('-')[1]) return null;
        const a = toPoint(pixel.angle, pixel.radius);
        const b = toPoint(next.angle, next.radius);
        return (
          <line
            key={`link-${pixel.id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
            pointerEvents="none"
            strokeWidth={0.7}
            strokeOpacity={0.36}
          />
        );
      })}

      {/* Square particles follow the original donut arc exactly. */}
      {pixels.map((pixel) => {
        const point = toPoint(pixel.angle, pixel.radius);
        const bright = (Number(pixel.id.split('-')[0]) + index) % 5 === 0;
        return (
          <g key={pixel.id}>
            {bright && (
              <rect
                x={point.x - 2.5}
                y={point.y - 2.5}
                width={PIXEL_SIZE + 2}
                height={PIXEL_SIZE + 2}
                fill={color}
                pointerEvents="none"
                opacity={0.16}
              />
            )}
            <rect
              x={point.x - PIXEL_SIZE / 2}
              y={point.y - PIXEL_SIZE / 2}
              width={PIXEL_SIZE}
              height={PIXEL_SIZE}
              fill={color}
              pointerEvents="none"
              opacity={bright ? 1 : 0.82}
            />
          </g>
        );
      })}
    </g>
  );
};

export const StatusPieChart: React.FC = () => {
  const navigate = useNavigate();
  const { getStats } = useComplaints();
  const stats = getStats();

  const handleSliceClick = (entry: any) => {
    if (entry && entry.name) {
      let statusKey = 'UNDER_PROCESS';
      if (entry.name.includes('Pending')) statusKey = 'PENDING';
      else if (entry.name.includes('Escalated')) statusKey = 'ESCALATED';
      else if (entry.name.includes('Transferred')) statusKey = 'TRANSFERRED';
      else if (entry.name.includes('Disposed')) statusKey = 'DISPOSED';
      navigate(`/complaints?status=${statusKey}`);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-[#101010] border border-[#353535] p-2.5 shadow-2xl font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5" style={{ backgroundColor: data.payload.color }} />
            <span className="font-bold text-[#F5F5F5]">{data.name}:</span>
            <span className="text-[#C4F279] font-bold">{data.value} cases</span>
          </div>
          <div className="text-[10px] text-[#A3A3A3] mt-1">Click slice to filter registry</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-72 w-full flex flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={stats.statusDistribution}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={3}
            dataKey="value"
            shape={(props: any) => <PixelArcShape {...props} />}
            onClick={handleSliceClick}
            className="cursor-pointer"
            isAnimationActive={false}
          >
            {stats.statusDistribution.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="#080808" strokeWidth={1} />
            ))}
          </Pie>
          <Tooltip
            content={<CustomTooltip />}
            isAnimationActive={false}
            cursor={false}
            wrapperStyle={{ outline: 'none', pointerEvents: 'none', zIndex: 30 }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
            formatter={(val) => <span className="text-[#A3A3A3] font-sans">{val}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
