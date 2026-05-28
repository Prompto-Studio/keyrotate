import { findConfigPath, loadConfig } from "../config.ts";
import { getDestination, listDestinations } from "../destinations/index.ts";
import { hasCommand, log, c } from "../util.ts";

/**
 * Walks every destination type that the loaded config (or all known destinations
 * if no config) actually uses, and reports for each:
 *   • whether the required CLI is installed
 *   • whether it's authenticated / scoped correctly
 *   • whether the configured target (repo / project / vault / site / app) is reachable
 *
 * Goal: a one-shot "am I ready to run any rotation?" check.
 */
export async function cmdDoctor(): Promise<number> {
  log.heading("keyrotate doctor — environment health check");

  const path = findConfigPath();
  let used: Set<string>;
  if (path) {
    const cfg = loadConfig(path);
    used = new Set(Object.values(cfg.rotations).flatMap((r) => r.destinations));
    log.info(`Config:  ${path}`);
    log.info(`Destinations in use: ${[...used].join(", ") || "(none)"}`);
    log.blank();
  } else {
    used = new Set(listDestinations().map((d) => d.id));
    log.warn("No keyrotate.toml found — checking all known destinations.");
    log.blank();
  }

  // Helper: CLI presence check (independent of config — useful even without a config).
  const clis: Array<{ cmd: string; for: string; install: string }> = [
    { cmd: "op",       for: "1Password",  install: "https://1password.com/downloads/command-line" },
    { cmd: "gh",       for: "GitHub",     install: "brew install gh" },
    { cmd: "supabase", for: "Supabase",   install: "brew install supabase/tap/supabase" },
    { cmd: "netlify",  for: "Netlify",    install: "npm i -g netlify-cli" },
    { cmd: "flyctl",   for: "Fly.io",     install: "brew install flyctl" },
  ];

  let failures = 0;
  for (const { cmd, for: name, install } of clis) {
    const present = await hasCommand(cmd);
    if (present) log.ok(`${cmd.padEnd(10)} ${c.dim("present")}  ${c.dim(`(${name})`)}`);
    else {
      const required = used.has(name.toLowerCase().replace(".io", "io")) ||
                       (cmd === "op" && used.has("onepassword"));
      if (required) { log.err(`${cmd.padEnd(10)} MISSING — install: ${install}`); failures++; }
      else log.warn(`${cmd.padEnd(10)} not installed  ${c.dim("(not used by this config — fine)")}`);
    }
  }
  log.blank();

  // Per-destination check (uses the destination's own check() method, with config).
  if (path) {
    const cfg = loadConfig(path);
    for (const dId of used) {
      const d = getDestination(dId);
      if (!d) { log.err(`Unknown destination "${dId}" in config`); failures++; continue; }
      const destCfg = (cfg.destinations[dId] ?? {}) as Record<string, unknown>;
      const r = await d.check(destCfg);
      if (r.ok) log.ok(`${d.label}: ${r.detail}`);
      else { log.err(`${d.label}: ${r.detail}`); failures++; }
    }
  }
  log.blank();

  if (failures === 0) { log.ok(c.green("All checks passed. You're ready to rotate.")); return 0; }
  log.err(c.red(`${failures} issue(s) found — fix them before running \`keyrotate rotate\`.`));
  return 1;
}
