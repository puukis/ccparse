import type { ParseWarning } from "../types/core.js";

export interface WarningCollector {
  add(warning: ParseWarning): ParseWarning;
  extend(warnings: readonly ParseWarning[]): void;
  list(): ParseWarning[];
}

export function createWarningCollector(
  onWarning?: (warning: ParseWarning) => void,
): WarningCollector {
  const warnings: ParseWarning[] = [];

  return {
    add(warning) {
      warnings.push(warning);
      onWarning?.(warning);
      return warning;
    },
    extend(items) {
      for (const item of items) {
        warnings.push(item);
        onWarning?.(item);
      }
    },
    list() {
      return [...warnings];
    },
  };
}
