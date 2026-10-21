import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export default function App() {
  const [health, setHealth] = useState("Checking API…");
  const [related, setRelated] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => {
        if (!r.ok) throw new Error("API returned an error");
        return r.json();
      })
      .then((data) => setHealth(data.message))
      .catch(() => {
        setHealth("Backend not connected yet");
        setError("Start the backend in a separate terminal to load live sample results.");
      });

    fetch(`${API_BASE}/complaints/related`)
      .then((r) => {
        if (!r.ok) throw new Error("Could not load matches");
        return r.json();
      })
      .then((data) => setRelated(data.data || []))
      .catch(() => setRelated([]));
  }, []);

  return (
    <main className="page">
      <header className="topbar">
        <div>
          <p className="eyebrow">AICTE · PROTOTYPE</p>
          <h1>Complaint Monitoring Dashboard</h1>
          <p className="subtitle">Cross-Bureau Complaint Intelligence</p>
        </div>
        <span className="status">{health}</span>
      </header>

      <section className="intro">
        <h2>Potentially related cases</h2>
        <p>These are suggestions for an authorized official to review, not automatic duplicate decisions.</p>
      </section>

      {error && <p className="notice">{error}</p>}
      <section className="cards">
        {related.length === 0 ? (
          <article className="empty">
            <h3>No results loaded yet</h3>
            <p>Start the backend to view the synthetic sample complaints and matching suggestions.</p>
          </article>
        ) : related.map((match) => (
          <article className="match-card" key={`${match.caseA.id}-${match.caseB.id}`}>
            <div className="match-head">
              <span className="score">{Math.round(match.score * 100)}% similarity</span>
              <span className="review">Needs official review</span>
            </div>
            <div className="case-pair">
              <div>
                <p className="case-id">{match.caseA.id} · {match.caseA.bureau}</p>
                <h3>{match.caseA.category}</h3>
                <p>{match.caseA.description}</p>
              </div>
              <div>
                <p className="case-id">{match.caseB.id} · {match.caseB.bureau}</p>
                <h3>{match.caseB.category}</h3>
                <p>{match.caseB.description}</p>
              </div>
            </div>
            <p className="reason"><strong>Why suggested:</strong> {match.reasons.join("; ")}</p>
          </article>
        ))}
      </section>
      <footer>Prototype only · Synthetic data · Not connected to live AICTE systems</footer>
    </main>
  );
}
