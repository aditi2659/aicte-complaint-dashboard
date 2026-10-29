
import React, { useState } from 'react';
import { useComplaints } from '../context/ComplaintContext';
import { SYSTEM_USERS } from '../data/mockData';
import { BureauBadge } from '../components/common/Badge';
import {
  ShieldCheck,
  Users,
  History,
  KeyRound,
  Lock,
  AlertCircle,
  FileCheck2,
  Database,
  ChevronRight,
  Activity,
  Clock3,
  Fingerprint,
  UserPlus,
  Copy,
  Check,
  X
} from 'lucide-react';
import { adminCreateUser, adminGenerateSetupToken } from '../services/authApi';

export const AdminPage: React.FC = () => {
  const { auditLogs, currentUser } = useComplaints();
  const [activeTab, setActiveTab] = useState<
    'audit' | 'roles' | 'integrations'
  >('audit');
  const [tokenModal, setTokenModal] = useState<{ email: string; token: string; expiresAt: string } | null>(null);
  const [provisionModal, setProvisionModal] = useState(false);
  const [provForm, setProvForm] = useState({ email: '', fullName: '', role: 'BUREAU_OFFICER', bureau: 'Student Development Cell' });
  const [provLoading, setProvLoading] = useState(false);
  const [provError, setProvError] = useState('');
  const [tokenLoading, setTokenLoading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateToken = async (email: string) => {
    setTokenLoading(email);
    try {
      const res = await adminGenerateSetupToken(email);
      setTokenModal({ email: res.email, token: res.setupToken, expiresAt: res.expiresAt });
      setCopied(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setTokenLoading(null);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvLoading(true);
    setProvError('');
    try {
      const res = await adminCreateUser({
        email: provForm.email,
        fullName: provForm.fullName,
        role: provForm.role,
        bureau: provForm.bureau
      });
      setProvisionModal(false);
      setTokenModal({ email: res.user.email, token: res.setupToken, expiresAt: res.expiresAt });
      setCopied(false);
      setProvForm({ email: '', fullName: '', role: 'BUREAU_OFFICER', bureau: 'Student Development Cell' });
    } catch (err: unknown) {
      setProvError(err instanceof Error ? err.message : 'Failed to provision official');
    } finally {
      setProvLoading(false);
    }
  };

  const tabs = [
    { id: 'audit' as const, label: 'Audit Trail', icon: History },
    { id: 'roles' as const, label: 'Role Matrix', icon: Users },
    { id: 'integrations' as const, label: 'Infrastructure', icon: KeyRound },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12 text-[#E6EFE5]">

      {/* Page heading */}
      <header className="flex flex-col justify-between gap-5 border-b border-[#35473A]/70 pb-6 sm:flex-row sm:items-center">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-[#8CB994]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C4F279]" />
            System Governance
            <ChevronRight size={12} />
            Administration
          </div>

          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            Administration, Roles & Audit Trails
            <span className="h-2 w-2 rounded-sm bg-[#C4F279]" />
          </h2>

          <p className="max-w-2xl text-xs leading-5 text-[#A6B7A8]">
            Manage access permissions, review regulatory activity, and inspect
            infrastructure integration specifications.
          </p>
        </div>

        <div className="flex w-fit items-center gap-3 rounded-lg border border-[#536D3B]/60 bg-[#182119] px-3.5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#C4F279]/20 bg-[#C4F279]/10">
            <ShieldCheck size={18} className="text-[#C4F279]" />
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-[#8CB994]">
              Active persona
            </p>
            <p className="mt-1 text-xs font-semibold">
              {currentUser.role.replace(/_/g, ' ')}
            </p>
            <p className="text-[10px] text-[#A6B7A8]">
              Bureau: {currentUser.bureau}
            </p>
          </div>
          <span className="ml-2 h-2 w-2 rounded-full bg-[#C4F279] shadow-[0_0_8px_#C4F27955]" />
        </div>
      </header>

      {/* Section navigation */}
      <nav className="flex flex-wrap gap-2" aria-label="Administration sections">
        {tabs.map(({ id, label, icon: Icon }) => {
          const selected = activeTab === id;

          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-pressed={selected}
              className={`group relative flex items-center gap-2.5 rounded-md border px-4 py-3 text-xs transition-all duration-200 ${
                selected
                  ? 'border-[#536D3B] bg-[#202D23] text-[#E6EFE5] shadow-sm'
                  : 'border-[#26362A] bg-[#101612] text-[#A6B7A8] hover:border-[#536D3B] hover:bg-[#182119] hover:text-[#E6EFE5]'
              }`}
            >
              <Icon
                size={15}
                className={
                  selected
                    ? 'text-[#C4F279]'
                    : 'text-[#8CB994] group-hover:text-[#C4F279]'
                }
              />
              <span className={selected ? 'font-semibold' : 'font-medium'}>
                {label}
              </span>

              {selected && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#C4F279]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Audit trail */}
      {activeTab === 'audit' && (
        <section className="overflow-hidden rounded-lg border border-[#6B3D56]/70 bg-[#100F11] shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
          <div className="flex flex-col justify-between gap-4 border-b border-[#35473A]/70 bg-[#FF69B4]/10 px-5 py-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3 ">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#FF8BCB]/20 bg-[#FF8BCB]/12">
                <History size={19} className="text-[#FF8BCB]" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-wide">
                  Regulatory Action Audit Trail
                </h3>
                <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#A6B7A8]">
                  Chronological records of case activity, status changes,
                  bureau transfers, and overlap adjudications.
                </p>
              </div>
            </div>

            <div className="flex w-fit items-center gap-2 rounded-md border border-[#35473A] bg-[#101612] px-3 py-2">
              <Activity size={13} className="text-[#C4F279]" />
              <span className="text-[10px] font-mono text-[#C4F279]">
                {auditLogs.length} RECORDS
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#26362A] px-5 py-3 text-[10px] text-[#8CB994]">
            <span className="flex items-center gap-1.5">
              <Fingerprint size={13} />
              IMMUTABLE ACTIVITY LOG
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 size={13} />
              TIMESTAMPS IN UTC
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#35473A] bg-[#1C251F] text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                  <th className="px-4 py-4 font-medium">Timestamp (UTC)</th>
                  <th className="px-4 py-4 font-medium">Officer & Bureau</th>
                  <th className="px-4 py-4 font-medium">Action Event</th>
                  <th className="px-4 py-4 font-medium">Entity Target</th>
                  <th className="px-4 py-4 font-medium">Event Narrative</th>
                  <th className="px-4 py-4 font-medium">Client IP</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#26362A]/80">
                {auditLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors duration-150 hover:bg-[#C4F279]/[0.035]"
                  >
                    <td className="whitespace-nowrap px-4 py-4 font-mono text-[10px] text-[#A6B7A8]">
                      {log.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4">
                      <p className="text-xs font-semibold text-[#E6EFE5]">
                        {log.user}
                      </p>
                      <p className="mt-1 text-[10px] text-[#8B9A8D]">
                        {log.role}
                      </p>
                      <span className="mt-1 inline-block text-[10px] font-mono text-[#C4F279]">
                        {log.bureau}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex whitespace-nowrap rounded border border-[#536D3B]/60 bg-[#222F25] px-2 py-1 text-[9px] font-mono font-semibold tracking-wide text-[#C4F279]">
                        {log.action}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-mono text-[10px] font-semibold text-[#C4F279]">
                      {log.entityId}
                    </td>

                    <td className="max-w-[360px] px-4 py-4 text-[11px] leading-5 text-[#D0D9D0]">
                      {log.details}
                    </td>

                    <td className="whitespace-nowrap px-4 py-4 font-mono text-[10px] text-[#829084]">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}

                {auditLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-xs text-[#8B9A8D]"
                    >
                      No audit records available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#35473A]/70 bg-[#FF8BCB]/12 px-5 py-3">
            <span className="text-[10px] text-[#829084]">
              Regulatory activity records
            </span>
            <span className="font-mono text-[10px] text-[#8CB994]">
              {auditLogs.length} TOTAL ENTRIES
            </span>
          </div>
        </section>
      )}

      {/* Role matrix */}
      {activeTab === 'roles' && (
        <section className="overflow-hidden rounded-lg border border-[#35473A] bg-[#111713]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#35473A] px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#C4F279]/20 bg-[#C4F279]/[0.07]">
                <Users size={19} className="text-[#C4F279]" />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  Role-Based Access Control & User Provisioning
                </h3>
                <p className="mt-1 text-[11px] text-[#A6B7A8]">
                  Configured official profiles, permission allocations, and activation credentials.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setProvisionModal(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[#C4F279]/40 bg-[#C4F279]/10 px-3.5 py-2 text-xs font-semibold text-[#C4F279] transition hover:bg-[#C4F279]/20"
            >
              <UserPlus size={15} />
              <span>Invite Authorized Official</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
            {SYSTEM_USERS.map((u) => (
              <article
                key={u.id}
                className="rounded-lg border border-[#35473A] bg-[#182119] p-5 transition-colors hover:border-[#536D3B]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold">{u.name}</h4>
                    <p className="mt-1 break-all text-[11px] text-[#8B9A8D]">
                      {u.email}
                    </p>
                  </div>
                  <BureauBadge bureau={u.bureau} />
                </div>

                <div className="mt-4 rounded-md border border-[#35473A]/80 bg-[#101612] px-3 py-2.5">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-[#8B9A8D]">
                    Assigned role
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#C4F279]">
                    {u.role.replace(/_/g, ' ')}
                  </p>
                </div>

                <div className="mt-4 border-t border-[#35473A] pt-4">
                  <p className="mb-3 text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                    Granted Permissions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {u.permissions.map((permission, idx) => (
                      <span
                        key={`${u.id}-${idx}`}
                        className="rounded border border-[#35473A] bg-[#101612] px-2.5 py-1.5 text-[10px] text-[#B9C8BA]"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-[#35473A]/70 pt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleGenerateToken(u.email)}
                    disabled={tokenLoading === u.email}
                    className="inline-flex items-center gap-1.5 rounded border border-[#536D3B]/70 bg-[#101612] px-3 py-1.5 text-[11px] font-medium text-[#C4F279] transition hover:bg-[#1C281E] disabled:opacity-50"
                  >
                    <KeyRound size={13} />
                    <span>{tokenLoading === u.email ? 'Generating...' : 'Generate Activation Token'}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Infrastructure */}
      {activeTab === 'integrations' && (
        <section className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-[#6B3D56]/60 bg-[#1B1319] p-5">
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0 text-[#FF8BCB]"
            />
            <div>
              <h3 className="text-sm font-semibold">
                Production Roadmap
              </h3>
              <p className="mt-1 max-w-3xl text-[11px] leading-5 text-[#A6B7A8]">
                Proposed architectural integration points for live AICTE
                enterprise services, including identity, digital signing,
                and government cloud infrastructure.
              </p>
            </div>
            <span className="ml-auto hidden whitespace-nowrap rounded border border-[#FF8BCB]/20 bg-[#FF8BCB]/[0.06] px-2 py-1 text-[9px] font-mono text-[#FF8BCB] sm:block">
              PLANNED
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                title: 'Jan Parichay SSO Integration',
                icon: Lock,
                description:
                  'Government single sign-on using SAML 2.0 / OAuth2 with multi-factor authentication for AICTE officials.',
                tags: ['SAML 2.0', 'OAuth2', 'MFA'],
              },
              {
                title: 'e-Sign & DigiLocker Vault',
                icon: FileCheck2,
                description:
                  'Proposed digital signing for show-cause notices and delivery to institutional DigiLocker repositories.',
                tags: ['e-Sign', 'DigiLocker'],
              },
              {
                title: 'NIC PostgreSQL Connector',
                icon: Database,
                description:
                  'Proposed integration with the central AICTE database through a secure replication and telemetry pipeline.',
                tags: ['PostgreSQL', 'NIC', 'Replication'],
              },
            ].map(({ title, icon: Icon, description, tags }) => (
              <article
                key={title}
                className="group rounded-lg border border-[#35473A] bg-[#141B16] p-5 transition-all duration-200 hover:border-[#536D3B] hover:bg-[#182119]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#35473A] bg-[#202D23]">
                    <Icon size={18} className="text-[#C4F279]" />
                  </div>
                  <span className="rounded border border-[#536D3B]/50 bg-[#C4F279]/[0.05] px-2 py-1 text-[9px] font-mono text-[#A6B7A8]">
                    PLANNED
                  </span>
                </div>

                <h4 className="mt-5 text-sm font-semibold leading-5">
                  {title}
                </h4>
                <p className="mt-2 min-h-[76px] text-[11px] leading-5 text-[#A6B7A8]">
                  {description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#35473A]/80 pt-4">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-[#35473A] bg-[#101612] px-2 py-1 text-[9px] font-mono text-[#8CB994]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Token Display Modal */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-[#536D3B] bg-[#111713] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#C4F279]">
                <KeyRound size={16} />
                Activation Token Generated
              </div>
              <button
                type="button"
                onClick={() => setTokenModal(null)}
                className="text-[#888] hover:text-[#FFF]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8B9A8D]">Target Official</p>
                <p className="font-mono text-xs text-[#E6EFE5]">{tokenModal.email}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8B9A8D]">One-Time Activation Token</p>
                <div className="mt-1 flex items-center gap-2 rounded border border-[#35473A] bg-[#0A0E0B] p-2.5">
                  <input
                    type="text"
                    readOnly
                    value={tokenModal.token}
                    className="w-full bg-transparent font-mono text-xs text-[#C4F279] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tokenModal.token);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="shrink-0 rounded border border-[#536D3B]/70 bg-[#1E2B20] px-2.5 py-1 text-[11px] font-semibold text-[#C4F279] hover:bg-[#283B2B]"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#8B9A8D]">Token Expiration</p>
                <p className="font-mono text-[11px] text-[#A6B7A8]">{new Date(tokenModal.expiresAt).toLocaleString()}</p>
              </div>

              <p className="rounded border border-[#536D3B]/40 bg-[#182119] p-3 text-[11px] leading-relaxed text-[#A6B7A8]">
                Provide this activation token to the official. They can enter it under <strong>SET PASSWORD</strong> on the portal login page to establish their personal credentials.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setTokenModal(null)}
                className="rounded bg-[#C4F279] px-4 py-2 text-xs font-semibold text-black hover:bg-[#D5FFA0]"
              >
                Close &amp; Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provision Official Modal */}
      {provisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-[#536D3B] bg-[#111713] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#C4F279]">
                <UserPlus size={16} />
                Invite Authorized Official
              </div>
              <button
                type="button"
                onClick={() => setProvisionModal(false)}
                className="text-[#888] hover:text-[#FFF]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="mt-5 space-y-4">
              {provError && (
                <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  {provError}
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={provForm.fullName}
                  onChange={(e) => setProvForm({ ...provForm, fullName: e.target.value })}
                  className="mt-1 w-full rounded border border-[#35473A] bg-[#182119] px-3 py-2 text-xs text-[#E6EFE5] placeholder-[#666] focus:border-[#C4F279] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. r.sharma@aicte.gov.in"
                  value={provForm.email}
                  onChange={(e) => setProvForm({ ...provForm, email: e.target.value })}
                  className="mt-1 w-full rounded border border-[#35473A] bg-[#182119] px-3 py-2 text-xs text-[#E6EFE5] placeholder-[#666] focus:border-[#C4F279] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                    Role
                  </label>
                  <select
                    value={provForm.role}
                    onChange={(e) => setProvForm({ ...provForm, role: e.target.value })}
                    className="mt-1 w-full rounded border border-[#35473A] bg-[#182119] px-3 py-2 text-xs text-[#E6EFE5] focus:border-[#C4F279] focus:outline-none"
                  >
                    <option value="BUREAU_OFFICER">BUREAU_OFFICER</option>
                    <option value="BUREAU_HEAD">BUREAU_HEAD</option>
                    <option value="GRIEVANCE_OFFICER">GRIEVANCE_OFFICER</option>
                    <option value="AUDITOR">AUDITOR</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A6B7A8]">
                    Bureau Assignment
                  </label>
                  <select
                    value={provForm.bureau}
                    onChange={(e) => setProvForm({ ...provForm, bureau: e.target.value })}
                    className="mt-1 w-full rounded border border-[#35473A] bg-[#182119] px-3 py-2 text-xs text-[#E6EFE5] focus:border-[#C4F279] focus:outline-none"
                  >
                    <option value="Student Development Cell">Student Development Cell</option>
                    <option value="Grievance Redressal Cell">Grievance Redressal Cell</option>
                    <option value="Quality Assurance Cell">Quality Assurance Cell</option>
                    <option value="">None (Auditor / Central Admin)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-[#35473A] pt-4">
                <button
                  type="button"
                  onClick={() => setProvisionModal(false)}
                  className="rounded border border-[#35473A] px-4 py-2 text-xs text-[#A6B7A8] hover:bg-[#182119]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provLoading}
                  className="rounded bg-[#C4F279] px-4 py-2 text-xs font-semibold text-black hover:bg-[#D5FFA0] disabled:opacity-50"
                >
                  {provLoading ? 'Provisioning...' : 'Provision & Generate Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
