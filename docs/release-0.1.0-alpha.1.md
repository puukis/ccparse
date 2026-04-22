# ccparse 0.1.0-alpha.1

Initial alpha release of `ccparse-sdk`, a TypeScript SDK for discovering, parsing, normalizing, and querying Claude Code local session data.

## Highlights

- Fault-tolerant transcript parsing for Claude Code JSONL session data
- Recovery for malformed newline boundaries and truncated trailing records
- Versioned normalized event model with provenance and warning tracking
- Discovery helpers for `~/.claude` session transcripts and related metadata
- Query helpers for assistant turns, tool calls, open tool calls, subagent runs, and warnings
- Lazy hydration of externalized tool-result payloads
- Fixture-backed test suite covering normal, malformed, external payload, missing-tail, and subagent cases

## Install

```bash
npm install ccparse-sdk@alpha
```

## Notes

- This is an alpha release.
- The core parsing and normalization flow is field-tested against local Claude Code sessions.
- Externalized tool payloads and nested transcript branches are implemented and fixture-tested, and should continue to accumulate real sanitized fixtures over time.

## Verification

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run fixtures:validate`

## Repository

- GitHub: https://github.com/puukis/ccparse
- npm: https://www.npmjs.com/package/ccparse-sdk
