import { cmdDoctor } from "./doctor.ts";
import { cmdDiscover } from "./discover.ts";
import { cmdCheckRotations } from "./checkRotations.ts";
import { log, c } from "../util.ts";

/**
 * `keyrotate self-check` — runs the three read-only checks in sequence:
 *   1. doctor (CLI installs + auth + destination config)
 *   2. discover (existing keys in .env / 1Password / Bitwarden)
 *   3. check-rotations (any rotations due based on rotate_every policies)
 *
 * Designed for the "is this thing in a healthy state?" quick scan, and as
 * the default cron entry for users who want all three at once.
 */
export async function cmdSelfCheck(args: string[]): Promise<number> {
  console.log(c.bold(c.cyan("\n▸ Doctor")));
  console.log(c.dim("  Confirms destination CLIs are installed and authenticated."));
  const docRc = await cmdDoctor();
  console.log();
  console.log(c.bold(c.cyan("▸ Discover")));
  console.log(c.dim("  Looks for existing API keys we might want to import."));
  const disRc = await cmdDiscover();
  console.log();
  console.log(c.bold(c.cyan("▸ Check rotations")));
  console.log(c.dim("  Reports any rotations due based on `rotate_every` policy."));
  const chkRc = await cmdCheckRotations(args);
  console.log();

  if (docRc === 0 && chkRc === 0) {
    log.ok("Self-check passed.");
    return 0;
  }
  log.warn("Self-check found issues (see above).");
  return 1;
}
