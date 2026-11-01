/**
 * Test helper: import a client ESM source file from src/ (which lives in a CRA project
 * without "type": "module") by loading its text as a data: URL. Only works for files
 * with no imports. `extraExport` appends `export {...}` for non-exported internals.
 */

import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * @param {string} relPath - Path relative to the repo root
 * @param {string} [extraExport] - Extra export statement to append
 * @return {Promise<object>} Module namespace
 */
export async function loadClientModule(relPath, extraExport = "") {
  const source = await readFile(path.join(REPO_ROOT, relPath), "utf8");
  if (/^\s*import\s/m.test(source)) throw new Error(`${relPath} has imports; cannot load as data URL`);
  const code = `${source}\n${extraExport}\n`;
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`);
}
