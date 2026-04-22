import type { NormalizedEvent, NormalizedSession } from "../types/normalized.js";

export function* iterateEvents(session: NormalizedSession): IterableIterator<NormalizedEvent> {
  for (const event of session.events) {
    yield event;
  }
}
