import { useEffect, useState } from "react";
import {
  getCurrentUser,
  getStoredToken,
  clearSession,
  setUnauthorizedHandler,
  checkHealth
} from "./services/api.js";
import LoginView from "./components/LoginView.jsx";
import Topbar from "./components/Topbar.jsx";
import MetricsOverview from "./components/MetricsOverview.jsx";
import OverlapsFeed from "./components/OverlapsFeed.jsx";
import ComplaintsTable from "./components/ComplaintsTable.jsx";
import InstitutionsTable from "./components/InstitutionsTable.jsx";
import { BarChart3, FileText, Landmark } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "complaints" | "institutions"
  const [health, setHealth] = useState("Checking API…");

  // Validate existing session on application startup
  useEffect(() => {
    // Register 401 interceptor
    setUnauthorizedHandler(() => {
      setUser(null);
    });

    // Check backend health
    checkHealth()
      .then((data) => setHealth(data.message || "API Connected"))
      .catch(() => setHealth("Backend Offline"));

    // Check stored token
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    getCurrentUser()
      .then((userData) => {
        if (userData) {
          setUser(userData);
        } else {
          clearSession();
        }
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setActiveTab("overview");
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
  };

  if (authChecking) {
    return (
      <div className="app-splash">
        <div className="spinner" />
        <p>Initializing secure AICTE dashboard session...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      <main className="page">
        <Topbar
          user={user}
          healthStatus={health}
          onLogout={handleLogout}
        />

        {/* State-Based Tab Navigation */}
        <nav className="tab-nav" aria-label="Dashboard Navigation">
          <button
            type="button"
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <BarChart3 size={16} />
            <span>Overview & AI Overlaps</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "complaints" ? "active" : ""}`}
            onClick={() => setActiveTab("complaints")}
          >
            <FileText size={16} />
            <span>All Complaints</span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === "institutions" ? "active" : ""}`}
            onClick={() => setActiveTab("institutions")}
          >
            <Landmark size={16} />
            <span>Institutions</span>
          </button>
        </nav>

        {/* Active Tab View */}
        <div className="tab-content">
          {activeTab === "overview" && (
            <>
              <MetricsOverview user={user} />
              <OverlapsFeed user={user} />
            </>
          )}

          {activeTab === "complaints" && (
            <ComplaintsTable user={user} />
          )}

          {activeTab === "institutions" && (
            <InstitutionsTable />
          )}
        </div>

        <footer>
          All India Council for Technical Education · Official Internal Grievance Monitoring System · Synthetic Verification Dataset
        </footer>
      </main>
    </div>
  );
}
