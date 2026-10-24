import React from 'react';
import { LucideIcon } from 'lucide-react';
import { PixelCluster } from '../common/PixelCluster';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: 'green' | 'pink' | 'cyan' | 'amber' | 'slate';
  onClick?: () => void;
  clickable?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = 'green',
  onClick,
  clickable = true,
}) => {
  const accentStyles = {
    green: {
      border: 'border-[#657B4B]/80 hover:border-[#C4F279]',
      iconBg: 'border border-[#657B4B]/80 bg-[#C4F279]/[0.11] text-[#C4F279]',
      text: 'text-[#C4F279]',
      pixelVariant: 'lime' as const,
      glow: 'hover:shadow-[0_0_16px_rgba(196,242,121,0.07)]',
      line: 'bg-[#C4F279]/80',
    },
    pink: {
      border: 'border-[#8A456A]/80 hover:border-[#FF8BCB]',
      iconBg: 'border border-[#8A456A]/80 bg-[#FF8BCB]/[0.11] text-[#FF8BCB]',
      text: 'text-[#FF8BCB]',
      pixelVariant: 'pink' as const,
      glow: 'hover:shadow-[0_0_16px_rgba(255,139,203,0.07)]',
      line: 'bg-[#FF8BCB]/80',
    },
    cyan: {
      border: 'border-[#465B4B] hover:border-[#78947C]',
      iconBg: 'border border-[#465B4B] bg-[#78947C]/[0.12] text-[#A9C8AE]',
      text: 'text-[#A9C8AE]',
      pixelVariant: 'subtle' as const,
      glow: 'hover:shadow-[0_0_12px_rgba(169,200,174,0.05)]',
      line: 'bg-[#A9C8AE]/60',
    },
    slate: {
      border: 'border-[#414141] hover:border-[#666666]',
      iconBg: 'border border-[#414141] bg-[#FFFFFF]/[0.05] text-[#D4D4D4]',
      text: 'text-[#E0E0E0]',
      pixelVariant: 'subtle' as const,
      glow: 'hover:shadow-[0_0_12px_rgba(255,255,255,0.04)]',
      line: 'bg-[#AAAAAA]/60',
    },
    amber: {
      border: 'border-[#856A35]/80 hover:border-[#E8AA3A]',
      iconBg: 'border border-[#856A35]/80 bg-[#E8AA3A]/[0.11] text-[#E8AA3A]',
      text: 'text-[#F0BC53]',
      pixelVariant: 'subtle' as const,
      glow: 'hover:shadow-[0_0_16px_rgba(232,170,58,0.07)]',
      line: 'bg-[#E8AA3A]/80',
    },
  }[accent];

  return (
    <div
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable && onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={clickable && onClick ? 'button' : undefined}
      tabIndex={clickable && onClick ? 0 : undefined}
      className={`group relative min-w-0 overflow-hidden border bg-[#111111] p-3.5 transition-all duration-200 sm:p-4 ${accentStyles.border} ${
        clickable
          ? `cursor-pointer hover:bg-[#171717] ${accentStyles.glow} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C4F279]`
          : ''
      }`}
    >
      {(accent === 'green' || accent === 'pink') && (
        <div className="pointer-events-none absolute right-2 top-2 opacity-75 transition-opacity group-hover:opacity-100">
          <PixelCluster variant={accentStyles.pixelVariant} size="sm" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-1 truncate font-mono text-[10px] font-semibold uppercase tracking-wider text-[#B5B5B5]">
            {title}
          </div>

          <div className={`font-mono text-xl font-bold tracking-tight sm:text-2xl ${accentStyles.text}`}>
            {value}
          </div>

          {subtitle && (
            <div className="mt-1 truncate font-sans text-[10px] text-[#A0A0A0]">
              {subtitle}
            </div>
          )}
        </div>

        <div className={`shrink-0 p-2 transition-colors duration-200 sm:p-2.5 ${accentStyles.iconBg}`}>
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>

      <div
        className={`pointer-events-none absolute bottom-0 left-0 h-px w-0 transition-all duration-300 group-hover:w-full ${accentStyles.line}`}
      />
    </div>
  );
};
