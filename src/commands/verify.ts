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
  const provider = getProvider(r.provider);
  if (!provider) { log.err(`Unknown provider "${r.provider}"`); return 1; }
  log.heading(`Verify: ${name}`);
  log.info(`Provider: ${provider.label}`);
  const key = await prompt(`Paste the current ${provider.label} key:`);
  if (!key) { log.err("No value provided."); return 1; }
  log.info(`Checking ${mask(key)}…`);
  const v = await provider.verify(key);
  if (v.ok) log.ok(c.green(v.detail));
  else log.err(c.red(v.detail));
  return v.ok ? 0 : 1;
}
