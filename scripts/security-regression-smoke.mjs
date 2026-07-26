import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const forbidden = new RegExp([
  ["su", "pabase"].join(""),
  ["driz", "zle"].join(""),
  ["@fgp", "database"].join("/"),
  ["SUPA", "BASE_"].join(""),
  ["auth", "uid()"].join("."),
].join("|"), "i");
const generatedDirectories = new Set([".next", "node_modules", "bin", "obj", ".ruff_cache", ".pytest_cache", ".venv", "__pycache__"]);

async function assertClean(root, directory = root) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (generatedDirectories.has(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    assert.equal(forbidden.test(entry.name), false, `removed dependency named in ${path}`);
    if (entry.isDirectory()) {
      await assertClean(root, path);
    } else if (entry.isFile()) {
      const content = await readFile(path, "utf8").catch(() => "");
      assert.equal(forbidden.test(content), false, `removed dependency referenced in ${path}`);
    }
  }
}

for (const root of ["apps", "packages", "scripts"]) await assertClean(root);
console.log("Security regression smoke passed: removed database paths are absent.");
