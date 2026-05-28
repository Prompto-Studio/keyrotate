import { findConfigPath, loadConfig } from "../config.ts";
import { getProvider } from "../providers/index.ts";
import { getDestination } from "../destinations/index.ts";
import { appendAudit } from "../audit.ts";
import { log, promptSecret, confirm, c, mask, nowIso, run } from "../util.ts";
import type { AuditEntry, KeyrotateConfig, RotationConfig } from "../types.ts";

export async function cmdRotate(args: string[]): Promise<number> {
  const path = findConfigPath();
  if (!path) { log.err("No keyrotate.toml found. Try `keyrotate init`."); return 1; }
  const cfg = loadConfig(path);
  const name = args[0];
  if (!name) { log.err("Specify a rotation: keyrotate rotate <name>"); return 1; }
  const r = cfg.rotations[name];
  if (!r) { log.err(`Unknown rotation "${name}" — try \`keyrotate list\``); return 1; }

  const provider = getProvider(r.provider);
  if (!provider) { log.err(`Unknown provider "${r.provider}"`); return 1; }

  log.heading(`Rotate: ${name}`);
  log.info(`Provider:     ${provider.label}`);
  log.info(`Destinations: ${r.destinations.join(", ")}`);
  if (r.secret_name) log.info(`Secret name:  ${r.secret_name}`);
  if (provider.rotateUrl) log.info(`Create new at: ${c.cyan(provider.rotateUrl)}`);
  log.blank();

  // Pre-flight every destination.
  for (const dId of r.destinations) {
    const d = getDestination(dId);
    if (!d) { log.err(`Unknown destination "${dId}"`); return 1; }
    const destCfg = mergeDestConfig(cfg, dId, r);
    const ck = await d.check(destCfg);
    if (!ck.ok) { log.err(`${d.label}: ${ck.detail}`); return 1; }
    log.ok(`${d.label}: ${ck.detail}`);
  }
  log.blank();

  const newValue = (await promptSecret(`Paste the new ${provider.label} key (hidden):`)).trim();
  if (!newValue) { log.err("No value provided."); return 1; }
  if (provider.looksLikeKey && !provider.looksLikeKey(newValue)) {
    if (!(await confirm(`Value doesn't match expected ${provider.label} key format. Continue anyway?`, false))) return 1;
  }
  log.info(`Value: ${mask(newValue)}`);
  log.blank();

  // Verify with provider BEFORE writing anywhere.
  log.step(`Verifying against ${provider.label}…`);
  const verify = await provider.verify(newValue);
  if (!verify.ok) {
    log.err(`Verification failed: ${verify.detail}`);
    log.warn("Aborting — nothing written. Confirm the key in the provider dashboard and try again.");
    return 1;
  }
  log.ok(verify.detail);
  log.blank();

  // Write to each destination in order.
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const dId of r.destinations) {
    const d = getDestination(dId)!;
    const destCfg = mergeDestConfig(cfg, dId, r);
    const secretName = String(destCfg.secret_name ?? destCfg.env_name ?? r.secret_name ?? r.name);
    log.step(`Writing to ${d.label} (${secretName})…`);
    const w = await d.set(secretName, newValue, destCfg);
    if (w.ok) { log.ok(w.detail); succeeded.push(dId); }
    else { log.err(w.detail); failed.push({ id: dId, error: w.detail }); }
  }
  log.blank();

  // Post-rotate workflow.
  if (r.postRotateWorkflow) {
    log.step(`Triggering post-rotate workflow ${r.postRotateWorkflow}…`);
    const wf = r.postRotateWorkflow.replace(/^\.github\/workflows\//, "");
    const gh = await run(["gh", "workflow", "run", wf]);
    if (gh.ok) log.ok(`Workflow triggered (check Actions tab)`);
    else log.warn(`Could not auto-trigger: ${gh.stderr.trim()}`);
  }

  const outcome: AuditEntry["outcome"] = failed.length === 0 ? "success" : succeeded.length > 0 ? "partial" : "failure";
  appendAudit({
    timestamp: nowIso(),
    rotation: name,
    provider: r.provider,
    destinations_attempted: r.destinations,
    destinations_succeeded: succeeded,
    destinations_failed: failed,
    verify,
    operator: process.env.USER ?? "unknown",
    outcome,
  });

  if (outcome === "success") {
    log.ok(c.green(`Rotation complete (${succeeded.length}/${r.destinations.length} destinations).`));
    if (await confirm(`Open ${provider.rotateUrl ?? "the provider dashboard"} to revoke the old key now?`, true)) {
      if (provider.rotateUrl) await run(["open", provider.rotateUrl]);
    }
    return 0;
  } else {
    log.warn(c.yellow(`Partial rotation: ${succeeded.length}/${r.destinations.length} destinations updated. Audit log written.`));
    return outcome === "failure" ? 2 : 1;
  }
}

/**
 * Merge config for a destination, applying (in increasing precedence):
 *   1. global [destinations.<id>] table
 *   2. per-rotation [rotations.<name>.overrides.<id>] table
 *   3. rotation-level secret_name → used as default for secret_name + env_name
 */
function mergeDestConfig(cfg: KeyrotateConfig, dId: string, r: RotationConfig): Record<string, unknown> {
  const base = (cfg.destinations[dId] ?? {}) as Record<string, unknown>;
  const override = r.overrides?.[dId] ?? {};
  const defaultName = r.secret_name ?? r.name;

  const merged: Record<string, unknown> = {
    ...base,
    ...override,
    // Apply rotation-level secret_name as the default for any field that names the secret.
    secret_name: override.secret_name ?? r.secret_name ?? base.secret_name ?? r.name,
    env_name: override.env_name ?? r.secret_name ?? base.env_name ?? r.name,
  };

  // 1Password specifics — needs vault + title.
  if (dId === "onepassword") {
    return {
      vault: override.vault ?? base.vault ?? cfg.defaults?.op_vault ?? "Private",
      title: override.title ?? r.title ?? r.name,
      tags: override.tags ?? base.tags ?? (cfg.defaults?.op_tags ?? ["keyrotate"]).join(","),
      category: override.category ?? base.category ?? cfg.defaults?.op_category ?? "API Credential",
      field: override.field ?? base.field ?? "credential",
    };
  }

  // For Fly.io, allow per-rotation app override.
  if (dId === "flyio") {
    return { ...merged, app: override.app ?? base.app };
  }

  return merged;
}
