import test from "node:test";
import assert from "node:assert/strict";

import { normalizeSession } from "../../src/normalize/normalize-session.js";
import { parseSession } from "../../src/parsing/parse-session.js";
import { fixturePath } from "../helpers/fixtures.js";

test("normalizeSession extracts external tool result references", async () => {
  const parsed = await parseSession(fixturePath("external-tool-results.jsonl"));
  const normalized = normalizeSession(parsed);

  const toolResult = normalized.events.find((event) => event.kind === "tool_result");
  assert(toolResult);
  assert.equal(toolResult.kind, "tool_result");
  if (toolResult.kind === "tool_result") {
    assert.equal(toolResult.payload.kind, "external");
    if (toolResult.payload.kind === "external") {
      assert.equal(
        toolResult.payload.reference.path,
        "./tool-results/external-session/read-log.json",
      );
    }
  }
});

test("normalizeSession extracts subagent run references", async () => {
  const parsed = await parseSession(fixturePath("subagent-nested.jsonl"));
  const normalized = normalizeSession(parsed);

  const subagent = normalized.events.find((event) => event.kind === "subagent_run");
  assert(subagent);
  assert.equal(subagent.kind, "subagent_run");
  if (subagent.kind === "subagent_run") {
    assert.equal(subagent.transcriptPath, "./subagents/subagent-session-1.jsonl");
    assert.equal(subagent.sessionIdRef, "subagent-session-1");
  }
});

test("normalizeSession warns when the session ends after a tool result", async () => {
  const parsed = await parseSession(fixturePath("missing-final-stop-event.jsonl"));
  const normalized = normalizeSession(parsed);

  assert.equal(normalized.metadata.hasIncompleteTail, true);
  assert(
    normalized.warnings.some((warning) => warning.code === "session_may_be_incomplete"),
  );
});

test("normalizeSession warns when the session ends with an open tool call masked by usage", async () => {
  const parsed = await parseSession(fixturePath("partial-open-tool-call.jsonl"));
  const normalized = normalizeSession(parsed);

  assert.equal(normalized.metadata.hasIncompleteTail, true);
  assert(normalized.warnings.some((warning) => warning.code === "open_tool_call"));
});
