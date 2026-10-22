import { useEffect, useState } from "react";
import { getInstitutions } from "../services/api.js";
import { Search } from "lucide-react";

export default function InstitutionsTable() {
  const [institutions, setInstitutions] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchInstitutions = () => {
    setLoading(true);
    setError("");

    getInstitutions({
      search: searchTerm.trim() || undefined,
      limit: 50
    })
      .then((res) => {
        setInstitutions(res.institutions || []);
        setMeta(res.meta || { total: 0 });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load institutions.");
        setLoading(false);
      });
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchInstitutions();
    }, 250);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  return (
    <div className="table-view-section">
      <div className="section-header">
        <div>
          <h2>AICTE Institution Directory</h2>
          <p className="subtitle">Registered technical universities and polytechnics under oversight</p>
        </div>

        <div className="filter-controls">
          <div className="search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search by name or permanent ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search institutions"
            />
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
          <p>Loading institutions directory...</p>
        </div>
      ) : institutions.length === 0 ? (
        <div className="empty">
          <h3>No institutions found</h3>
          <p>No institutions match your search query.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Permanent ID</th>
                <th>Institution Name</th>
                <th>Type</th>
                <th>State</th>
                <th>Approval Status</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => (
                <tr key={inst.id}>
                  <td className="cell-id">
                    <code>{inst.aicte_permanent_id}</code>
                  </td>
                  <td>
                    <strong>{inst.institution_name}</strong>
                  </td>
                  <td>{inst.institution_type}</td>
                  <td>{inst.state || "—"}</td>
                  <td>
                    <span className={`status-pill ${inst.approval_status?.toLowerCase()}`}>
                      {inst.approval_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            <span>Showing {institutions.length} of {meta.total} records</span>
          </div>
        </div>
      )}
    </div>
  );
}
