import { findConfigPath, loadConfig } from "../config.ts";
import { getProvider } from "../providers/index.ts";
import { getDestination } from "../destinations/index.ts";
import { appendAudit } from "../audit.ts";
import { log, c, run, nowIso } from "../util.ts";

/**
 * `keyrotate auto-rotate <name>` — zero-prompt rotation flow.
 *
 * 1. Read the OLD key from 1Password (looked up by the rotation's title).
 * 2. Call provider.create(oldKey) to ask the provider for a fresh key.
 * 3. Verify the new key against the provider.
 * 4. Write the new key to all configured destinations.
 * 5. (Optional) Call provider.revoke(oldKeyId) to retire the old key.
 *
 * Only works for providers that implement create() — currently Resend and
 * PostHog (v00.00.17). Other providers fall back to the interactive `rotate`
 * flow until OAuth device flow lands in v00.00.19.
 */
export async function cmdAutoRotate(args: string[]): Promise<number> {
  const path = findConfigPath();
  if (!path) { log.err("No keyrotate.toml found. Try `keyrotate init`."); return 1; }
  const cfg = loadConfig(path);
  const name = args[0];
  if (!name) { log.err("Usage: keyrotate auto-rotate <name>"); return 1; }
  const r = cfg.rotations[name];
  if (!r) { log.err(`Unknown rotation "${name}"`); return 1; }

  const provider = getProvider(r.provider, cfg);
  if (!provider) { log.err(`Unknown provider "${r.provider}"`); return 1; }

  if (!provider.create) {
    log.err(`${provider.label} doesn't support programmatic key creation.`);
    log.info(`  Use \`keyrotate rotate ${name}\` for the interactive paste flow,`);
    log.info(`  or wait for v00.00.19 which adds OAuth-based create() to more providers.`);
    return 1;
  }

  log.heading(`Auto-rotate: ${name}`);
  log.info(`Provider:     ${provider.label}`);
  log.info(`Destinations: ${r.destinations.join(", ")}`);
  log.blank();

  // 1. Read the OLD key from 1Password (using the rotation's title field).
  if (!r.title) {
    log.err(`Rotation "${name}" has no \`title\` set — auto-rotate needs it to look up the old key in 1Password.`);
    return 1;
  }
  log.step(`Reading old key from 1Password ("${r.title}")…`);
  const vault = (cfg.destinations?.onepassword as Record<string, unknown> | undefined)?.vault ?? "Private";
  const opGet = await run([
    "op", "item", "get", String(r.title),
    "--vault", String(vault),
    "--field", "credential",
    "--reveal",
  ]);
  if (!opGet.ok) {
    log.err(`Couldn't read old key from 1Password: ${opGet.stderr.trim() || "item not found"}`);
    log.info(`  Hint: confirm the item title matches and you're signed in to 1Password.`);
    return 1;
  }
  const oldKey = opGet.stdout.trim();
  if (!oldKey) { log.err("Old key value is empty in 1Password."); return 1; }
  log.ok("Got old key from 1Password.");
  log.blank();

  // 2. Call provider.create() with the old key.
  log.step(`Asking ${provider.label} to mint a new key…`);
  const created = await provider.create(oldKey);
  if (!created.ok || !created.key) {
    log.err(`Failed to create a new key: ${created.detail}`);
    return 1;
  }
  const newKey = created.key;
  const newKeyId = created.id; // may be undefined; needed for revoke()
  log.ok(created.detail);
  log.blank();

  // 3. Verify the new key works.
  log.step(`Verifying the new key against ${provider.label}…`);
  const verify = await provider.verify(newKey);
  if (!verify.ok) {
    log.err(`Verification of the new key failed: ${verify.detail}`);
    log.warn(`  The provider says the freshly-issued key doesn't authenticate — abandoning rotation.`);
    log.warn(`  If this happens repeatedly, file an issue; either provider.create() is broken or there's a propagation lag.`);
    return 1;
  }
  log.ok(verify.detail);
  log.blank();

  // 4. Write to each destination.
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const baseDest = (cfg.destinations ?? {}) as Record<string, Record<string, unknown>>;
  const overrides = (r.overrides ?? {}) as Record<string, Record<string, unknown>>;
  for (const dId of r.destinations) {
    const d = getDestination(dId);
    if (!d) { log.err(`Unknown destination "${dId}"`); failed.push({ id: dId, error: "unknown destination" }); continue; }
    const destCfg = { ...(baseDest[dId] ?? {}), ...(overrides[dId] ?? {}), title: r.title };
    const secretName = String(destCfg.secret_name ?? destCfg.env_name ?? r.secret_name ?? r.name);
    log.step(`Writing to ${d.label} (${secretName})…`);
    const w = await d.set(secretName, newKey, destCfg);
    if (w.ok) { log.ok(w.detail); succeeded.push(dId); }
    else { log.err(w.detail); failed.push({ id: dId, error: w.detail }); }
  }
  log.blank();

  const outcome: "success" | "partial" | "failure" =
    failed.length === 0 ? "success" : succeeded.length > 0 ? "partial" : "failure";

  appendAudit({
    timestamp: nowIso(),
    rotation: name,
    provider: provider.id,
    destinations_attempted: r.destinations,
    destinations_succeeded: succeeded,
    destinations_failed: failed,
    verify,
    operator: process.env.USER ?? "unknown",
    outcome,
  });

  // 5. Optional revoke of the old key (only if all writes succeeded — we
  // don't want to revoke before destinations have the new value).
  if (outcome === "success" && provider.revoke && newKeyId) {
    log.step(`Revoking old key at ${provider.label}…`);
    // For Resend / PostHog, revoke takes the old key id. We don't have the
    // old key's id stored anywhere — we'd need to look it up. For v00.00.17
    // we skip revoke unless the user passes --revoke-old=<id>.
    log.info(`  (skipped — old key id wasn't stored at creation time; pass --revoke-old=<id> if you have it)`);
  }

  if (outcome === "success") {
    log.ok(c.bold(`Auto-rotate complete: ${succeeded.length}/${r.destinations.length} destinations updated.`));
    log.info(`  Old key still active at ${provider.label} — visit ${provider.rotateUrl ?? "the dashboard"} to revoke manually.`);
    return 0;
  } else {
    log.warn(`Auto-rotate partial: ${succeeded.length}/${r.destinations.length} destinations updated, ${failed.length} failed.`);
    log.info("  Re-run to retry; destinations writes are idempotent.");
    return 1;
  }
}
