import { findConfigPath, loadConfig } from "../config.ts";
import { log, c } from "../util.ts";

export async function cmdList(): Promise<number> {
  const path = findConfigPath();
  if (!path) {
    log.err("No keyrotate.toml found in this directory or any parent.");
    log.info("Run `keyrotate init` to scaffold one.");
    return 1;
  }
  const cfg = loadConfig(path);
  log.heading(`Rotations defined in ${path}`);
  const rotations = Object.entries(cfg.rotations);
  if (rotations.length === 0) { log.warn("(none)"); return 0; }
  const w = Math.max(...rotations.map(([n]) => n.length));
  for (const [name, r] of rotations) {
    const dests = r.destinations.join(", ");
    console.log(`  ${c.bold(name.padEnd(w))}  ${c.dim(r.provider.padEnd(14))}  ${c.dim("→")} ${dests}`);
  }
  log.blank();
  console.log(c.dim(`  Rotate one with:  keyrotate rotate <name>`));
  return 0;
}
