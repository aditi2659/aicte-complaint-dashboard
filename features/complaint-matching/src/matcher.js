import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","been","by","for","from","has","have",
  "in","is","it","of","on","or","our","that","the","their","this","to","we",
  "were","with","students","student","institute","college","report","reports"
]);

function tokenize(text = "") {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );
}

function jaccardSimilarity(textA, textB) {
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function compareComplaints(a, b) {
  const reasons = [];
  let score = 0;

  if (a.institutionId && a.institutionId === b.institutionId) {
    score += 0.25;
    reasons.push("same institution ID");
  }
  if (a.category && b.category && a.category.toLowerCase() === b.category.toLowerCase()) {
    score += 0.25;
    reasons.push("same complaint category");
  }

  const textSimilarity = jaccardSimilarity(a.description, b.description);
  score += textSimilarity * 0.5;
  if (textSimilarity >= 0.2) reasons.push("similar description wording");

  if (a.bureau && b.bureau && a.bureau !== b.bureau) {
    reasons.push("reported to different Bureaus/Cells");
  }

  return {
    caseA: { id: a.id, bureau: a.bureau, category: a.category, description: a.description },
    caseB: { id: b.id, bureau: b.bureau, category: b.category, description: b.description },
    score: Math.min(score, 1),
    reasons,
    requiresOfficialReview: true
  };
}

export function findRelatedComplaints(complaints, threshold = 0.25) {
  const results = [];
  for (let i = 0; i < complaints.length; i++) {
    for (let j = i + 1; j < complaints.length; j++) {
      const a = complaints[i];
      const b = complaints[j];
      // Cross-Bureau only: same institution is a useful signal, not proof of duplication.
      if (a.bureau === b.bureau) continue;
      const match = compareComplaints(a, b);
      if (match.score >= threshold && match.reasons.length > 0) results.push(match);
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const dataPath = new URL("../data/sample_complaints.json", import.meta.url);
  const complaints = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  console.log(JSON.stringify(findRelatedComplaints(complaints), null, 2));
}
