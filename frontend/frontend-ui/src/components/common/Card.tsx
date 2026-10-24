import React from 'react';
import { PixelCluster } from './PixelCluster';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: 'none' | 'green' | 'pink';
  pixelAccent?: 'none' | 'lime' | 'pink' | 'mixed';
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  glow = 'none',
  pixelAccent = 'none',
  header,
  footer,
  onClick,
  hoverable = false,
}) => {
  let borderClasses = 'border-[#35473A] bg-[#1A241D]';
  if (glow === 'green') {
    borderClasses = 'border-[#C4F279]/50 bg-[#1A241D] shadow-sm shadow-[#C4F279]/5';
  } else if (glow === 'pink') {
    borderClasses = 'border-[#FF8BCB]/50 bg-[#1A241D] shadow-sm shadow-[#FF8BCB]/5';
  }

  const hoverClasses = hoverable 
    ? 'transition-all duration-200 hover:border-[#4E6654] hover:bg-[#202D24] cursor-pointer' 
    : '';

  return (
    <div
      onClick={onClick}
      className={`relative border text-[#E6EFE5] overflow-hidden ${borderClasses} ${hoverClasses} ${className}`}
    >
      {/* Subtle pixel cluster only when explicitly requested (not on every single card) */}
      {pixelAccent !== 'none' && (
        <div className="absolute top-2 right-2 z-10">
          <PixelCluster variant={pixelAccent} size="sm" />
        </div>
      )}
      
      {header && (
        <div className="px-5 py-3 border-b border-[#35473A] bg-[#222F25] flex items-center justify-between">
          {header}
        </div>
      )}

      <div className="p-5">
        {children}
      </div>

      {footer && (
        <div className="px-5 py-3 border-t border-[#35473A] bg-[#222F25]">
          {footer}
        </div>
      )}
    </div>
  );
};
