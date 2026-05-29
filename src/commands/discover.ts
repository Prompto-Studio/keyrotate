import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { log, prompt, run, c, hasCommand } from "../util.ts";

/**
 * `keyrotate discover` — scans common places for existing API keys you may
 * already have lying around, then offers to add them to your keyrotate.toml.
 *
 * Scans in order:
 *   1. .env / .env.* files in cwd and any parent up to home
 *   2. ~/.config/keyrotate/known-envs (a user-curated list of .env paths)
 *   3. 1Password vault (if `op` is signed in)
 *   4. Bitwarden vault (if `bw` is unlocked)
 *
 * For each candidate it shows the name + masked value + guessed provider
 * and asks: import? skip? (no full key is ever printed).
 *
 * The user-visible point: "you don't have to remember what keys you have —
 * we'll find them, you'll triage them."
 */

type Candidate = {
  envName: string;          // e.g. OPENAI_API_KEY
  source: string;           // human-readable source (e.g. ".env.local" or "1Password: Prompto · OpenAI")
  guessed?: string;         // e.g. "openai"
  preview: string;          // masked value preview
};

const KEY_NAME_PATTERN = /^(VITE_)?[A-Z][A-Z0-9_]*_(API_)?(KEY|TOKEN|SECRET|PASSWORD|PAT)$/;
const VALUE_PATTERN = /[A-Za-z0-9_\-]{20,}/; // anything plausibly secret-y

// Best-effort provider inference from value prefix / env name.
function guessProvider(envName: string, value: string): string | undefined {
  if (value.startsWith("sk-proj-") || value.startsWith("sk-")) return "openai";
  if (value.startsWith("sk-ant-")) return "anthropic";
  if (value.startsWith("re_")) return "resend";
  if (value.startsWith("rk_live_") || value.startsWith("sk_live_") || value.startsWith("sk_test_")) return "stripe";
  if (value.startsWith("ghp_") || value.startsWith("github_pat_")) return "github-pat";
  if (value.startsWith("npm_")) return "npm";
  if (value.startsWith("hf_")) return "huggingface";
  if (value.startsWith("phc_")) return "posthog";
  if (value.startsWith("AIza")) return "google-cloud";
  if (envName.includes("ELEVENLABS")) return "elevenlabs";
  if (envName.includes("FAL")) return "fal";
  if (envName.includes("ABUSEIPDB")) return "abuseipdb";
  if (envName.includes("RESEND")) return "resend";
  if (envName.includes("NETLIFY")) return "netlify";
  if (envName.includes("SUPABASE")) return "supabase";
  return undefined;
}

function mask(v: string): string {
  if (v.length <= 8) return "*".repeat(v.length);
  return v.slice(0, 4) + "…" + v.slice(-4) + ` (${v.length} chars)`;
}

function looksLikeSecret(value: string): boolean {
  return value.length >= 20 && VALUE_PATTERN.test(value);
}

function parseEnvFile(path: string): Array<{ key: string; value: string }> {
  if (!existsSync(path)) return [];
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { return []; }
  const out: Array<{ key: string; value: string }> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let value = m[2];
    // Strip surrounding quotes if any
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (KEY_NAME_PATTERN.test(m[1]) && looksLikeSecret(value)) {
      out.push({ key: m[1], value });
    }
  }
  return out;
}

function scanEnvFiles(): Candidate[] {
  const found: Candidate[] = [];
  const seen = new Set<string>(); // de-dup by envName+source

  // Walk up from cwd to home looking for .env*
  let dir = process.cwd();
  const home = homedir();
  const visited = new Set<string>();
  while (true) {
    if (visited.has(dir)) break;
    visited.add(dir);
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { /* permission */ }
    for (const name of entries) {
      if (!name.startsWith(".env")) continue;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (!st.isFile()) continue;
      const found_in = parseEnvFile(full);
      for (const { key, value } of found_in) {
        const dedup_key = `${full}::${key}`;
        if (seen.has(dedup_key)) continue;
        seen.add(dedup_key);
        found.push({
          envName: key,
          source: `${full.replace(home, "~")}`,
          guessed: guessProvider(key, value),
          preview: mask(value),
        });
      }
    }
    if (dir === home || dir === "/" || dir.length < 4) break;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return found;
}

async function scan1Password(): Promise<Candidate[]> {
  if (!(await hasCommand("op"))) return [];
  const stat = await run(["op", "vault", "list", "--format=json"]);
  if (!stat.ok) return []; // not signed in
  const items = await run(["op", "item", "list", "--categories", "API Credential,Password,Login,Secure Note", "--format=json"]);
  if (!items.ok) return [];
  let parsed: Array<{ id: string; title: string; category: string }> = [];
  try { parsed = JSON.parse(items.stdout); } catch { return []; }
  const out: Candidate[] = [];
  for (const it of parsed.slice(0, 100)) { // cap to avoid hammering vault
    // For API Credentials we can read the `credential` field; for Logins, `password`.
    const fieldName = it.category === "API_CREDENTIAL" || it.category === "API Credential" ? "credential" : "password";
    const got = await run(["op", "item", "get", it.id, `--field`, fieldName]);
    if (!got.ok) continue;
    const value = got.stdout.trim();
    if (!looksLikeSecret(value)) continue;
    out.push({
      envName: it.title.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      source: `1Password: ${it.title}`,
      guessed: guessProvider(it.title.toUpperCase(), value),
      preview: mask(value),
    });
  }
  return out;
}

async function scanBitwarden(): Promise<Candidate[]> {
  if (!(await hasCommand("bw"))) return [];
  const stat = await run(["bw", "status"]);
  if (!stat.ok) return [];
  try {
    const s = JSON.parse(stat.stdout) as { status: string };
    if (s.status !== "unlocked") return [];
  } catch { return []; }
  await run(["bw", "sync"]);
  const items = await run(["bw", "list", "items"]);
  if (!items.ok) return [];
  let parsed: Array<{ name: string; type: number; login?: { password?: string } }> = [];
  try { parsed = JSON.parse(items.stdout); } catch { return []; }
  const out: Candidate[] = [];
  for (const it of parsed) {
    const value = it.login?.password ?? "";
    if (!looksLikeSecret(value)) continue;
    out.push({
      envName: it.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
      source: `Bitwarden: ${it.name}`,
      guessed: guessProvider(it.name.toUpperCase(), value),
      preview: mask(value),
    });
  }
  return out;
}

export async function cmdDiscover(): Promise<number> {
  console.log();
  log.info(c.bold("Scanning for existing API keys…"));
  console.log(c.dim("  Searches .env* files (walking up from cwd to home), 1Password (if signed in), and Bitwarden (if unlocked)."));
  console.log(c.dim("  Key values are never printed in full — only masked previews."));
  console.log();

  const [env, op, bw] = await Promise.all([
    Promise.resolve(scanEnvFiles()),
    scan1Password(),
    scanBitwarden(),
  ]);

  const all = [...env, ...op, ...bw];
  if (all.length === 0) {
    log.warn("No candidate API keys found.");
    log.info("  Run `keyrotate init` to scaffold a config, then `keyrotate add-custom <id>` or `keyrotate setup` to define rotations.");
    return 0;
  }

  console.log(c.bold(`Found ${all.length} candidate secret(s):`));
  console.log();
  console.log("  " + c.dim("Source".padEnd(50)) + c.dim("Env name".padEnd(28)) + c.dim("Guess".padEnd(14)) + c.dim("Preview"));
  console.log("  " + c.dim("─".repeat(48).padEnd(50)) + c.dim("─".repeat(26).padEnd(28)) + c.dim("─".repeat(12).padEnd(14)) + c.dim("─".repeat(20)));
  for (const cand of all) {
    const src = cand.source.length > 48 ? "…" + cand.source.slice(-47) : cand.source;
    const guess = cand.guessed ?? c.dim("?");
    console.log(`  ${src.padEnd(50)}${cand.envName.padEnd(28)}${guess.padEnd(14)}${cand.preview}`);
  }
  console.log();

  log.info("Next step:");
  console.log(`  Run ${c.cyan("keyrotate add-custom <id>")} for any provider keyrotate doesn't natively know.`);
  console.log(`  Run ${c.cyan("keyrotate import <name>")} once you've declared a rotation, to import the existing key into your vault.`);
  console.log();
  log.info(c.dim("This was a read-only scan — nothing was written or changed."));
  return 0;
}
