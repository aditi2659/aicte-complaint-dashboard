import { useState } from "react";
import { login } from "../services/api.js";

// List of demo email addresses for local development assistance (emails only, zero passwords)
const DEMO_EMAILS = [
  { label: "Central Administrator (SUPER_ADMIN)", email: "admin@aicte.gov.in" },
  { label: "Bureau Head (SDC - Student Development)", email: "sdc.head@aicte.gov.in" },
  { label: "Bureau Officer (SDC)", email: "sdc.officer@aicte.gov.in" },
  { label: "Bureau Officer (GRC - Grievances)", email: "grc.officer@aicte.gov.in" },
  { label: "Grievance Redressal Officer (GRC)", email: "grievance.officer@aicte.gov.in" },
  { label: "Bureau Officer (QAC - Quality Assurance)", email: "qac.officer@aicte.gov.in" },
  { label: "Compliance Auditor (Read-Only)", email: "auditor@aicte.gov.in" }
];

export default function LoginView({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const authData = await login(email.trim(), password);
      // Immediately clear sensitive password from component state
      setPassword("");
      if (typeof onLoginSuccess === "function") {
        onLoginSuccess(authData.user);
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemoEmail = (demoEmail) => {
    setEmail(demoEmail);
    // Explicitly reset password field so no assumptions are made
    setPassword("");
    setError("");
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <header className="login-header">
          <p className="eyebrow">ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</p>
          <h2>Official Portal Sign-In</h2>
          <p className="subtitle">Complaint Monitoring & Intelligent Resolution Dashboard</p>
        </header>

        {error && (
          <div className="login-alert error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Official Email Address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="e.g. officer@aicte.gov.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Authenticating..." : "Sign In to Dashboard"}
          </button>
        </form>

        {/* Collapsed Development Assistance Section (Strictly emails only, never passwords) */}
        <details className="dev-assist-dropdown">
          <summary>Local Demo Account Helper (Development)</summary>
          <p className="dev-assist-note">
            Select a synthetic demo account to populate its email address. Enter the locally configured password to test role scoping.
          </p>
          <div className="demo-email-buttons">
            {DEMO_EMAILS.map((item) => (
              <button
                key={item.email}
                type="button"
                className="btn-demo-select"
                onClick={() => handleSelectDemoEmail(item.email)}
              >
                <strong>{item.label}</strong>
                <code>{item.email}</code>
              </button>
            ))}
          </div>
        </details>

        <footer className="login-footer">
          <p>Restricted Official Access · Prototype Verification Environment</p>
        </footer>
      </div>
    </div>
  );
}
