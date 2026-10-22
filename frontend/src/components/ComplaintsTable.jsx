import { useEffect, useState } from "react";
import { getComplaints } from "../services/api.js";
import { Filter, AlertTriangle } from "lucide-react";

export default function ComplaintsTable({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const fetchComplaints = () => {
    setLoading(true);
    setError("");

    getComplaints({
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
      limit: 50
    })
      .then((res) => {
        setComplaints(res.complaints || []);
        setMeta(res.meta || { total: 0 });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load complaints.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, priorityFilter, user]);

  return (
    <div className="table-view-section">
      <div className="section-header">
        <div>
          <h2>Official Complaint Registry</h2>
          <p className="subtitle">
            {user.role === "SUPER_ADMIN" || user.role === "AUDITOR"
              ? "All central complaints across technical institutions"
              : `Complaints assigned to ${user.bureau}`}
          </p>
        </div>

        <div className="filter-controls">
          <div className="select-wrapper">
            <Filter size={14} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Under Review">Under Review</option>
              <option value="Assigned">Assigned</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="select-wrapper">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter by Priority"
            >
              <option value="">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice error">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="empty">
          <p>Loading complaints from database...</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty">
          <h3>No complaints found</h3>
          <p>There are no complaints matching your current filters or bureau scope.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Complaint ID</th>
                <th>Category</th>
                <th>Institution</th>
                <th>Bureau</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((item) => (
                <tr key={item.complaint_id || item.id}>
                  <td className="cell-id">
                    <strong>{item.complaint_id || item.id}</strong>
                    {item.is_escalated && (
                      <span className="escalation-dot" title="Escalated">
                        <AlertTriangle size={12} />
                      </span>
                    )}
                  </td>
                  <td>{item.category}</td>
                  <td>
                    <span className="inst-name">{item.institution_name}</span>
                    <span className="inst-id">{item.aicte_permanent_id}</span>
                  </td>
                  <td>
                    <span className="bureau-chip">{item.bureau}</span>
                  </td>
                  <td>
                    <span className={`priority-tag ${item.priority?.toLowerCase()}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${item.status?.toLowerCase().replace(/\s+/g, "-")}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="cell-date">
                    {item.due_date ? new Date(item.due_date).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <span>Showing {complaints.length} of {meta.total} records</span>
          </div>
        </div>
      )}
    </div>
  );
}
