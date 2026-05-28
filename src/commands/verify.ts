import { findConfigPath, loadConfig } from "../config.ts";
import { getProvider } from "../providers/index.ts";
import { log, prompt, c, mask } from "../util.ts";

export async function cmdVerify(args: string[]): Promise<number> {
  const path = findConfigPath();
  if (!path) { log.err("No keyrotate.toml found."); return 1; }
  const cfg = loadConfig(path);
  const name = args[0];
  if (!name || !cfg.rotations[name]) {
    log.err("Specify a rotation: keyrotate verify <name>");
    return 1;
  }
  const r = cfg.rotations[name];
  const provider = getProvider(r.provider, cfg);
  if (!provider) { log.err(`Unknown provider "${r.provider}"`); return 1; }
  log.heading(`Verify: ${name}`);
  log.info(`Provider: ${provider.label}`);
  const key = await prompt(`Paste the current ${provider.label} key:`);
  if (!key) { log.err("No value provided."); return 1; }
  log.info(`Checking ${mask(key)}…`);
  const providerCfg: Record<string, string> = {};
  for (const [k, v] of Object.entries((cfg.providers?.[r.provider] ?? {}) as Record<string, unknown>)) {
    if (k !== "custom" && (typeof v === "string" || typeof v === "number")) providerCfg[k] = String(v);
  }
  const vRes = await provider.verify(key, providerCfg);
  if (vRes.ok) log.ok(c.green(vRes.detail));
  else log.err(c.red(vRes.detail));
  return vRes.ok ? 0 : 1;
}
