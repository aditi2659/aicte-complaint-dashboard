
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  findRelatedComplaints,
  addOverlapFlags
} from "./matcher.js";

const complaints = JSON.parse(
  fs.readFileSync(
    new URL("../data/sample_complaints.json", import.meta.url),
    "utf8"
  )
);

test("detects the two expected cross-bureau overlap pairs", () => {
  const matches = findRelatedComplaints(complaints);

  const pairs = matches.map(match =>
    [match.caseA.id, match.caseB.id].sort().join(" + ")
  );

  assert.deepEqual(pairs.sort(), [
    "CMP-1001 + CMP-1002",
    "CMP-1003 + CMP-1005"
  ]);
});

test("does not flag the unrelated laboratory complaint", () => {
  const matches = findRelatedComplaints(complaints);
  const flagged = addOverlapFlags(complaints, matches);

  const laboratoryComplaint = flagged.find(
    complaint => complaint.id === "CMP-1004"
  );

  assert.equal(laboratoryComplaint.has_overlap, false);
});

test("adds a boolean overlap flag to every complaint", () => {
  const matches = findRelatedComplaints(complaints);
  const flagged = addOverlapFlags(complaints, matches);

  assert.equal(flagged.length, complaints.length);

  for (const complaint of flagged) {
    assert.equal(typeof complaint.has_overlap, "boolean");
  }
});

test("requires official review for every detected match", () => {
  const matches = findRelatedComplaints(complaints);

  for (const match of matches) {
    assert.equal(match.requiresOfficialReview, true);
  }
});



test("does not match unrelated issues from the same institution", () => {
  const records = [
    {
      id: "TEST-1",
      institutionId: "INST-1",
      bureau: "Approval Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments have not been credited."
    },
    {
      id: "TEST-2",
      institutionId: "INST-1",
      bureau: "Regulation Bureau",
      category: "Laboratory Safety",
      description: "Laboratory equipment requires urgent safety repairs."
    }
  ];

  assert.deepEqual(findRelatedComplaints(records), []);
});

test("does not match complaints from the same bureau", () => {
  const records = [
    {
      id: "TEST-3",
      institutionId: "INST-2",
      bureau: "Approval Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments have not been credited."
    },
    {
      id: "TEST-4",
      institutionId: "INST-2",
      bureau: "Approval Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments are still pending."
    }
  ];

  assert.deepEqual(findRelatedComplaints(records), []);
});
