import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  accent?: 'green' | 'pink' | 'slate';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '2xl',
  accent = 'green',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  const accentBorder = accent === 'pink' 
    ? 'border-[#FF8BCB]/60 shadow-xl shadow-black/60' 
    : accent === 'green'
    ? 'border-[#C4F279]/50 shadow-xl shadow-black/60'
    : 'border-[#35473A] shadow-xl shadow-black/60';

  const accentDot = accent === 'pink' ? 'bg-[#FF8BCB]' : 'bg-[#C4F279]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-[#0A0F0C]/80 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className={`relative w-full ${maxWidthClass} border bg-[#1A241D] text-[#E6EFE5] ${accentBorder} my-8 z-10 overflow-hidden`}>
        {/* Crisp pixel square notch */}
        <div className={`absolute top-0 right-0 w-3 h-3 ${accentDot}`} />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#35473A] bg-[#222F25] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 ${accentDot}`} />
              <h3 className="text-base font-bold text-[#E6EFE5] tracking-wide font-mono">{title}</h3>
            </div>
            {subtitle && <p className="text-xs text-[#A6B7A8] mt-0.5">{subtitle}</p>}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#A6B7A8] hover:text-[#E6EFE5] hover:bg-[#27362B] transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
