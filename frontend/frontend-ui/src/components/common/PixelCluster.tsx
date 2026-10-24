import React from 'react';

interface PixelClusterProps {
  variant?: 'lime' | 'pink' | 'mixed' | 'subtle';
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Cohesive pixel grouping motif: A fine-grained 3x2 or 2x2 micro-pixel cluster
 * with subtle stepped opacity, evoking an authentic technical data visual language.
 */
export const PixelCluster: React.FC<PixelClusterProps> = ({
  variant = 'lime',
  className = '',
  size = 'md',
}) => {
  const pixelSize = size === 'sm' ? 'w-0.5 h-0.5' : 'w-1 h-1';

  let primary = 'bg-[#C4F279]';
  let secondary = 'bg-[#C4F279]/60';
  let faint = 'bg-[#C4F279]/25';

  if (variant === 'pink') {
    primary = 'bg-[#FF8BCB]';
    secondary = 'bg-[#FF8BCB]/60';
    faint = 'bg-[#FF8BCB]/25';
  } else if (variant === 'mixed') {
    primary = 'bg-[#C4F279]';
    secondary = 'bg-[#FF8BCB]';
    faint = 'bg-[#C4F279]/30';
  } else if (variant === 'subtle') {
    primary = 'bg-[#4E6654]';
    secondary = 'bg-[#35473A]';
    faint = 'bg-[#35473A]/40';
  }

  return (
    <div className={`flex flex-col gap-0.5 select-none pointer-events-none shrink-0 ${className}`}>
      <div className="flex gap-0.5 justify-end">
        <span className={`${pixelSize} ${faint}`} />
        <span className={`${pixelSize} ${secondary}`} />
        <span className={`${pixelSize} ${primary}`} />
      </div>
      <div className="flex gap-0.5 justify-end">
        <span className={`${pixelSize} ${secondary}`} />
        <span className={`${pixelSize} ${variant === 'mixed' ? 'bg-[#FF8BCB]' : primary}`} />
        <span className={`${pixelSize} ${faint}`} />
      </div>
    </div>
  );
};
