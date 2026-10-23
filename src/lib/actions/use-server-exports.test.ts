import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Next.js only allows a `"use server"` file to export async functions — any
 * other export (a constant, an object, a type re-exported as a value, …)
 * throws at runtime the moment any client component imports it transitively,
 * which is exactly how handoff 08's bug 1 broke /sign-in and /sign-up: a
 * plain `idleExportState` object sat next to the actions in
 * `src/lib/actions/privacy.ts`.
 *
 * That bug was invisible to every QA pass before this one because they were
 * all code reading plus unit tests against individual functions — nothing
 * actually imported the whole module the way Next does. Importing the real
 * modules here isn't an option either: almost every one of them pulls in
 * `server-only` transitively (via `@/lib/auth` / `@/lib/supabase/server`),
 * and that package only resolves inside Next's own bundler, which aliases it
 * to an internal shim — under plain Node/Vitest it's just a missing
 * dependency (confirmed: it's not in `package.json` or `node_modules`), so a
 * dynamic `import()` of these files fails for an unrelated reason before it
 * can even check the exports.
 *
 * So this checks the one thing Next actually enforces, straight from the
 * source text instead: every top-level `export` in a `"use server"` file is
 * either a function declaration, a `const`/`let` bound to a function
 * expression, or a type-only export (`interface`/`type`, erased at compile
 * time — Next never sees these as runtime exports at all).
 */

const SRC_ROOT = fileURLToPath(new URL("../../", import.meta.url));

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

/** The directive has to be the file's first statement, same as Next checks it. */
function startsWithUseServerDirective(content: string): boolean {
  const firstLine = content.split("\n").find((line) => line.trim().length > 0) ?? "";
  return /^["']use server["'];?$/.test(firstLine.trim());
}

/** Type-only exports are erased at compile time — Next never sees these. */
const TYPE_ONLY_EXPORT = /^export\s+(interface|type)\b/;
/** A function declaration — the only value export Next allows here. */
const FUNCTION_DECLARATION_EXPORT = /^export\s+(default\s+)?(async\s+)?function\b/;
/** `export const/let foo = (...) => ...` or `= async (...) => ...` or `= function`. */
const FUNCTION_VALUE_EXPORT = /^export\s+(const|let)\s+\w+\s*(:[^=]+)?=\s*(async\s*)?(\(|function\b)/;

/**
 * Every top-level `export ...` line (these files don't indent top-level
 * declarations, so a column-0 anchor is enough — no AST needed for
 * something this cheap to check).
 */
function topLevelExportLines(content: string): string[] {
  return content.split("\n").filter((line) => line.startsWith("export "));
}

function nonFunctionExportLines(content: string): string[] {
  return topLevelExportLines(content).filter(
    (line) =>
      !TYPE_ONLY_EXPORT.test(line) &&
      !FUNCTION_DECLARATION_EXPORT.test(line) &&
      !FUNCTION_VALUE_EXPORT.test(line),
  );
}

const useServerFiles = collectSourceFiles(SRC_ROOT).filter((file) =>
  startsWithUseServerDirective(readFileSync(file, "utf8")),
);

describe('"use server" files export only async functions', () => {
  // Sanity check on the scan itself — if this ever hits 0, the glob above
  // broke silently and every case below would vacuously pass.
  it('found at least one "use server" file to check', () => {
    expect(useServerFiles.length).toBeGreaterThan(0);
  });

  const cases = useServerFiles.map((file) => [relative(SRC_ROOT, file), file] as const);

  it.each(cases)("%s exports only functions", (label, file) => {
    const content = readFileSync(file, "utf8");
    expect(nonFunctionExportLines(content), `${label} has a non-function export`).toEqual([]);
  });
});
