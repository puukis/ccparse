import test from "node:test";
import assert from "node:assert/strict";

import {
  getTranscriptState,
  getSessionState,
  normalizeSession,
  parseSession,
} from "../../src/index.js";
import { fixturePath } from "../helpers/fixtures.js";

test("getTranscriptState returns waiting_for_user when the transcript ends with assistant text", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("normal-session.jsonl")));
  const state = getTranscriptState(normalized);

  assert.equal(state.kind, "waiting_for_user");
  assert.equal(state.lastMeaningfulEventKind, "assistant_text");
});

test("getTranscriptState returns waiting_for_tool_result for open tool calls", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("partial-open-tool-call.jsonl")));
  const state = getTranscriptState(normalized);

  assert.equal(state.kind, "waiting_for_tool_result");
  assert.equal(state.openToolCallCount, 1);
});

test("getTranscriptState returns running when the latest meaningful event is still in progress", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("running-session.jsonl")));
  const state = getTranscriptState(normalized);

  assert.equal(state.kind, "running");
  assert.equal(state.lastMeaningfulEventKind, "assistant_thinking");
});

test("getTranscriptState returns incomplete for incomplete transcript warnings", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("missing-final-stop-event.jsonl")));
  const state = getTranscriptState(normalized);

  assert.equal(state.kind, "incomplete");
  assert(state.warningKinds.includes("session_may_be_incomplete"));
});

test("getTranscriptState returns unknown for metadata-only transcripts", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("metadata-only-session.jsonl")));
  const state = getTranscriptState(normalized);

  assert.equal(state.kind, "unknown");
  assert.equal(state.lastMeaningfulEventKind, undefined);
});

test("getSessionState falls back to transcript state when local metadata is unavailable", async () => {
  const normalized = normalizeSession(await parseSession(fixturePath("normal-session.jsonl")));
  const state = await getSessionState(normalized);

  assert.equal(state.kind, "waiting_for_user");
  assert.equal(state.hasActiveProcess, undefined);
});
