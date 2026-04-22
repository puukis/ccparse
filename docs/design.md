# Design Notes

## Parser Tradeoffs

ccparse parses transcript files as a stream of top-level JSON objects rather than trusting newline boundaries. The scanner walks the file character by character, tracks object depth and string state, and emits a record only when the JSON structure closes. This is more robust than `split("\n")`, but still intentionally simple enough to audit.

The parser currently reads each file into memory before scanning it. That keeps the implementation small and deterministic for v1. If transcript sizes grow materially, the scanner can be lifted into a chunked reader without changing the public API.

## Recovery Strategy

- Preserve every raw record, including broken trailing fragments.
- Attempt one conservative repair for malformed records: escape literal newlines that appear inside quoted strings.
- Emit structured warnings instead of throwing when recovery is possible.
- Continue normalizing successfully parsed records even when some records remain broken.

## Compatibility Strategy

ccparse keeps a strict boundary between raw parsing and normalization:

- `parseSession()` preserves raw objects and parse warnings.
- `normalizeSession()` maps known shapes into a versioned event model.
- Unknown blocks become warnings instead of hard failures.
- Tool result and subagent references are detected with heuristics isolated in `src/normalize/detect.ts`.

That split localizes format drift. If Claude Code changes, most adaptations should land in the normalizer and detection helpers rather than across the whole SDK.

## What May Break If Claude Code Changes

- If transcript records stop being top-level JSON objects, the scanner assumptions need to change.
- If message blocks rename `tool_use`, `tool_result`, `thinking`, or related keys, normalization will still preserve raw records but typed event extraction will become less complete.
- If external payload references move to new fields, `resolveToolResults()` will need new detection rules.

## Extending the Normalized Model

The normalized model is explicitly versioned as `version: 1`. Future changes should prefer additive event kinds or additive fields. If a breaking reshape is required, add `version: 2` types beside the existing model and provide a migration layer instead of silently mutating `v1`.
