import type { ParseWarning } from "../types/core.js";
import type { NormalizedSession } from "../types/normalized.js";

export function getWarnings(session: NormalizedSession): ParseWarning[] {
  return [...session.warnings];
}
