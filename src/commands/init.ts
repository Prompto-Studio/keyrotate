import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "../util.ts";

const TEMPLATE = `# keyrotate.toml — define one rotation per API key you rotate as a unit.
# Each rotation routes the new value to its destinations and verifies it.

[defaults]
op_vault = "Private"          # 1Password vault for all rotations (override per-rotation if needed)

# ── Example rotation: Resend ────────────────────────────────────────────────
[rotations.resend-alerts]
provider = "resend"
title    = "Prompto · Resend Alerts"   # 1Password item title
destinations = ["onepassword", "github", "supabase"]
# postRotateWorkflow = ".github/workflows/test-alerts.yml"   # optional

[destinations.github]
repo = "OWNER/REPO"
secret_name = "RESEND_API_KEY"

[destinations.supabase]
project_ref = "xxxxxxxxxx"
secret_name = "RESEND_API_KEY"

[destinations.onepassword]
vault = "Private"
`;

export async function cmdInit(): Promise<number> {
  const target = join(process.cwd(), "keyrotate.toml");
  if (existsSync(target)) {
    log.warn(`keyrotate.toml already exists at ${target} — leaving it alone.`);
    return 1;
  }
  writeFileSync(target, TEMPLATE, "utf8");
  log.ok(`Wrote ${target}`);
  log.info("Edit it to define your rotations, then run `keyrotate list`.");
  return 0;
}
