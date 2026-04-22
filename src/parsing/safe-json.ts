import type { JsonObject, ParseWarning, SourceLocation } from "../types/core.js";
import { isJsonObject } from "../utils/json.js";

export interface SafeJsonParseResult {
  value?: JsonObject;
  repaired: boolean;
  warnings: ParseWarning[];
  error?: string;
}

function repairMultilineStrings(rawText: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;

  for (const char of rawText) {
    if (escaped) {
      repaired += char;
      escaped = false;
      continue;
    }

    if (inString) {
      if (char === "\\") {
        repaired += char;
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
        repaired += char;
        continue;
      }

      if (char === "\n") {
        repaired += "\\n";
        continue;
      }

      if (char === "\r") {
        repaired += "\\r";
        continue;
      }

      repaired += char;
      continue;
    }

    if (char === "\"") {
      inString = true;
    }

    repaired += char;
  }

  return repaired;
}

function buildLocation(location: SourceLocation): Partial<SourceLocation> {
  return {
    filePath: location.filePath,
    recordIndex: location.recordIndex,
    lineStart: location.lineStart,
    lineEnd: location.lineEnd,
  };
}

export function safeParseJsonRecord(
  rawText: string,
  location: SourceLocation,
  repairNewlinesInStrings: boolean,
): SafeJsonParseResult {
  try {
    const value = JSON.parse(rawText) as unknown;
    if (!isJsonObject(value)) {
      return {
        repaired: false,
        warnings: [
          {
            code: "json_record_not_object",
            source: "parser",
            severity: "warning",
            message: "Parsed a JSON value that was not an object. The raw record was preserved.",
            location: buildLocation(location),
            rawSnippet: rawText.slice(0, 200),
          },
        ],
        error: "Top-level JSON record was not an object.",
      };
    }

    return { value, repaired: false, warnings: [] };
  } catch (error) {
    if (repairNewlinesInStrings) {
      const repairedText = repairMultilineStrings(rawText);
      if (repairedText !== rawText) {
        try {
          const repairedValue = JSON.parse(repairedText) as unknown;
          if (isJsonObject(repairedValue)) {
            return {
              value: repairedValue,
              repaired: true,
              warnings: [
                {
                  code: "repaired_multiline_string",
                  source: "parser",
                  severity: "warning",
                  message:
                    "Recovered a record by escaping literal newlines inside a quoted string.",
                  location: buildLocation(location),
                  rawSnippet: rawText.slice(0, 200),
                },
              ],
            };
          }
        } catch {
          // Fall through to the original parse error below.
        }
      }
    }

    return {
      repaired: false,
      warnings: [
        {
          code: "json_parse_error",
          source: "parser",
          severity: "warning",
          message: "Failed to parse a JSON record and preserved the raw payload.",
          location: buildLocation(location),
          rawSnippet: rawText.slice(0, 200),
          cause: error instanceof Error ? error.message : String(error),
        },
      ],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
