import { findConfigPath, loadConfig } from "../config.ts";
import { getProvider } from "../providers/index.ts";
import { getDestination } from "../destinations/index.ts";
import { appendAudit } from "../audit.ts";
import { log, prompt, promptSecret, confirm, c, mask, nowIso, run } from "../util.ts";
import type { AuditEntry } from "../types.ts";

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
  if (provider.rotateUrl) log.info(`Create new at: ${c.cyan(provider.rotateUrl)}`);
  log.blank();

  // Pre-flight: each destination needs to be reachable + configured.
  for (const dId of r.destinations) {
    const d = getDestination(dId);
    if (!d) { log.err(`Unknown destination "${dId}"`); return 1; }
    const destCfg = mergeDestConfig(cfg, dId, r);
    const ck = await d.check(destCfg);
    if (!ck.ok) { log.err(`${d.label}: ${ck.detail}`); return 1; }
    log.ok(`${d.label}: ${ck.detail}`);
  }
  log.blank();

  // Get the new value.
  const newValue = (await promptSecret(`Paste the new ${provider.label} key (hidden):`)).trim();
  if (!newValue) { log.err("No value provided."); return 1; }
  if (provider.looksLikeKey && !provider.looksLikeKey(newValue)) {
    if (!(await confirm(`Value doesn't match expected ${provider.label} key format. Continue anyway?`, false))) return 1;
  }
  log.info(`Value: ${mask(newValue)}`);
  log.blank();

  // Verify with provider before writing anywhere.
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
    const secretName = String(destCfg.secret_name ?? destCfg.env_name ?? name);
    log.step(`Writing to ${d.label}…`);
    const w = await d.set(secretName, newValue, destCfg);
    if (w.ok) { log.ok(w.detail); succeeded.push(dId); }
    else { log.err(w.detail); failed.push({ id: dId, error: w.detail }); }
  }
  log.blank();

  // Optionally run a post-rotation workflow.
  if (r.postRotateWorkflow) {
    log.step(`Triggering post-rotate workflow ${r.postRotateWorkflow}…`);
    const wf = r.postRotateWorkflow.replace(/^\.github\/workflows\//, "");
    const gh = await run(["gh", "workflow", "run", wf]);
    if (gh.ok) log.ok(`Workflow triggered (check Actions tab)`);
    else log.warn(`Could not auto-trigger: ${gh.stderr.trim()}`);
  }

  // Audit log.
  const outcome: AuditEntry["outcome"] = failed.length === 0 ? "success" : succeeded.length > 0 ? "partial" : "failure";
  const entry: AuditEntry = {
    timestamp: nowIso(),
    rotation: name,
    provider: r.provider,
    destinations_attempted: r.destinations,
    destinations_succeeded: succeeded,
    destinations_failed: failed,
    verify,
    operator: process.env.USER ?? "unknown",
    outcome,
  };
  appendAudit(entry);

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

function mergeDestConfig(cfg: ReturnType<typeof loadConfig>, dId: string, rotation: { title?: string; name: string }): Record<string, unknown> {
  const base = (cfg.destinations[dId] ?? {}) as Record<string, unknown>;
  // 1Password needs title (per-rotation) and vault (default).
  if (dId === "onepassword") {
    return {
      vault: base.vault ?? cfg.defaults?.op_vault ?? "Private",
      title: rotation.title ?? rotation.name,
      tags: base.tags ?? (cfg.defaults?.op_tags ?? ["keyrotate"]).join(","),
      category: base.category ?? cfg.defaults?.op_category ?? "API Credential",
      field: base.field ?? "credential",
    };
  }
  return base;
}
