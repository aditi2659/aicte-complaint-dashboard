import React from 'react';
import { ComplaintStatus, BureauCode } from '../../types';

export const StatusBadge: React.FC<{ status: ComplaintStatus; isOverdue?: boolean; size?: 'sm' | 'md' }> = ({
  status,
  isOverdue = false,
  size = 'md'
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-semibold';

  let config = {
    bg: 'bg-[#222F25] text-[#B8CBB9] border-[#35473A]',
    dot: 'bg-[#B8CBB9]',
    label: status.replace(/_/g, ' '),
  };

  switch (status) {
    case 'RECEIVED':
      config = {
        bg: 'bg-[#1E2921] text-[#B8CBB9] border-[#35473A]',
        dot: 'bg-[#B8CBB9]',
        label: 'Received',
      };
      break;
    case 'PENDING':
      config = {
        bg: 'bg-[#C29B53]/10 text-[#D4B36A] border-[#C29B53]/35',
        dot: 'bg-[#D4B36A]',
        label: 'Pending',
      };
      break;
    case 'UNDER_PROCESS':
      config = {
        bg: 'bg-[#C4F279]/10 text-[#C4F279] border-[#C4F279]/40',
        dot: 'bg-[#C4F279]',
        label: 'Under Process',
      };
      break;
    case 'TRANSFERRED':
      config = {
        bg: 'bg-[#222F25] text-[#8CB994] border-[#35473A]',
        dot: 'bg-[#8CB994]',
        label: 'Transferred',
      };
      break;
    case 'ESCALATED':
      config = {
        bg: 'bg-[#FF8BCB]/12 text-[#FF8BCB] border-[#FF8BCB]/45',
        dot: 'bg-[#FF8BCB]',
        label: 'Escalated',
      };
      break;
    case 'DISPOSED':
      config = {
        bg: 'bg-[#222F25] text-[#7C9C82] border-[#35473A]',
        dot: 'bg-[#7C9C82]',
        label: 'Disposed',
      };
      break;
  }

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 border font-mono uppercase tracking-wider ${sizeClasses} ${config.bg}`}>
        <span className={`w-1.5 h-1.5 shrink-0 ${config.dot}`} />
        <span>{config.label}</span>
      </span>

      {isOverdue && status !== 'DISPOSED' && (
        <span className={`inline-flex items-center gap-1 border border-[#FF8BCB]/70 bg-[#FF8BCB]/15 text-[#FF8BCB] font-mono font-bold uppercase tracking-wider ${sizeClasses}`}>
          <span className="w-1.5 h-1.5 shrink-0 bg-[#FF8BCB]" />
          Overdue
        </span>
      )}
    </div>
  );
};

export const BureauBadge: React.FC<{ bureau: BureauCode; size?: 'sm' | 'md' }> = ({ bureau, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs font-semibold';

  let styles = 'bg-[#222F25] text-[#B8CBB9] border-[#35473A]';
  if (bureau === 'RB') styles = 'bg-[#C4F279]/10 text-[#C4F279] border-[#C4F279]/35';
  else if (bureau === 'PGRC') styles = 'bg-[#FF8BCB]/10 text-[#FF8BCB] border-[#FF8BCB]/35';
  else if (bureau === 'AB') styles = 'bg-[#222F25] text-[#8CB994] border-[#35473A]';
  else if (bureau === 'PAPB') styles = 'bg-[#222F25] text-[#709778] border-[#35473A]';
  else if (bureau === 'FDB') styles = 'bg-[#C29B53]/10 text-[#D4B36A] border-[#C29B53]/35';
  else if (bureau === 'SDC') styles = 'bg-[#222F25] text-[#B8CBB9] border-[#35473A]';

  return (
    <span className={`inline-flex items-center font-mono font-bold tracking-wider border ${sizeClasses} ${styles}`}>
      {bureau}
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' }> = ({ priority }) => {
  let styles = 'bg-[#222F25] text-[#B8CBB9] border-[#35473A]';
  let dot = 'bg-[#B8CBB9]';

  if (priority === 'CRITICAL') {
    styles = 'bg-[#FF5C5C]/12 text-[#FF6B6B] border-[#FF5C5C]/45 font-bold';
    dot = 'bg-[#FF5C5C]';
  } else if (priority === 'HIGH') {
    styles = 'bg-[#E5A93C]/10 text-[#E5A93C] border-[#E5A93C]/35 font-semibold';
    dot = 'bg-[#E5A93C]';
  } else if (priority === 'NORMAL') {
    styles = 'bg-[#C4F279]/10 text-[#C4F279] border-[#C4F279]/30';
    dot = 'bg-[#C4F279]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] border uppercase font-mono tracking-wider ${styles}`}>
      <span className={`w-1 h-1 shrink-0 ${dot}`} />
      <span>{priority}</span>
    </span>
  );
};

export const OverlapTag: React.FC<{ count?: number; score?: number; label?: string }> = ({
  count,
  score,
  label = 'Overlap Flag'
}) => {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold bg-[#FF8BCB]/12 text-[#FF8BCB] border border-[#FF8BCB]/50">
      <span className="w-1.5 h-1.5 shrink-0 bg-[#FF8BCB]" />
      <span>{label}</span>
      {score !== undefined && (
        <span className="bg-[#FF8BCB]/25 text-[#FF8BCB] px-1.5 py-0.2 font-bold">
          {score}%
        </span>
      )}
      {count !== undefined && count > 0 && (
        <span className="bg-[#FF8BCB]/25 text-[#FF8BCB] px-1.5 py-0.2 font-bold">
          {count}
        </span>
      )}
    </span>
  );
};
