import React from 'react';
import { LucideIcon, FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accent?: 'green' | 'pink';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FileQuestion,
  title,
  description,
  actionLabel,
  onAction,
  accent = 'green',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[#35473A] bg-[#1A241D]/70">
      <div className={`p-3 mb-3 border ${accent === 'pink' ? 'bg-[#FF8BCB]/10 text-[#FF8BCB] border-[#FF8BCB]/40' : 'bg-[#C4F279]/10 text-[#C4F279] border-[#C4F279]/40'}`}>
        <Icon size={26} />
      </div>
      <h4 className="text-sm font-semibold text-[#E6EFE5] mb-1 font-mono">{title}</h4>
      <p className="text-xs text-[#A6B7A8] max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className={`px-3 py-1.5 text-xs font-bold font-mono transition-colors ${
            accent === 'pink'
              ? 'bg-[#FF8BCB] hover:bg-[#F278BA] text-[#101713]'
              : 'bg-[#C4F279] hover:bg-[#B2E560] text-[#101713]'
          }`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
