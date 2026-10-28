import { useState } from 'react';
import { Network } from 'lucide-react';
import { login, AuthUser } from '../services/authApi';

const DEMO_EMAILS = [
  { label: 'Central Administrator (SUPER_ADMIN)', email: 'admin@aicte.gov.in' },
  { label: 'Bureau Head (SDC - Student Development)', email: 'sdc.head@aicte.gov.in' },
  { label: 'Bureau Officer (SDC)', email: 'sdc.officer@aicte.gov.in' },
  { label: 'Bureau Officer (GRC - Grievances)', email: 'grc.officer@aicte.gov.in' },
  { label: 'Grievance Redressal Officer (GRC)', email: 'grievance.officer@aicte.gov.in' },
  { label: 'Bureau Officer (QAC - Quality Assurance)', email: 'qac.officer@aicte.gov.in' },
  { label: 'Compliance Auditor (Read-Only)', email: 'auditor@aicte.gov.in' },
];

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      setPassword('');
      onLoginSuccess(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F5] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="flex h-10 w-10 items-center justify-center border border-[#FF69B4]/50 bg-[#FF69B4]/10">
            <Network size={21} className="text-[#FF69B4]" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide">
              AICTE <span className="text-[#FF69B4]">/</span> IICMD
            </p>
            <p className="mt-0.5 text-[10px] tracking-[0.2em] text-[#B5B5B5]">CASE MONITORING SYSTEM</p>
          </div>
        </div>

        <div className="border border-[#292929] bg-[#050505] p-8">
          <header className="mb-8">
            <p className="text-[10px] tracking-[0.2em] text-[#FF8BCB] font-medium mb-2">
              ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Official Portal Sign-In</h2>
            <p className="mt-2 text-sm text-[#A8A8A8]">
              Complaint Monitoring &amp; Intelligent Resolution Dashboard
            </p>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-6 border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs tracking-wider text-[#A8A8A8]">
                OFFICIAL EMAIL ADDRESS
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="e.g. officer@aicte.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-[#111] border border-[#292929] px-3 py-2.5 text-sm text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#FF69B4]/60 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs tracking-wider text-[#A8A8A8]">
                PASSWORD
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="w-full bg-[#111] border border-[#292929] px-3 py-2.5 text-sm text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#FF69B4]/60 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C4F279] text-black py-3 text-sm font-semibold tracking-wide hover:bg-[#D5FFA0] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          {/* Demo helper */}
          <details className="mt-6 border border-[#292929] group">
            <summary className="cursor-pointer px-4 py-3 text-xs text-[#888] tracking-wide select-none hover:text-[#B5B5B5]">
              LOCAL DEMO ACCOUNT HELPER (DEVELOPMENT)
            </summary>
            <div className="px-4 pb-4 pt-2">
              <p className="text-xs text-[#666] mb-3">
                Select a synthetic demo account to populate its email. Enter the locally configured password to test role scoping.
              </p>
              <div className="space-y-2">
                {DEMO_EMAILS.map((item) => (
                  <button
                    key={item.email}
                    type="button"
                    onClick={() => {
                      setEmail(item.email);
                      setPassword('');
                      setError('');
                    }}
                    className="w-full text-left border border-[#292929] bg-[#0a0a0a] px-3 py-2 hover:border-[#FF69B4]/40 transition"
                  >
                    <p className="text-xs font-medium text-[#E5E5E5]">{item.label}</p>
                    <p className="text-[11px] font-mono text-[#888] mt-0.5">{item.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </details>

          <footer className="mt-6 text-center">
            <p className="text-[10px] text-[#555]">Restricted Official Access · Prototype Verification Environment</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
