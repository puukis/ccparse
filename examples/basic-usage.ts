import { normalizeSession, parseSession, summarizeSession } from "../src/index.js";
import { exampleFixturePath } from "./support.js";

const parsed = await parseSession(exampleFixturePath("normal-session.jsonl"));
const normalized = normalizeSession(parsed);

console.log(
  JSON.stringify(
    {
      summary: summarizeSession(normalized),
      warnings: normalized.warnings,
    },
    null,
    2,
  ),
);
