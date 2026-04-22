<div align="center">
  <h1>ccparse</h1>
  <p>
    <strong>Fault-tolerant parsing for Claude Code local session data.</strong><br />
    Discover sessions, recover messy JSONL, normalize raw records into typed events, and query them without trusting the raw format.
  </p>
  <p>
    <a href="https://www.npmjs.com/package/ccparse-sdk"><img alt="npm alpha" src="https://img.shields.io/npm/v/ccparse-sdk/alpha?label=npm%20alpha" /></a>
    <a href="https://github.com/puukis/ccparse/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/puukis/ccparse/actions/workflows/ci.yml/badge.svg" /></a>
    <a href="./LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
    <a href="https://www.npmjs.com/package/ccparse-sdk"><img alt="Release status: alpha" src="https://img.shields.io/badge/status-alpha-orange.svg" /></a>
    <img alt="Node 20.10+" src="https://img.shields.io/badge/node-20.10%2B-3C873A" />
  </p>
  <p>
    <code>repo: ccparse</code>
    <code>npm: ccparse-sdk</code>
  </p>
</div>

---

ccparse is a production-oriented TypeScript SDK for discovering, parsing, normalizing, and querying Claude Code local session data.

It is not a transcript viewer, a dashboard, or a public CLI product. The goal is narrower and more useful: give developers a stable library for building their own tooling on top of messy real-world Claude Code data under `~/.claude`.

Current release status: alpha. The core parser and normalized model are usable, but externalized tool payloads and nested transcript branches should continue to accumulate field-tested fixtures over time.

The repository is `ccparse`, and the npm package name is `ccparse-sdk`.

## Why It Exists

Claude Code stores valuable local artifacts, but the raw files are not a stable public API. They can contain partial records, multiline breakage, externalized tool payloads, nested transcript references, and other format drift. ccparse exists to make that data safer to consume without pretending the underlying format is perfectly clean.

## What It Supports

- Session transcripts under `~/.claude/projects/...`
- Prompt history files such as `~/.claude/history.jsonl`
- Session metadata files under `~/.claude/sessions/...`
- Project memory directories adjacent to transcript files
- Nested or subagent transcript references when they appear in tool results
- Externalized tool result payload references that should be hydrated lazily

## Install

```bash
npm install ccparse-sdk@alpha
```

## Quick Examples

Parse and summarize a session:

```ts
import { normalizeSession, parseSession, summarizeSession } from "ccparse-sdk";

const parsed = await parseSession("/Users/alex/.claude/projects/.../session.jsonl");
const normalized = normalizeSession(parsed);

console.log(summarizeSession(normalized));
```

Discover sessions from the default Claude root:

```ts
import { discoverSessions } from "ccparse-sdk";

const sessions = await discoverSessions();
console.log(sessions.map((session) => session.transcriptPath));
```

Hydrate externalized tool results only when needed:

```ts
import { normalizeSession, parseSession, resolveToolResults } from "ccparse-sdk";

const parsed = await parseSession("/Users/alex/.claude/projects/.../session.jsonl");
const normalized = normalizeSession(parsed);
const resolved = await resolveToolResults(normalized, { mode: "json" });
```

## Public API

ccparse intentionally keeps the top-level surface compact:

- `discoverSessions(options)`
- `parseSession(path, options)`
- `parseHistory(path, options)`
- `normalizeSession(session, options)`
- `resolveToolResults(session, options)`
- `iterateEvents(session)`
- `getAssistantTurns(session)`
- `getSessionState(session)`
- `getDiscoveredSessionState(session)`
- `getTranscriptState(session)`
- `getToolCalls(session)`
- `getOpenToolCalls(session)`
- `getOrphanToolResults(session)`
- `getSubagentRuns(session)`
- `getWarnings(session)`
- `compareSessions(a, b)`
- `summarizeSession(session)`

## Counting Semantics

Three places where ccparse is intentionally explicit:

- Discovery warning counts are split into `parserWarningCount`, `normalizationWarningCount`, and `totalWarningCount`.
- Session state is exposed as a first-class `currentState` object in discovery and `transcriptState` in summaries.
- Session summaries distinguish `assistantRecordCount` from `assistantReplyCount`.
- Warning reasons are exposed as `warningKinds`, and you can read the full warnings via `getWarnings(session)`.

## Session State

ccparse now exposes explicit session-state helpers for common “what is Claude Code doing right now?” use cases:

- `getSessionState(session)` returns the best available current state and enriches from local Claude metadata when possible
- `getDiscoveredSessionState(discoveredSession)` returns the same enriched state for discovery results
- `getTranscriptState(normalizedSession)` returns transcript-derived state only
- `discoverSessions()` includes `currentState`
- `summarizeSession()` includes `transcriptState`

The first release uses a focused state model:

- `waiting_for_user`
- `waiting_for_tool_result`
- `running`
- `completed`
- `incomplete`
- `unknown`

`assistantRecordCount` is the count of assistant-origin normalized records represented by `getAssistantTurns()`, including thinking-only and tool-use-only assistant records. It is not limited to human-visible replies. `assistantReplyCount` is narrower: it counts only assistant turns that contain visible text. `assistantTextBlockCount` counts individual normalized text blocks.

Tool linkage is also summarized explicitly:

- `toolCallCount`: normalized `tool_use` events
- `toolResultCount`: normalized `tool_result` events
- `openToolCallCount`: tool calls still unmatched at end-of-session
- `orphanToolResultCount`: tool results with no matching prior tool call

You can inspect unresolved calls directly:

```ts
import {
  getOpenToolCalls,
  getWarnings,
  normalizeSession,
  parseSession,
} from "ccparse-sdk";

const parsed = await parseSession("/Users/alex/.claude/projects/.../session.jsonl");
const normalized = normalizeSession(parsed);

if (getWarnings(normalized).some((warning) => warning.code === "open_tool_call")) {
  console.log(getOpenToolCalls(normalized));
}
```

## Normalized Model Overview

`normalizeSession()` produces a versioned event stream with provenance:

- `session_metadata`
- `user_message`
- `assistant_text`
- `assistant_thinking`
- `tool_use`
- `tool_result`
- `usage`
- `warning`
- `subagent_run`

Every normalized event includes:

- source file path
- record index
- line and character offsets
- warning codes
- optional raw payload preservation

Tool results can stay as lightweight external references until you explicitly call `resolveToolResults()`.

## Recovery Behavior

Recovery is a core feature, not a best-effort extra.

- ccparse does not trust newline boundaries alone.
- It preserves broken raw records instead of discarding them.
- It attempts conservative repair for literal newlines inside quoted JSON strings.
- It emits structured warnings when it recovers or skips malformed input.
- It continues parsing valid records whenever possible.

## How It Differs From Viewers Or Analytics Tools

- It is library-first and npm-publishable.
- It prioritizes typed data access over presentation.
- It keeps raw parsing separate from normalization so downstream tools can choose their own abstractions.
- It does not ship a public CLI as the product surface in v1.

## Examples In This Repo

```bash
npm run example:basic
npm run example:discovery
npm run example:open-tool-calls
npm run example:tool-results
```

## Development

```bash
npm install
npm run check
npm run build
```

The fixture validator is useful when extending parser coverage:

```bash
npm run fixtures:validate
```

To audit real local sessions that contain external tool payloads or subagent references when they exist:

```bash
npm run audit:local-edge-cases
```

## Limitations

- The normalized model is based on observed Claude Code data and compatibility heuristics, not a formal upstream schema contract.
- Discovery currently parses each discovered session for metadata hints instead of using a lighter index-only pass.
- v1 does not recurse automatically into referenced subagent transcripts; it exposes those references so callers can decide when to parse them.
- v1 only performs one automatic repair strategy for malformed JSON records: escaping literal newlines inside quoted strings.

## Roadmap

- Optional chunked file parsing for very large transcripts
- Broader detection of external payload reference shapes
- Optional recursive parsing of nested transcript graphs
- More history and memory-file normalization helpers
- Schema snapshots and compatibility reporting across Claude Code versions

## Architecture

Short design notes live in [docs/design.md](./docs/design.md).

Launch drafts:

- [docs/release-0.1.0-alpha.1.md](./docs/release-0.1.0-alpha.1.md)
- [docs/show-hn.md](./docs/show-hn.md)

## Contributing

Contribution guidance is in [CONTRIBUTING.md](./CONTRIBUTING.md). The short version:

- keep modules small
- preserve raw data on failure paths
- add fixture-backed tests for parser changes
- avoid turning the package into a UI or CLI product

Community and repository health docs:

- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [SECURITY.md](./SECURITY.md)
- [SUPPORT.md](./SUPPORT.md)
