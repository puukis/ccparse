import { normalizeSession, parseSession, resolveToolResults } from "../src/index.js";
import { exampleFixturePath } from "./support.js";

const parsed = await parseSession(exampleFixturePath("external-tool-results.jsonl"));
const normalized = normalizeSession(parsed);
const resolved = await resolveToolResults(normalized, { mode: "json" });

console.log(
  JSON.stringify(
    resolved.events.find((event) => event.kind === "tool_result"),
    null,
    2,
  ),
);
