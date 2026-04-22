import { access, readFile, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(
  path: string,
  encoding: BufferEncoding = "utf8",
): Promise<string> {
  return readFile(path, { encoding });
}

export async function readDirectorySafe(path: string) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

export async function statSafe(path: string) {
  try {
    return await stat(path);
  } catch {
    return undefined;
  }
}
