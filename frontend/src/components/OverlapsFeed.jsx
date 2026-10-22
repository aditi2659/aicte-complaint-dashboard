import { useEffect, useState } from "react";
import { getOverlaps } from "../services/api.js";

export default function OverlapsFeed({ user }) {
  const [overlaps, setOverlaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    getOverlaps()
      .then((res) => {
        if (isMounted) {
          setOverlaps(res.overlaps || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load overlap suggestions.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="empty">
        <p>Loading AI-assisted case overlap links...</p>
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

  return (
    <div className="overlaps-section">
      <section className="intro">
        <h2>Potentially Related Cases</h2>
        <p>
          Algorithmic overlap suggestions based on semantic similarity and institute permanence.
          Suggestions require official human review and are never automatically merged.
        </p>
      </section>

      <section className="cards">
        {overlaps.length === 0 ? (
          <article className="empty">
            <h3>No overlap links found for your bureau scope</h3>
            <p>
              {user.role === "SUPER_ADMIN" || user.role === "AUDITOR"
                ? "No suggested duplicate complaints currently exist across any bureau."
                : `No open overlaps involve complaints under ${user.bureau || "your bureau"}.`}
            </p>
          </article>
        ) : (
          overlaps.map((match) => (
            <article className="match-card" key={match.id || `${match.caseA?.id}-${match.caseB?.id}`}>
              <div className="match-head">
                <span className="score">
                  {Math.round((match.similarity_score || 0) * 100)}% similarity
                </span>
                <span className="review">
                  {match.review_status === "Suggested" ? "Needs official review" : match.review_status}
                </span>
              </div>

              <div className="case-pair">
                <div>
                  <p className="case-id">
                    <strong>{match.caseA?.id}</strong> · {match.caseA?.bureau}
                  </p>
                  <h3>{match.caseA?.category}</h3>
                  <p className="case-institution">
                    {match.caseA?.institution_name} ({match.caseA?.institution_id})
                  </p>
                  <p>{match.caseA?.description}</p>
                </div>

                <div>
                  <p className="case-id">
                    <strong>{match.caseB?.id}</strong> · {match.caseB?.bureau}
                  </p>
                  <h3>{match.caseB?.category}</h3>
                  <p className="case-institution">
                    {match.caseB?.institution_name} ({match.caseB?.institution_id})
                  </p>
                  <p>{match.caseB?.description}</p>
                </div>
              </div>

              {match.match_reasons && match.match_reasons.length > 0 && (
                <p className="reason">
                  <strong>Why suggested:</strong> {match.match_reasons.join("; ")}
                </p>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
