import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { log, prompt, confirm, c } from "../util.ts";

/**
 * `keyrotate add-custom <id>` — interactive wizard that asks four questions
 * and writes a [providers.custom.<id>] block to the project's keyrotate.toml.
 *
 * Idea: the long-tail of "I just need to rotate ONE weird API" should be a
 * 30-second flow, not a TOML-editing exercise. Anyone who can curl an API
 * can use this.
 */
export async function cmdAddCustom(argv: string[]): Promise<number> {
  const id = argv[0];
  if (!id) {
    log.err("Usage: keyrotate add-custom <id>");
    log.info("  <id> is a short slug for this provider (e.g. 'mailgun', 'pagerduty').");
    return 1;
  }
  if (!/^[a-z][a-z0-9-]*$/.test(id)) {
    log.err("id must be lowercase letters, numbers, and hyphens (start with a letter).");
    return 1;
  }

  const tomlPath = join(process.cwd(), "keyrotate.toml");
  if (!existsSync(tomlPath)) {
    log.err("No keyrotate.toml in this directory. Run `keyrotate init` first.");
    return 1;
  }

  const existing = readFileSync(tomlPath, "utf8");
  if (existing.includes(`[providers.custom.${id}]`)) {
    log.warn(`A custom provider with id "${id}" already exists in keyrotate.toml.`);
    if (!(await confirm(`Replace it?`, false))) return 0;
  }

  log.info(c.bold(`\nDefining custom provider: ${id}`));
  log.info(c.dim("Four questions. Press ↩ to accept defaults in [brackets]."));
  console.log();

  // 1. Display label
  const labelDefault = id.charAt(0).toUpperCase() + id.slice(1);
  const label = (await prompt(`Display label [${labelDefault}]:`)).trim() || labelDefault;

  // 2. Verify URL — the endpoint we'll hit to confirm the key is valid
  const verifyUrl = (await prompt("Verify URL (a cheap GET endpoint that 200s with a valid key):")).trim();
  if (!verifyUrl.startsWith("http")) {
    log.err("Verify URL must start with http:// or https://");
    return 1;
  }

  // 3. Auth header pattern — how the key is presented in the request
  console.log(c.dim("  Pattern examples:"));
  console.log(c.dim("    Authorization: Bearer ${KEY}"));
  console.log(c.dim("    X-Api-Key: ${KEY}"));
  console.log(c.dim("    Authorization: Basic ${KEY}"));
  const verifyAuth =
    (await prompt(`Auth header pattern [Authorization: Bearer \${KEY}]:`)).trim() ||
    "Authorization: Bearer ${KEY}";

  // 4. Optional: key prefix for sanity checks
  const keyPrefix = (await prompt("Key prefix sanity check (optional, e.g. 'sk_' or 'mg-'):")).trim();

  // 5. Optional: rotate URL — where keyrotate opens after a successful rotation
  const rotateUrl = (await prompt("Provider's API-keys page URL (optional, e.g. https://example.com/api-keys):")).trim();

  // Build the TOML block.
  const block = [
    "",
    "# ── Added by `keyrotate add-custom` ─────────────────────────────────────────",
    `[providers.custom.${id}]`,
    `label = "${label}"`,
    `verify_url = "${verifyUrl}"`,
    `verify_auth = "${verifyAuth}"`,
    keyPrefix ? `key_prefix = "${keyPrefix}"` : "",
    rotateUrl ? `rotate_url = "${rotateUrl}"` : "",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  // If we're replacing, strip the old block first.
  let next = existing;
  if (existing.includes(`[providers.custom.${id}]`)) {
    const startLine = existing.indexOf(`[providers.custom.${id}]`);
    // Walk back to the start of the line.
    const lineStart = existing.lastIndexOf("\n", startLine) + 1;
    // Walk forward to the next [...] header or EOF.
    const blockEnd = existing.indexOf("\n[", startLine + 1);
    const end = blockEnd === -1 ? existing.length : blockEnd;
    next = existing.slice(0, lineStart) + existing.slice(end + 1);
  }
  next = next.replace(/\s+$/, "") + "\n" + block + "\n";
  writeFileSync(tomlPath, next, "utf8");

  console.log();
  log.ok(`Wrote [providers.custom.${id}] block to keyrotate.toml`);
  console.log();
  log.info("Next steps:");
  console.log(`  1) Add a rotation that uses it:`);
  console.log(c.dim(`     [rotations.${id}]`));
  console.log(c.dim(`     provider     = "custom:${id}"`));
  console.log(c.dim(`     title        = "My · ${label}"`));
  console.log(c.dim(`     destinations = ["onepassword"]`));
  console.log(`  2) Test the verifier without rotating:`);
  console.log(c.dim(`     keyrotate verify ${id}`));
  console.log(`  3) When you're ready:`);
  console.log(c.dim(`     keyrotate rotate ${id}`));
  return 0;
}
