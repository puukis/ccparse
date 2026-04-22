import path from "node:path";
import { readFile } from "node:fs/promises";

import type { ParseWarning } from "../types/core.js";
import type {
  ExternalPayloadReference,
  NormalizedSession,
  ToolResultEvent,
} from "../types/normalized.js";
import type { JsonValue } from "../types/core.js";
import type { ResolveToolResultsOptions } from "../types/options.js";
import { pathExists } from "../utils/fs.js";
import { resolveRelativePath } from "../utils/path.js";

async function hydrateReference(
  reference: ExternalPayloadReference,
  baseDir: string,
  mode: ResolveToolResultsOptions["mode"],
): Promise<{ reference: ExternalPayloadReference; warning?: ParseWarning }> {
  const absolutePath = reference.absolutePath ?? resolveRelativePath(baseDir, reference.path);
  const exists = await pathExists(absolutePath);
  if (!exists) {
    return {
      reference: {
        ...reference,
        absolutePath,
        exists: false,
        error: `Missing referenced file: ${absolutePath}`,
      },
      warning: {
        code: "tool_result_reference_missing",
        source: "resolver",
        severity: "warning",
        message: `Unable to resolve tool result payload at ${absolutePath}.`,
      },
    };
  }

  try {
    const buffer = await readFile(absolutePath);
    const nextReference: ExternalPayloadReference = {
      ...reference,
      absolutePath,
      exists: true,
    };

    const resolvedMode =
      mode && mode !== "auto"
        ? mode
        : path.extname(absolutePath).toLowerCase() === ".json"
          ? "json"
          : "text";

    if (resolvedMode === "bytes") {
      nextReference.hydrated = { mode: "bytes", value: buffer };
    } else if (resolvedMode === "json") {
      nextReference.hydrated = {
        mode: "json",
        value: JSON.parse(buffer.toString("utf8")) as JsonValue,
      };
    } else {
      nextReference.hydrated = { mode: "text", value: buffer.toString("utf8") };
    }

    return { reference: nextReference };
  } catch (error) {
    return {
      reference: {
        ...reference,
        absolutePath,
        exists: true,
        error: error instanceof Error ? error.message : String(error),
      },
      warning: {
        code:
          error instanceof SyntaxError
            ? "tool_result_reference_parse_failed"
            : "tool_result_reference_unreadable",
        source: "resolver",
        severity: "warning",
        message: `Failed to hydrate tool result payload at ${absolutePath}.`,
        cause: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function resolveToolResults(
  session: NormalizedSession,
  options: ResolveToolResultsOptions = {},
): Promise<NormalizedSession> {
  const baseDir = options.baseDir ?? path.dirname(session.metadata.sourcePath);
  const mode = options.mode ?? "auto";
  const warnings = [...session.warnings];
  const events = await Promise.all(
    session.events.map(async (event) => {
      if (event.kind !== "tool_result" || event.payload.kind !== "external") {
        return event;
      }

      const hydrated = await hydrateReference(event.payload.reference, baseDir, mode);
      if (hydrated.warning) {
        warnings.push(hydrated.warning);
        options.onWarning?.(hydrated.warning);
      }

      return {
        ...event,
        payload: {
          ...event.payload,
          reference: hydrated.reference,
        },
      };
    }),
  );

  return {
    ...session,
    warnings,
    events,
  };
}
