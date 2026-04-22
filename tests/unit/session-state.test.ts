import test from "node:test";
import assert from "node:assert/strict";

import {
  getSessionState,
  normalizeSession,
  parseSession,
} from "../../src/index.js";
import { fixturePath } from "../helpers/fixtures.js";

test("getSessionState returns waiting_for_user when the transcript ends with assistant text", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("normal-session.jsonl")));
  const state = getSessionState(normalized);

  assert.equal(state.kind, "waiting_for_user");
  assert.equal(state.lastMeaningfulEventKind, "assistant_text");
});

test("getSessionState returns waiting_for_tool_result for open tool calls", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("partial-open-tool-call.jsonl")));
  const state = getSessionState(normalized);

  assert.equal(state.kind, "waiting_for_tool_result");
  assert.equal(state.openToolCallCount, 1);
});

test("getSessionState returns running when the latest meaningful event is still in progress", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("running-session.jsonl")));
  const state = getSessionState(normalized);

  assert.equal(state.kind, "running");
  assert.equal(state.lastMeaningfulEventKind, "assistant_thinking");
});

test("getSessionState returns incomplete for incomplete transcript warnings", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("missing-final-stop-event.jsonl")));
  const state = getSessionState(normalized);

  assert.equal(state.kind, "incomplete");
  assert(state.warningKinds.includes("session_may_be_incomplete"));
});

test("getSessionState returns unknown for metadata-only transcripts", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("metadata-only-session.jsonl")));
  const state = getSessionState(normalized);

  assert.equal(state.kind, "unknown");
  assert.equal(state.lastMeaningfulEventKind, undefined);
});
