import { LogOut, Shield, Eye, Building2, User } from "lucide-react";

export default function Topbar({ user, healthStatus, onLogout }) {
  if (!user) return null;

  const isAuditor = user.role === "AUDITOR";
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  // Role display badge formatting
  const getRoleBadge = () => {
    switch (user.role) {
      case "SUPER_ADMIN":
        return { label: "Central Administrator", className: "badge-superadmin" };
      case "BUREAU_HEAD":
        return { label: "Bureau Head", className: "badge-head" };
      case "BUREAU_OFFICER":
        return { label: "Bureau Officer", className: "badge-officer" };
      case "GRIEVANCE_OFFICER":
        return { label: "Grievance Officer", className: "badge-grievance" };
      case "AUDITOR":
        return { label: "Compliance Auditor (Read-Only)", className: "badge-auditor" };
      default:
        return { label: user.role, className: "badge-default" };
    }
  };

  const roleBadge = getRoleBadge();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <p className="eyebrow">AICTE · CENTRAL COMPLAINT MONITORING SYSTEM</p>
        <h1>Complaint Monitoring Dashboard</h1>
        <div className="scope-indicator">
          {isSuperAdmin && (
            <span className="scope-pill global">
              <Shield size={14} /> System-Wide Administrative Scope
            </span>
          )}
          {user.bureau && (
            <span className="scope-pill bureau">
              <Building2 size={14} /> {user.bureau} Scope
            </span>
          )}
          {isAuditor && (
            <span className="scope-pill readonly">
              <Eye size={14} /> Read-Only Compliance Audit Mode (Mutations Restricted)
            </span>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        <div className="user-profile-card">
          <div className="user-avatar">
            <User size={18} />
          </div>
          <div className="user-info">
            <span className="user-name">{user.full_name}</span>
            <div className="user-badges">
              <span className={`role-badge ${roleBadge.className}`}>{roleBadge.label}</span>
              <span className="health-badge" title="API Connectivity Status">{healthStatus}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="btn-logout"
          title="Sign out of your session"
          aria-label="Sign out"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
