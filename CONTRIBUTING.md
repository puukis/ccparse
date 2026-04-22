# Contributing

ccparse is a library-first project. Changes should improve parser resilience, type safety, or developer ergonomics without turning the package into a product CLI or UI.

## Development

```bash
npm install
npm run check
npm run build
```

Useful scripts:

```bash
npm run fixtures:validate
npm run example:basic
npm run example:discovery
npm run example:tool-results
```

## Expectations

- Prefer small focused modules over large generic abstractions.
- Preserve raw data when handling malformed input.
- Add fixture coverage for new parser edge cases.
- Keep public API additions compact and easy to explain.
- Avoid breaking normalized event shapes without a version bump.

## Pull Requests

- Include tests for behavior changes.
- Document public API changes in `README.md` and `CHANGELOG.md`.
- Call out compatibility implications if Claude Code format assumptions changed.
