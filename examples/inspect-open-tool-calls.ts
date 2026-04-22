import {
  getOpenToolCalls,
  getWarnings,
  normalizeSession,
  parseSession,
  summarizeSession,
} from "../src/index.js";
import { exampleFixturePath } from "./support.js";

const parsed = await parseSession(exampleFixturePath("partial-open-tool-call.jsonl"));
const normalized = normalizeSession(parsed);

console.log(
  JSON.stringify(
    {
      summary: summarizeSession(normalized),
      warningKinds: getWarnings(normalized).map((warning) => warning.code),
      openToolCalls: getOpenToolCalls(normalized).map((event) => ({
        toolUseId: event.toolUseId,
        name: event.name,
        recordIndex: event.provenance.recordIndex,
        timestamp: event.timestamp,
        input: event.input,
      })),
    },
    null,
    2,
  ),
);
