import { existsSync } from "node:fs";
import { join } from "node:path";
import { log, prompt, promptSecret, c } from "../util.ts";
import { loadConfig } from "../config.ts";
import { getProvider } from "../providers/index.ts";
import { getDestination } from "../destinations/index.ts";
import { appendAudit } from "../audit.ts";
import { nowIso } from "../util.ts";

/**
 * `keyrotate import <name>` — first-time import of an EXISTING key into the
 * keyrotate-managed set. Same plumbing as `rotate`, but:
 *   - clearer messaging ("importing existing key" vs "rotating")
 *   - skips the "revoke old key?" prompt at the end (there is no old key)
 *
 * The classic use case: a solo founder who has been keeping the OpenAI key
 * pasted in .env for 6 months and now wants to bring it under keyrotate
 * management without changing the value.
 */
export async function cmdImport(argv: string[]): Promise<number> {
  const name = argv[0];
  if (!name) {
    log.err("Usage: keyrotate import <rotation-name>");
    return 1;
  }

  const cfgPath = join(process.cwd(), "keyrotate.toml");
  if (!existsSync(cfgPath)) {
    log.err("No keyrotate.toml in this directory. Run `keyrotate init` first.");
    return 1;
  }
  const cfg = await loadConfig(cfgPath);
  const rot = cfg.rotations?.[name];
  if (!rot) {
    log.err(`No rotation named "${name}" in keyrotate.toml.`);
    return 1;
  }

  console.log();
  console.log(c.bold(`Importing existing key: ${name}`));
  console.log(c.dim("  Same write path as rotate, but framed as a first-time onboarding."));
  console.log(c.dim("  This will verify the key against the provider and write it to all configured destinations."));
  console.log(c.dim("  Nothing is revoked, because there's no previous key to retire."));
  console.log();

  const providerId = rot.provider as string;
  const provider = getProvider(providerId, cfg);
  if (!provider) {
    log.err(`Unknown provider "${providerId}" for rotation "${name}".`);
    return 1;
  }

  log.info(`Provider:     ${provider.label} (${provider.id})`);
  log.info(`Destinations: ${(rot.destinations as string[]).join(", ")}`);
  if (provider.rotateUrl) log.info(`Provider page: ${provider.rotateUrl}`);
  console.log();

  const value = await promptSecret(`Paste the existing ${provider.label} key:`);
  if (!value) { log.err("Empty input — aborting."); return 1; }

  if (provider.looksLikeKey && !provider.looksLikeKey(value)) {
    log.warn(`That value doesn't match the expected format for ${provider.label}. Continue anyway?`);
    const ans = (await prompt("Continue? [y/N]:")).toLowerCase();
    if (ans !== "y" && ans !== "yes") { log.info("Aborted."); return 1; }
  }

  log.info("Verifying against provider…");
  const v = await provider.verify(value);
  if (!v.ok) {
    log.err(`Verification failed: ${v.detail}`);
    log.info("  The key is not valid against the provider's API. Aborting before writing anywhere.");
    return 1;
  }
  log.ok(`Verified: ${v.detail}`);
  console.log();

  const dests = rot.destinations as string[];
  const overrides = (rot.overrides ?? {}) as Record<string, Record<string, unknown>>;
  const baseDest = (cfg.destinations ?? {}) as Record<string, Record<string, unknown>>;

  const succeeded: string[] = [];
  const failed: string[] = [];
  for (const dId of dests) {
    const dest = getDestination(dId);
    if (!dest) { log.warn(`Skipping unknown destination "${dId}"`); failed.push(dId); continue; }
    const config = { ...(baseDest[dId] ?? {}), ...(overrides[dId] ?? {}), title: rot.title };
    log.info(`Writing to ${dest.label}…`);
    const r = await dest.set(rot.secret_name as string ?? name, value, config);
    if (r.ok) { log.ok(r.detail); succeeded.push(dId); }
    else { log.err(r.detail); failed.push(dId); }
  }

  appendAudit({
    timestamp: nowIso(),
    action: "import",
    rotation: name,
    provider: provider.id,
    destinations_attempted: dests,
    destinations_succeeded: succeeded,
    destinations_failed: failed,
    verifier_ok: true,
    operator: process.env.USER ?? "unknown",
  });

  console.log();
  if (failed.length === 0) {
    log.ok(c.bold(`Imported into ${succeeded.length}/${dests.length} destinations.`));
    console.log(c.dim("  Your existing key is now tracked. Next rotation can be auto-magic (v00.00.17 adds create()."));
    return 0;
  } else {
    log.warn(`Imported into ${succeeded.length}/${dests.length} destinations. ${failed.length} failed: ${failed.join(", ")}`);
    log.info("  Re-run import to retry the failed ones (writes are idempotent).");
    return 1;
  }
}
