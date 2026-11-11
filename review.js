#!/usr/bin/env node
/**
 * AI code-review for CI: reads a PR diff, calls Anthropic, prints markdown for a PR comment.
 * Never throws uncaught — workflow must stay green even on bad model output / timeouts.
 */

const fs = require("fs");
const path = require("path");

const MAX_DIFF_LINES = 800;
const MAX_CHANGED_FILES = 40;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const API_URL = "https://api.anthropic.com/v1/messages";
const REQUEST_TIMEOUT_MS = 60_000;

const BINARY_HINT =
  /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|bz2|xz|7z|rar|exe|dll|so|dylib|bin|wasm|mp[34]|wav|avi|mov|woff2?|ttf|eot|class|o|a|pyc|pickle)$/i;

const IGNORE_PATH =
  /(^|\/)(dist|generated)(\/|$)|(^|\/)[^/]+\.lock$|(^|\/)package-lock\.json$|(^|\/)yarn\.lock$|(^|\/)pnpm-lock\.yaml$/i;

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseDiffFiles(diff) {
  const files = [];
  const re = /^diff --git a\/(.+?) b\/(.+)$/gm;
  let m;
  while ((m = re.exec(diff)) !== null) {
    files.push(m[2]);
  }
  return files;
}

function filterDiff(raw) {
  const chunks = raw.split(/(?=^diff --git )/m).filter(Boolean);
  const kept = [];
  const skipped = [];

  for (const chunk of chunks) {
    const header = chunk.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    if (!header) {
      kept.push(chunk);
      continue;
    }
    const file = header[2];
    if (IGNORE_PATH.test(file) || BINARY_HINT.test(file)) {
      skipped.push(file);
      continue;
    }
    if (/^Binary files /m.test(chunk) || /\nGIT binary patch\n/.test(chunk)) {
      skipped.push(file);
      continue;
    }
    kept.push(chunk);
  }

  return {
    diff: kept.join(""),
    files: parseDiffFiles(kept.join("")),
    skipped,
  };
}

function countLines(text) {
  if (!text) return 0;
  return text.split("\n").length;
}

function writeSkipComment(reason) {
  const body = [
    "## AI Code Review",
    "",
    `⏸ ${reason}`,
    "",
    `_Thresholds: ≤${MAX_DIFF_LINES} lines, ≤${MAX_CHANGED_FILES} files. Justification: keep prompt under ~context budget and avoid noisy mega-PRs._`,
  ].join("\n");
  process.stdout.write(body + "\n");
}

function formatReviewMarkdown(payload, meta = {}) {
  const lines = ["## AI Code Review", ""];

  if (meta.note) {
    lines.push(`> ${meta.note}`, "");
  }

  const comments = Array.isArray(payload?.comments) ? payload.comments : [];

  if (comments.length === 0) {
    lines.push("Замечаний по чеклисту нет.");
    return lines.join("\n");
  }

  const order = { error: 0, warning: 1, info: 2 };
  const sorted = [...comments].sort(
    (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  );

  for (const c of sorted) {
    const sev = String(c.severity || "info").toUpperCase();
    const file = c.file || "(unknown)";
    const msg = c.message || "";
    const reason = c.reason ? ` \`${c.reason}\`` : "";
    lines.push(`- **[${sev}]** \`${file}\`: ${msg}${reason}`);
  }

  lines.push("");
  lines.push("<details><summary>Raw JSON</summary>");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ comments: sorted }, null, 2));
  lines.push("```");
  lines.push("</details>");

  return lines.join("\n");
}

function extractJson(text) {
  if (!text || typeof text !== "string") return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validatePayload(obj) {
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.comments)) {
    return null;
  }
  const comments = obj.comments
    .filter((c) => c && typeof c === "object")
    .map((c) => ({
      file: String(c.file || ""),
      severity: String(c.severity || "info"),
      message: String(c.message || ""),
      reason: String(c.reason || ""),
    }));
  return { comments };
}

async function callAnthropic(instructions, diff) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const system = [
    "You are a strict CI code-review bot.",
    "Follow the checklist exactly. Do not invent rules outside it.",
    "Return ONLY valid JSON matching the schema in the checklist.",
    "Review the git diff only — never assume the rest of the repository.",
  ].join(" ");

  const user = [
    "# Review checklist",
    instructions,
    "",
    "# PR diff (filtered)",
    "```diff",
    diff.slice(0, 120_000),
    "```",
  ].join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const diffPath = process.argv[2] || "diff.txt";
  const instructionsPath =
    process.env.REVIEW_INSTRUCTIONS ||
    path.join(".github", "review-instructions.md");

  const rawDiff = readFileSafe(diffPath);
  if (rawDiff === null) {
    writeSkipComment(`Не удалось прочитать diff (\`${diffPath}\`), review skipped.`);
    return;
  }

  const { diff, files, skipped } = filterDiff(rawDiff);
  const lineCount = countLines(diff);

  if (!diff.trim()) {
    writeSkipComment(
      skipped.length
        ? `После фильтрации (lock/dist/generated/binary) изменений не осталось. Skipped: ${skipped.join(", ")}.`
        : "Пустой diff — нечего ревьюить."
    );
    return;
  }

  if (lineCount > MAX_DIFF_LINES || files.length > MAX_CHANGED_FILES) {
    writeSkipComment(
      `PR is too large for automatic review (${lineCount} lines, ${files.length} files), review skipped.`
    );
    return;
  }

  const instructions = readFileSafe(instructionsPath);
  if (!instructions) {
    process.stdout.write(
      formatReviewMarkdown(
        { comments: [] },
        {
          note: `Fallback: не найден файл инструкций \`${instructionsPath}\`. Модель не вызывалась.`,
        }
      ) + "\n"
    );
    return;
  }

  let modelText;
  try {
    modelText = await callAnthropic(instructions, diff);
  } catch (err) {
    const msg = err && err.name === "AbortError" ? "timeout" : String(err.message || err);
    process.stdout.write(
      formatReviewMarkdown(
        { comments: [] },
        {
          note: `Fallback: вызов модели не удался (${msg}). CI не падает.`,
        }
      ) + "\n"
    );
    // Also dump structured empty JSON sidecar for debugging in CI artifacts if needed
    try {
      fs.writeFileSync("review.json", JSON.stringify({ comments: [], error: msg }, null, 2));
    } catch {
      /* ignore */
    }
    return;
  }

  const parsed = validatePayload(extractJson(modelText));
  if (!parsed) {
    process.stdout.write(
      formatReviewMarkdown(
        { comments: [] },
        {
          note: "Fallback: модель вернула невалидный JSON / мусор. CI не падает.",
        }
      ) + "\n"
    );
    try {
      fs.writeFileSync(
        "review.json",
        JSON.stringify({ comments: [], raw: String(modelText).slice(0, 4000) }, null, 2)
      );
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    fs.writeFileSync("review.json", JSON.stringify(parsed, null, 2));
  } catch {
    /* ignore */
  }

  const meta = {};
  if (skipped.length) {
    meta.note = `Игнорированы: ${skipped.join(", ")}`;
  }
  process.stdout.write(formatReviewMarkdown(parsed, meta) + "\n");
}

main().catch((err) => {
  // Last-resort: never fail the process with non-zero if avoidable
  process.stdout.write(
    formatReviewMarkdown(
      { comments: [] },
      { note: `Fallback: необработанная ошибка (${String(err.message || err)}).` }
    ) + "\n"
  );
  process.exitCode = 0;
});
