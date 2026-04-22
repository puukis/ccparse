import type { JsonObject, JsonValue } from "../types/core.js";

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isJsonArray(value: unknown): value is JsonValue[] {
  return Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function getString(object: unknown, key: string): string | undefined {
  return isJsonObject(object) ? asString(object[key]) : undefined;
}

export function getNumber(object: unknown, key: string): number | undefined {
  return isJsonObject(object) ? asNumber(object[key]) : undefined;
}

export function getObject(object: unknown, key: string): JsonObject | undefined {
  if (!isJsonObject(object)) {
    return undefined;
  }

  const value = object[key];
  return isJsonObject(value) ? value : undefined;
}

export function getArray(object: unknown, key: string): JsonValue[] | undefined {
  if (!isJsonObject(object)) {
    return undefined;
  }

  const value = object[key];
  return isJsonArray(value) ? value : undefined;
}

export function toJsonValue(value: unknown): JsonValue | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const items: JsonValue[] = [];
    for (const item of value) {
      const converted = toJsonValue(item);
      if (converted === undefined) {
        return undefined;
      }
      items.push(converted);
    }
    return items;
  }

  if (isJsonObject(value)) {
    const result: JsonObject = {};
    for (const [key, entry] of Object.entries(value)) {
      const converted = toJsonValue(entry);
      if (converted !== undefined) {
        result[key] = converted;
      }
    }
    return result;
  }

  return undefined;
}

export function deepFindObjects(
  value: JsonValue | undefined,
  predicate: (object: JsonObject) => boolean,
): JsonObject[] {
  if (value === undefined) {
    return [];
  }

  const matches: JsonObject[] = [];
  const visit = (current: JsonValue): void => {
    if (Array.isArray(current)) {
      for (const item of current) {
        visit(item);
      }
      return;
    }

    if (isJsonObject(current)) {
      if (predicate(current)) {
        matches.push(current);
      }
      for (const item of Object.values(current)) {
        visit(item);
      }
    }
  };

  visit(value);
  return matches;
}
