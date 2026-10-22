import { useEffect, useState } from "react";
import { getDashboardSummary } from "../services/api.js";
import { AlertCircle, CheckCircle2, Clock, Layers, TrendingUp } from "lucide-react";

export default function MetricsOverview({ user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    getDashboardSummary()
      .then((data) => {
        if (isMounted) {
          setSummary(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load dashboard summary metrics.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="metrics-loading">
        <p>Loading dashboard metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notice error">
        <p>{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  const {
    total_complaints = 0,
    by_status = {},
    by_bureau = {},
    by_priority = {},
    escalated_complaints = 0,
    overlaps = {}
  } = summary;

  const pending_overlaps = overlaps?.suggested ?? overlaps?.total ?? 0;

  return (
    <div className="metrics-container">
      {/* Primary KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card total">
          <div className="kpi-icon">
            <Layers size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Total Assigned Cases</span>
            <span className="kpi-value">{total_complaints}</span>
            <span className="kpi-subtext">
              {user.role === "SUPER_ADMIN" || user.role === "AUDITOR"
                ? "System-wide count across all bureaus"
                : `Scoped to ${user.bureau}`}
            </span>
          </div>
        </div>

        <div className="kpi-card pending">
          <div className="kpi-icon">
            <Clock size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Under Active Review</span>
            <span className="kpi-value">{by_status["Under Review"] || 0}</span>
            <span className="kpi-subtext">Requires official attention</span>
          </div>
        </div>

        <div className="kpi-card overlaps">
          <div className="kpi-icon">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Flagged Overlaps</span>
            <span className="kpi-value">{pending_overlaps}</span>
            <span className="kpi-subtext">Potential cross-case links</span>
          </div>
        </div>

        <div className="kpi-card escalated">
          <div className="kpi-icon">
            <AlertCircle size={22} />
          </div>
          <div className="kpi-body">
            <span className="kpi-label">Escalated Grievances</span>
            <span className="kpi-value">{escalated_count}</span>
            <span className="kpi-subtext">SLA breach alerts</span>
          </div>
        </div>
      </div>

      {/* Distribution Grids */}
      <div className="distribution-row">
        {/* Status Breakdown */}
        <div className="stat-card">
          <h3>Breakdown by Status</h3>
          <div className="bar-list">
            {Object.entries(by_status).map(([status, count]) => (
              <div key={status} className="bar-item">
                <div className="bar-labels">
                  <span className="bar-name">{status}</span>
                  <span className="bar-count">{count}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: total_complaints > 0 ? `${(count / total_complaints) * 100}%` : "0%"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="stat-card">
          <h3>Breakdown by Priority</h3>
          <div className="bar-list">
            {Object.entries(by_priority).map(([priority, count]) => (
              <div key={priority} className="bar-item">
                <div className="bar-labels">
                  <span className={`priority-tag ${priority.toLowerCase()}`}>{priority}</span>
                  <span className="bar-count">{count}</span>
                </div>
                <div className="bar-track">
                  <div
                    className={`bar-fill priority-${priority.toLowerCase()}`}
                    style={{
                      width: total_complaints > 0 ? `${(count / total_complaints) * 100}%` : "0%"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bureau Distribution (if multi-bureau or for context) */}
        {Object.keys(by_bureau).length > 0 && (
          <div className="stat-card">
            <h3>Bureau Distribution</h3>
            <div className="bar-list">
              {Object.entries(by_bureau).map(([bureauName, count]) => (
                <div key={bureauName} className="bar-item">
                  <div className="bar-labels">
                    <span className="bar-name">{bureauName}</span>
                    <span className="bar-count">{count}</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill bureau-bar"
                      style={{
                        width: total_complaints > 0 ? `${(count / total_complaints) * 100}%` : "0%"
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
