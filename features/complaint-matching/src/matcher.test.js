
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


test("matches institution IDs despite capitalization and extra spaces", () => {
  const complaints = [
    {
      id: "CMP-201",
      institutionId: " INST-204 ",
      bureau: "Approval Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments are pending."
    },
    {
      id: "CMP-202",
      institutionId: "inst-204",
      bureau: "Public Grievances Bureau",
      category: " scholarship delay ",
      description: "Students have not received their payments."
    }
  ];

  const matches = findRelatedComplaints(complaints);

  assert.equal(matches.length, 1);
});

test("does not match Bureaus that differ only in capitalization or spaces", () => {
  const complaints = [
    {
      id: "CMP-301",
      institutionId: "INST-204",
      bureau: "Approval Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments are pending."
    },
    {
      id: "CMP-302",
      institutionId: "INST-204",
      bureau: " approval bureau ",
      category: "Scholarship Delay",
      description: "Scholarship payments are delayed."
    }
  ];

  const matches = findRelatedComplaints(complaints);

  assert.equal(matches.length, 0);
});

test("handles complaints with missing descriptions", () => {
  const complaints = [
    {
      id: "CMP-401",
      institutionId: "INST-204",
      bureau: "Approval Bureau",
      category: "Scholarship Delay"
    },
    {
      id: "CMP-402",
      institutionId: "INST-204",
      bureau: "Public Grievances Bureau",
      category: "Scholarship Delay",
      description: ""
    }
  ];

  const matches = findRelatedComplaints(complaints);

  assert.equal(matches.length, 1);
});

test("rejects a non-array complaints input", () => {
  assert.throws(
    () => findRelatedComplaints(null),
    TypeError
  );
});

test("rejects a threshold outside the range zero to one", () => {
  assert.throws(
    () => findRelatedComplaints([], 1.5),
    RangeError
  );

  assert.throws(
    () => findRelatedComplaints([], -0.1),
    RangeError
  );
});

test("rejects complaints without valid case IDs from matching", () => {
  const complaints = [
    {
      institutionId: "INST-204",
      bureau: "Approval Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments are pending."
    },
    {
      id: "CMP-502",
      institutionId: "INST-204",
      bureau: "Public Grievances Bureau",
      category: "Scholarship Delay",
      description: "Scholarship payments are delayed."
    }
  ];

  const matches = findRelatedComplaints(complaints);

  assert.equal(matches.length, 0);
});