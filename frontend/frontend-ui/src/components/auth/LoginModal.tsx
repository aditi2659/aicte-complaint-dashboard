import React, { useState } from 'react';
import { KeyRound, Shield, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useComplaints } from '../../context/ComplaintContext';
import { DEMO_CREDENTIALS } from '../../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, apiLoading } = useComplaints();
  const [email, setEmail] = useState('admin@aicte.gov.in');
  const [password, setPassword] = useState('AICTE_Admin_9aF8c3e210b48d7120');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    }
  };

  const handleSelectDemo = (demo: typeof DEMO_CREDENTIALS[0]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Authentication Gateway"
      subtitle="AICTE Central Portal • Secure JWT Bearer Authentication"
      maxWidth="lg"
      accent="green"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-[#2D1B1F] border border-[#FF8BCB] p-3 text-xs text-[#FF8BCB] font-mono flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-mono text-[#B8CBB9] mb-1">
              Official Email Address:
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@aicte.gov.in"
              className="w-full px-3 py-2 bg-[#1A241D] border border-[#35473A] text-xs font-mono text-[#E6EFE5] focus:outline-none focus:border-[#C4F279]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-[#B8CBB9] mb-1">
              Password:
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 bg-[#1A241D] border border-[#35473A] text-xs font-mono text-[#E6EFE5] focus:outline-none focus:border-[#C4F279]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={apiLoading}
              className="w-full py-2 bg-[#C4F279] hover:bg-[#B2E560] text-[#101713] text-xs font-bold font-mono transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyRound size={14} />
              <span>{apiLoading ? 'Authenticating with Express Gateway...' : 'Authenticate & Sync Live Database'}</span>
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-[#35473A]">
          <div className="text-[11px] font-mono text-[#8EA490] mb-2 flex items-center gap-1.5">
            <Shield size={12} className="text-[#C4F279]" />
            <span>Quick Select Verified Demo Account:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
            {DEMO_CREDENTIALS.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => handleSelectDemo(demo)}
                className={`text-left p-2 border text-xs font-mono transition-colors ${
                  email === demo.email
                    ? 'border-[#C4F279] bg-[#222F25] text-[#C4F279]'
                    : 'border-[#35473A] bg-[#1A241D] hover:bg-[#202D24] text-[#B8CBB9]'
                }`}
              >
                <div className="font-bold truncate text-[#E6EFE5]">{demo.name}</div>
                <div className="text-[10px] text-[#8EA490] truncate">{demo.email}</div>
                <div className="text-[9px] text-[#C4F279]">{demo.role} • {demo.bureau}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
