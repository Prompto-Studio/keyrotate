import { findConfigPath, loadConfig } from "../config.ts";
import { getProvider } from "../providers/index.ts";
import { run, hasCommand, log, c } from "../util.ts";

/**
 * Read-only health check: for every rotation in keyrotate.toml, pull the
 * current key value from 1Password (canonical source of truth) and verify it
 * still works against the upstream provider. Catches: silently-revoked keys,
 * expired tokens, suspended accounts, billing failures.
 *
 * Skips rotations whose destinations don't include `onepassword` (no source
 * to read the key from).
 */
export async function cmdVerifyAll(): Promise<number> {
  const path = findConfigPath();
  if (!path) { log.err("No keyrotate.toml found."); return 1; }
  if (!(await hasCommand("op"))) {
    log.err("1Password CLI 'op' not installed. Install: https://1password.com/downloads/command-line");
    return 1;
  }

  const cfg = loadConfig(path);
  log.heading("keyrotate verify-all — read-only key health check");
  log.info(`Config: ${path}`);
  log.blank();

  const rotations = Object.values(cfg.rotations);
  let passed = 0, failed = 0, skipped = 0;

  for (const r of rotations) {
    const label = (r.name ?? "?").padEnd(18);
    if (!r.destinations.includes("onepassword")) {
      log.warn(`${label} ${c.dim("skipped — no 1Password destination")}`);
      skipped++;
      continue;
    }

    const provider = getProvider(r.provider);
    if (!provider) { log.err(`${label} unknown provider "${r.provider}"`); failed++; continue; }
    if (provider.id === "generic") {
      log.warn(`${label} ${c.dim("skipped — generic provider has no verifier")}`);
      skipped++;
      continue;
    }

    const title = r.title ?? r.name ?? "";
    const vault = String(cfg.destinations.onepassword?.vault ?? cfg.defaults?.op_vault ?? "Private");

    // Pull the current credential from 1Password.
    const op = await run(["op", "item", "get", title, "--vault", vault, "--field", "credential", "--reveal"]);
    if (!op.ok) { log.err(`${label} 1Password lookup failed: ${op.stderr.trim() || "item not found"}`); failed++; continue; }

    const key = op.stdout.trim();
    if (!key) { log.err(`${label} 1Password returned empty credential`); failed++; continue; }

    const v = await provider.verify(key);
    if (v.ok) { log.ok(`${label} ${c.green("OK")}   ${c.dim(provider.label + " — " + v.detail)}`); passed++; }
    else { log.err(`${label} ${c.red("FAIL")} ${c.dim(provider.label + " — " + v.detail)}`); failed++; }
  }

  log.blank();
  console.log(`  ${c.green(passed + " passed")}, ${c.red(failed + " failed")}, ${c.dim(skipped + " skipped")}  (${rotations.length} total)`);
  return failed === 0 ? 0 : 1;
}
