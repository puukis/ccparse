import { homedir } from "node:os";
import path from "node:path";

import { pathExists } from "./fs.js";

export function dedupeStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export async function resolveClaudeRoot(root?: string): Promise<string> {
  const fallback = path.join(homedir(), ".claude");
  if (!root) {
    return fallback;
  }

  if (path.basename(root) === ".claude") {
    return root;
  }

  const nested = path.join(root, ".claude");
  if (await pathExists(nested)) {
    return nested;
  }

  return root;
}

export async function decodeProjectSlug(projectSlug: string): Promise<string | undefined> {
  if (!projectSlug.startsWith("-")) {
    return undefined;
  }

  const candidate = projectSlug.replaceAll("-", path.sep);
  if (await pathExists(candidate)) {
    return candidate;
  }

  return undefined;
}

export function resolveRelativePath(baseDir: string, maybeRelative: string): string {
  return path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(baseDir, maybeRelative);
}

export function sortPathsNewestFirst<T extends { modifiedAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftValue = left.modifiedAt ? Date.parse(left.modifiedAt) : 0;
    const rightValue = right.modifiedAt ? Date.parse(right.modifiedAt) : 0;
    return rightValue - leftValue;
  });
}
