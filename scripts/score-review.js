#!/usr/bin/env node
/**
 * Score AI review JSON against ground-truth planted issues.
 * Usage: node scripts/score-review.js review.json
 */

const fs = require("fs");
const path = require("path");

const GROUND_TRUTH = [
  {
    id: "GT-1",
    file: "src/search.js",
    reasons: ["sql-injection", "string-concat"],
    keywords: ["sql", "inject", "concat", "SELECT"],
  },
  {
    id: "GT-2",
    file: "src/server.js",
    reasons: ["logic-bug"],
    keywords: ["null", "undefined", "toUpperCase", "before"],
  },
  {
    id: "GT-3",
    file: "src/server.js",
    reasons: ["hardcoded-secret"],
    keywords: ["secret", "hardcoded", "INTERNAL_TOKEN", "token"],
  },
  {
    id: "GT-4",
    file: "src/server.js",
    reasons: ["new-endpoint-without-test"],
    keywords: ["/search", "search", "without a test", "no test"],
  },
  {
    id: "GT-5",
    file: "src/server.js",
    reasons: ["new-endpoint-without-test"],
    keywords: ["/admin/stats", "admin/stats", "admin"],
  },
  {
    id: "GT-6",
    file: "src/server.js",
    reasons: ["fetch-without-try-catch"],
    keywords: ["fetch", "try/catch", "try-catch", "weather"],
  },
  {
    id: "GT-7",
    file: "src/server.js",
    reasons: ["style"],
    keywords: ["console.log", "console"],
  },
  {
    id: "GT-8",
    file: "src/search.js",
    reasons: ["style"],
    keywords: ["var ", "`var`", "var"],
  },
];

function normalize(s) {
  return String(s || "").toLowerCase();
}

function matchesGt(comment, gt) {
  const file = normalize(comment.file);
  if (!file.includes(path.basename(gt.file).toLowerCase()) && !file.includes(gt.file.toLowerCase())) {
    return false;
  }
  const blob = normalize([comment.reason, comment.message, comment.severity].join(" "));
  if (gt.reasons.some((r) => blob.includes(normalize(r)))) return true;
  const hits = gt.keywords.filter((k) => blob.includes(normalize(k))).length;
  return hits >= 1;
}

function main() {
  const reviewPath = process.argv[2] || "review.json";
  const raw = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  const comments = Array.isArray(raw.comments) ? raw.comments : [];

  const matchedGt = new Set();
  const matchedComments = new Set();

  for (let i = 0; i < comments.length; i++) {
    for (const gt of GROUND_TRUTH) {
      if (matchedGt.has(gt.id)) continue;
      if (matchesGt(comments[i], gt)) {
        matchedGt.add(gt.id);
        matchedComments.add(i);
        break;
      }
    }
  }

  const tp = matchedGt.size;
  const fp = comments.length - matchedComments.size;
  const fn = GROUND_TRUTH.length - tp;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);

  const report = {
    tp,
    fp,
    fn,
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    found: [...matchedGt],
    missed: GROUND_TRUTH.map((g) => g.id).filter((id) => !matchedGt.has(id)),
    extraComments: comments
      .filter((_, i) => !matchedComments.has(i))
      .map((c) => ({ file: c.file, severity: c.severity, message: c.message, reason: c.reason })),
  };

  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}

main();
