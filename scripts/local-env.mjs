#!/usr/bin/env node
/**
 * Writes the running local Supabase stack's URL and keys into .env.local.
 *
 * `supabase start` prints them once and then they are gone; this asks the CLI
 * for them again and keeps whatever else is already in .env.local (Maps key,
 * Resend key) untouched.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const envPath = path.join(root, ".env.local");

let raw;
try {
  raw = execSync("npx --yes supabase status -o env", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch {
  console.error(
    "\nCould not read the local Supabase stack. Is it running?\n" +
      "  npm run db:start\n",
  );
  process.exit(1);
}

const status = {};
for (const line of raw.split("\n")) {
  const match = /^([A-Z0-9_]+)=(?:"([^"]*)"|(.*))$/.exec(line.trim());
  if (match) status[match[1]] = match[2] ?? match[3] ?? "";
}

const url = status.API_URL ?? status.SUPABASE_URL;
const anonKey = status.ANON_KEY ?? status.SUPABASE_ANON_KEY ?? status.PUBLISHABLE_KEY;
const serviceKey = status.SERVICE_ROLE_KEY ?? status.SUPABASE_SERVICE_ROLE_KEY ?? status.SECRET_KEY;

if (!url || !anonKey) {
  console.error("Supabase status did not include an API URL and anon key. Output was:\n" + raw);
  process.exit(1);
}

const wanted = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey ?? "",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

let existing = "";
try {
  existing = fs.readFileSync(envPath, "utf8");
} catch {
  // first run
}

const lines = existing.split("\n");
const seen = new Set();
const merged = lines.map((line) => {
  const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
  if (key && key in wanted) {
    seen.add(key);
    return `${key}=${wanted[key]}`;
  }
  return line;
});
for (const [key, value] of Object.entries(wanted)) {
  if (!seen.has(key)) merged.push(`${key}=${value}`);
}

fs.writeFileSync(envPath, merged.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").replace(/\n*$/, "\n"));

console.log(`\nWrote ${path.relative(root, envPath)}:`);
console.log(`  NEXT_PUBLIC_SUPABASE_URL=${url}`);
console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey.slice(0, 12)}…`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY=${serviceKey ? serviceKey.slice(0, 12) + "…" : "(not reported)"}`);
console.log(`\nStudio:  ${status.STUDIO_URL ?? "http://127.0.0.1:54323"}`);
console.log(`Emails:  ${status.INBUCKET_URL ?? status.MAILPIT_URL ?? "http://127.0.0.1:54324"}\n`);
