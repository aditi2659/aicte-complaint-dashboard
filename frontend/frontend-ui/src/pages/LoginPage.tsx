import { useState } from 'react';
import { Network, KeyRound, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';
import { login, setupPassword, requestSetupToken, AuthUser } from '../services/authApi';

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
  const [mode, setMode] = useState<'login' | 'setup' | 'request'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
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

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !setupToken.trim() || !password) {
      setError('Email, setup token, and new password are all required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const user = await setupPassword(email.trim(), setupToken.trim(), password);
      setPassword('');
      setConfirmPassword('');
      setSetupToken('');
      setSuccessMsg('Password configured successfully! Signing in...');
      setTimeout(() => {
        onLoginSuccess(user);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password setup failed. Please verify your activation token.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your official email address.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await requestSetupToken(email.trim());
      setSuccessMsg(res.message);
      if (res.setupToken) {
        setSetupToken(res.setupToken);
        setMode('setup');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to request setup instructions.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F5F5] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
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

        <div className="border border-[#292929] bg-[#050505] p-8 shadow-2xl">
          <header className="mb-6">
            <p className="text-[10px] tracking-[0.2em] text-[#FF8BCB] font-medium mb-2">
              ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === 'login' && 'Official Portal Sign-In'}
              {mode === 'setup' && 'Create Account Password'}
              {mode === 'request' && 'Request Activation Token'}
            </h2>
            <p className="mt-1 text-xs text-[#A8A8A8]">
              {mode === 'login' && 'Authorized personnel sign in with official credentials.'}
              {mode === 'setup' && 'First-time login or password setup for authorized officials.'}
              {mode === 'request' && 'Dispatch activation token for your authorized email.'}
            </p>
          </header>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 mb-6 border border-[#222] p-1 bg-[#111]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-semibold tracking-wider transition ${
                mode === 'login'
                  ? 'bg-[#222] text-[#C4F279] shadow-sm'
                  : 'text-[#888] hover:text-[#CCC]'
              }`}
            >
              SIGN IN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('setup');
                setError('');
                setSuccessMsg('');
              }}
              className={`py-2 text-xs font-semibold tracking-wider transition ${
                mode === 'setup'
                  ? 'bg-[#222] text-[#C4F279] shadow-sm'
                  : 'text-[#888] hover:text-[#CCC]'
              }`}
            >
              SET PASSWORD
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-6 border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300 leading-relaxed"
            >
              {error}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="mb-6 flex items-center gap-2 border border-[#C4F279]/40 bg-[#C4F279]/10 px-4 py-3 text-xs text-[#C4F279]"
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Mode Form */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs tracking-wider text-[#A8A8A8]">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('setup');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-[#FF8BCB] hover:underline"
                  >
                    First time or forgot?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your personal password"
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
                className="w-full bg-[#C4F279] text-black py-3 text-sm font-semibold tracking-wide hover:bg-[#D5FFA0] transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
              </button>
            </form>
          )}

          {/* Setup Password Mode Form */}
          {mode === 'setup' && (
            <form onSubmit={handleSetupSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="setup-email" className="text-xs tracking-wider text-[#A8A8A8]">
                  AUTHORIZED OFFICIAL EMAIL
                </label>
                <input
                  id="setup-email"
                  type="email"
                  autoComplete="username"
                  placeholder="e.g. admin@aicte.gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-[#111] border border-[#292929] px-3 py-2.5 text-sm text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#FF69B4]/60 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="setup-token" className="text-xs tracking-wider text-[#A8A8A8]">
                    ACTIVATION / SETUP TOKEN
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('request');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-[#C4F279] hover:underline"
                  >
                    Need a token?
                  </button>
                </div>
                <input
                  id="setup-token"
                  type="text"
                  placeholder="Paste one-time token or bootstrap key"
                  value={setupToken}
                  onChange={(e) => setSetupToken(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-[#111] border border-[#292929] px-3 py-2.5 text-sm font-mono text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#FF69B4]/60 disabled:opacity-50"
                />
                <p className="text-[10px] text-[#777]">
                  Provided by your administrator or environment bootstrap configuration.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="new-password" className="text-xs tracking-wider text-[#A8A8A8]">
                  NEW PASSWORD
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters (letters, numbers/symbols)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-[#111] border border-[#292929] px-3 py-2.5 text-sm text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#FF69B4]/60 disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm-password" className="text-xs tracking-wider text-[#A8A8A8]">
                  CONFIRM NEW PASSWORD
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="w-full bg-[#111] border border-[#292929] px-3 py-2.5 text-sm text-[#F5F5F5] placeholder-[#555] focus:outline-none focus:border-[#FF69B4]/60 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#C4F279] text-black py-3 text-sm font-semibold tracking-wide hover:bg-[#D5FFA0] transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'Establishing Credentials...' : 'Save Password & Sign In'}
              </button>
            </form>
          )}

          {/* Request Token Mode */}
          {mode === 'request' && (
            <form onSubmit={handleRequestToken} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="request-email" className="text-xs tracking-wider text-[#A8A8A8]">
                  AUTHORIZED OFFICIAL EMAIL
                </label>
                <input
                  id="request-email"
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

              <p className="text-xs text-[#888] leading-relaxed">
                If an authorized official account exists under this email address, an activation token will be generated or dispatched.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('setup')}
                  className="w-1/3 border border-[#333] text-[#AAA] py-2.5 text-xs font-semibold hover:border-[#555] transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 bg-[#FF69B4] text-black py-2.5 text-xs font-semibold tracking-wide hover:bg-[#FF85C0] transition disabled:opacity-50"
                >
                  {loading ? 'Requesting...' : 'Generate Activation Token'}
                </button>
              </div>
            </form>
          )}

          {/* Demo helper */}
          <details className="mt-6 border border-[#292929] group">
            <summary className="cursor-pointer px-4 py-3 text-xs text-[#888] tracking-wide select-none hover:text-[#B5B5B5] flex items-center justify-between">
              <span>AUTHORIZED OFFICIAL ACCOUNTS (AICTE ROSTER)</span>
              <ShieldCheck size={14} className="text-[#888]" />
            </summary>
            <div className="px-4 pb-4 pt-2">
              <p className="text-xs text-[#666] mb-3 leading-relaxed">
                Click any official persona below to populate the email. Use <strong>SET PASSWORD</strong> to establish your own password with your activation token or bootstrap key.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {DEMO_EMAILS.map((item) => (
                  <button
                    key={item.email}
                    type="button"
                    onClick={() => {
                      setEmail(item.email);
                      setError('');
                    }}
                    className="w-full text-left border border-[#222] bg-[#0a0a0a] px-3 py-2 hover:border-[#FF69B4]/40 transition group-focus:outline-none"
                  >
                    <p className="text-xs font-medium text-[#E5E5E5]">{item.label}</p>
                    <p className="text-[11px] font-mono text-[#888] mt-0.5">{item.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </details>

          <footer className="mt-6 text-center">
            <p className="text-[10px] text-[#555]">Restricted Official Access · Secure Multi-Bureau Architecture</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
