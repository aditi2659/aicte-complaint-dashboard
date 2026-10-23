
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "for",
  "from", "has", "have", "in", "is", "it", "of", "on", "or", "our",
  "that", "the", "their", "this", "to", "we", "were", "with",
  "students", "student", "institute", "college", "report", "reports"
]);

function tokenize(text = "") {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map(word => word.trim())
      .filter(word => word.length > 2 && !STOP_WORDS.has(word))
  );
}

function jaccardSimilarity(textA, textB) {
  const a = tokenize(textA);
  const b = tokenize(textB);

  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }

  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function compareComplaints(a, b) {
  const reasons = [];
  let score = 0;

  const sameInstitution =
    Boolean(a.institutionId) &&
    Boolean(b.institutionId) &&
    a.institutionId === b.institutionId;

  const sameCategory =
    Boolean(a.category) &&
    Boolean(b.category) &&
    a.category.trim().toLowerCase() === b.category.trim().toLowerCase();

  const textSimilarity = jaccardSimilarity(
    a.description,
    b.description
  );

  if (sameInstitution) {
    score += 0.25;
    reasons.push("same institution ID");
  }

  if (sameCategory) {
    score += 0.25;
    reasons.push("same complaint category");
  }

  if (textSimilarity >= 0.2) {
    reasons.push("similar description wording");
  }

  score += textSimilarity * 0.5;

  if (a.bureau && b.bureau && a.bureau !== b.bureau) {
    reasons.push("reported to different Bureaus/Cells");
  }

  return {
    caseA: {
      id: a.id,
      bureau: a.bureau,
      category: a.category,
      description: a.description
    },
    caseB: {
      id: b.id,
      bureau: b.bureau,
      category: b.category,
      description: b.description
    },
    score: Math.min(score, 1),
    reasons,
    requiresOfficialReview: true
  };
}

export function findRelatedComplaints(complaints, threshold = 0.3) {
  const results = [];

  for (let i = 0; i < complaints.length; i++) {
    for (let j = i + 1; j < complaints.length; j++) {
      const a = complaints[i];
      const b = complaints[j];

      if (!a.bureau || !b.bureau) continue;

      if (a.bureau.trim().toLowerCase() ===
          b.bureau.trim().toLowerCase()) {
        continue;
      }

      // Institution ID must match for this baseline version.
      if (!a.institutionId ||
          a.institutionId !== b.institutionId) {
        continue;
      }

      const match = compareComplaints(a, b);

      const hasIssueEvidence =
        match.reasons.includes("same complaint category") ||
        match.reasons.includes("similar description wording");

      if (hasIssueEvidence && match.score >= threshold) {
        results.push(match);
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}


export function addOverlapFlags(complaints, matches) {
  const matchedCaseIds = new Map();

  for (const complaint of complaints) {
    matchedCaseIds.set(complaint.id, new Set());
  }

  for (const match of matches) {
    const idA = match.caseA.id;
    const idB = match.caseB.id;

    if (matchedCaseIds.has(idA) && matchedCaseIds.has(idB)) {
      matchedCaseIds.get(idA).add(idB);
      matchedCaseIds.get(idB).add(idA);
    }
  }

  return complaints.map(complaint => {
    const matchedIds = [...matchedCaseIds.get(complaint.id)];

    return {
      ...complaint,
      has_overlap: matchedIds.length > 0,
      matched_case_ids: matchedIds
    };
  });
}


const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] &&
    path.resolve(process.argv[1]) === currentFile) {
  const dataPath = new URL("../data/sample_complaints.json", import.meta.url);
  const complaints = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  const matches = findRelatedComplaints(complaints);
  const flaggedComplaints = addOverlapFlags(complaints, matches);

  console.log("POTENTIAL CROSS-BUREAU MATCHES");
  console.log(JSON.stringify(matches, null, 2));

  console.log("\nCOMPLAINTS WITH OVERLAP FLAGS");
  console.log(JSON.stringify(flaggedComplaints, null, 2));
}
