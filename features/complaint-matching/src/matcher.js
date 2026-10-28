
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "for",
  "from", "has", "have", "in", "is", "it", "of", "on", "or", "our",
  "that", "the", "their", "this", "to", "we", "were", "with",
  "students", "student", "institute", "college", "report", "reports"
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeId(value) {
  return normalizeText(value);
}

function tokenize(text = "") {
  return new Set(
    normalizeText(text)
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

  const institutionA = normalizeId(a?.institutionId);
  const institutionB = normalizeId(b?.institutionId);

  const sameInstitution =
    Boolean(institutionA) && institutionA === institutionB;

  const categoryA = normalizeText(a?.category);
  const categoryB = normalizeText(b?.category);

  const sameCategory =
    Boolean(categoryA) && categoryA === categoryB;

  const bureauA = normalizeText(a?.bureau);
  const bureauB = normalizeText(b?.bureau);

  const textSimilarity = jaccardSimilarity(
    a?.description,
    b?.description
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

  if (bureauA && bureauB && bureauA !== bureauB) {
    reasons.push("reported to different Bureaus/Cells");
  }

  return {
    caseA: {
      id: a?.id,
      institutionId: a?.institutionId,
      bureau: a?.bureau,
      category: a?.category,
      description: a?.description
    },
    caseB: {
      id: b?.id,
      institutionId: b?.institutionId,
      bureau: b?.bureau,
      category: b?.category,
      description: b?.description
    },
    score: Math.min(score, 1),
    reasons,
    requiresOfficialReview: true
  };
}

export function findRelatedComplaints(complaints, threshold = 0.3) {
  if (!Array.isArray(complaints)) {
    throw new TypeError("complaints must be an array");
  }

  if (
    typeof threshold !== "number" ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 1
  ) {
    throw new RangeError("threshold must be a number between 0 and 1");
  }

  const results = [];

  for (let i = 0; i < complaints.length; i++) {
    for (let j = i + 1; j < complaints.length; j++) {
      const a = complaints[i];
      const b = complaints[j];

      if (
        !a || typeof a !== "object" || Array.isArray(a) ||
        !b || typeof b !== "object" || Array.isArray(b)
      ) {
        continue;
      }

      const idA = normalizeText(a.id);
      const idB = normalizeText(b.id);

      if (!idA || !idB || idA === idB) continue;

      const bureauA = normalizeText(a.bureau);
      const bureauB = normalizeText(b.bureau);

      if (!bureauA || !bureauB || bureauA === bureauB) continue;

      const institutionA = normalizeId(a.institutionId);
      const institutionB = normalizeId(b.institutionId);

      if (!institutionA || institutionA !== institutionB) continue;

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
  if (!Array.isArray(complaints) || !Array.isArray(matches)) {
    throw new TypeError("complaints and matches must be arrays");
  }

  const matchedCaseIds = new Map();

  for (const complaint of complaints) {
    if (complaint && typeof complaint.id === "string") {
      matchedCaseIds.set(complaint.id, new Set());
    }
  }

  for (const match of matches) {
    const idA = match?.caseA?.id;
    const idB = match?.caseB?.id;

    if (
      typeof idA === "string" &&
      typeof idB === "string" &&
      matchedCaseIds.has(idA) &&
      matchedCaseIds.has(idB)
    ) {
      matchedCaseIds.get(idA).add(idB);
      matchedCaseIds.get(idB).add(idA);
    }
  }

  return complaints.map(complaint => {
    const ids =
      typeof complaint?.id === "string"
        ? matchedCaseIds.get(complaint.id)
        : undefined;

    const matchedIds = ids ? [...ids] : [];

    return {
      ...complaint,
      has_overlap: matchedIds.length > 0,
      matched_case_ids: matchedIds
    };
  });
}

const currentFile = fileURLToPath(import.meta.url);

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === currentFile
) {
  const dataPath = new URL("../data/sample_complaints.json", import.meta.url);
  const complaints = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  const matches = findRelatedComplaints(complaints);
  const flaggedComplaints = addOverlapFlags(complaints, matches);

  console.log("POTENTIAL CROSS-BUREAU MATCHES");
  console.log(JSON.stringify(matches, null, 2));

  console.log("\nCOMPLAINTS WITH OVERLAP FLAGS");
  console.log(JSON.stringify(flaggedComplaints, null, 2));
}
