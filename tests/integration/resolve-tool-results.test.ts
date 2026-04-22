import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSession } from "../../src/normalize/normalize-session.js";
import { parseSession } from "../../src/parsing/parse-session.js";
import { resolveToolResults } from "../../src/resolve/resolve-tool-results.js";
import { fixturePath } from "../helpers/fixtures.js";

test("resolveToolResults hydrates external JSON payloads lazily", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("external-tool-results.jsonl")));
  const resolved = await resolveToolResults(normalized, { mode: "json" });

  const toolResult = resolved.events.find((event) => event.kind === "tool_result");
  assert(toolResult);
  assert.equal(toolResult.kind, "tool_result");
  if (toolResult.kind === "tool_result" && toolResult.payload.kind === "external") {
    assert.equal(toolResult.payload.reference.exists, true);
    assert.equal(toolResult.payload.reference.hydrated?.mode, "json");
  }
});
