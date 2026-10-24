import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useComplaints } from '../../context/ComplaintContext';

export const TrendsChart: React.FC = () => {
  const { getStats } = useComplaints();
  const stats = getStats();

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const registered = payload.find(
      (item: any) => item.dataKey === 'registered',
    )?.value ?? 0;

    const disposed = payload.find(
      (item: any) => item.dataKey === 'disposed',
    )?.value ?? 0;

    return (
      <div className="min-w-44 border border-[#383838] bg-[#101010] p-3 font-mono text-xs shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-[#292929] pb-2">
          <span className="font-semibold text-[#F5F5F5]">
            {label}
          </span>
          <span className="h-1.5 w-1.5 bg-[#FF69B4]" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-[#FF8BCB]">
              <span className="h-1.5 w-1.5 bg-[#FF69B4]" />
              Registered
            </span>
            <span className="font-bold text-[#F5F5F5]">
              {registered}
            </span>
          </div>

          <div className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-[#C4F279]">
              <span className="h-1.5 w-1.5 bg-[#C4F279]" />
              Disposed
            </span>
            <span className="font-bold text-[#F5F5F5]">
              {disposed}
            </span>
          </div>
        </div>

        <p className="mt-3 border-t border-[#292929] pt-2 text-[10px] text-[#888888]">
          Monthly case totals
        </p>
      </div>
    );
  };

  return (
    <div className="h-[260px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={stats.monthlyTrends}
          margin={{ top: 12, right: 12, left: -18, bottom: 4 }}
        >
          <defs>
            <linearGradient
              id="trendRegisteredFill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#FF69B4" stopOpacity={0.24} />
              <stop offset="95%" stopColor="#FF69B4" stopOpacity={0.01} />
            </linearGradient>

            <linearGradient
              id="trendDisposedFill"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#C4F279" stopOpacity={0.20} />
              <stop offset="95%" stopColor="#C4F279" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="#292929"
            strokeDasharray="3 4"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            tick={{
              fill: '#A3A3A3',
              fontSize: 11,
              fontFamily: 'monospace',
            }}
            tickLine={false}
            axisLine={{ stroke: '#383838' }}
            tickMargin={8}
            minTickGap={12}
          />

          <YAxis
            tick={{
              fill: '#888888',
              fontSize: 10,
              fontFamily: 'monospace',
            }}
            tickLine={false}
            axisLine={false}
            width={34}
            allowDecimals={false}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{
              stroke: '#666666',
              strokeDasharray: '3 3',
            }}
          />

          <Legend
            verticalAlign="bottom"
            align="center"
            height={32}
            iconType="plainline"
            iconSize={12}
            wrapperStyle={{
              fontSize: '11px',
              paddingTop: '8px',
            }}
            formatter={(value) => (
              <span
                style={{
                  color: value === 'New Registered' ? '#FF8BCB' : '#C4F279',
                  marginLeft: 3,
                }}
              >
                {value}
              </span>
            )}
          />

          <Area
            type="monotone"
            dataKey="registered"
            name="New Registered"
            stroke="#FF69B4"
            strokeWidth={2.5}
            activeDot={{
              r: 4,
              fill: '#FF69B4',
              stroke: '#000000',
              strokeWidth: 2,
            }}
            fill="url(#trendRegisteredFill)"
            fillOpacity={1}
            animationDuration={450}
          />

          <Area
            type="monotone"
            dataKey="disposed"
            name="Disposed / Closed"
            stroke="#C4F279"
            strokeWidth={2.5}
            activeDot={{
              r: 4,
              fill: '#C4F279',
              stroke: '#000000',
              strokeWidth: 2,
            }}
            fill="url(#trendDisposedFill)"
            fillOpacity={1}
            animationDuration={450}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

