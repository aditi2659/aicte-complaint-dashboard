import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={15} className="absolute left-3 text-[#A6B7A8] pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-xs font-mono bg-[#222F25] border border-[#35473A] text-[#E6EFE5] placeholder-[#A6B7A8]/60 focus:outline-none focus:border-[#C4F279] focus:ring-1 focus:ring-[#C4F279]/30 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 text-[#A6B7A8] hover:text-[#E6EFE5] p-0.5"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
