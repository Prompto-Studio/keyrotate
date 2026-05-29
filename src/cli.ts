#!/usr/bin/env bun
import { log, c } from "./util.ts";
import { cmdList } from "./commands/list.ts";
import { cmdRotate } from "./commands/rotate.ts";
import { cmdVerify } from "./commands/verify.ts";
import { cmdAudit } from "./commands/audit.ts";
import { cmdInit } from "./commands/init.ts";
import { cmdDoctor } from "./commands/doctor.ts";
import { cmdVerifyAll } from "./commands/verifyAll.ts";
import { cmdSetup } from "./commands/setup.ts";
import { cmdAddCustom } from "./commands/addCustom.ts";
import { cmdDiscover } from "./commands/discover.ts";
import { cmdImport } from "./commands/import.ts";
import { cmdAutoRotate } from "./commands/autoRotate.ts";
import { cmdCheckRotations } from "./commands/checkRotations.ts";

// Cosmetic version — keyrotate uses a zero-padded "00.00.NN" display scheme.
// package.json stays at semver-valid "0.4.0" (npm/bun reject leading zeros);
// nothing user-facing ever shows the semver form.
const VERSION = "00.00.04";

const HELP = `
${c.bold("keyrotate")} ${c.dim(`v${VERSION}`)}  ${c.dim("— one-command API-key rotation")}

${c.bold("Usage:")}
  keyrotate <command> [args]

${c.bold("Commands:")}
  ${c.cyan("setup")}           Interactive wizard — guided setup for any project
  ${c.cyan("init")}            Scaffold a minimal keyrotate.toml (non-interactive)
  ${c.cyan("list")}            List rotations defined in keyrotate.toml
  ${c.cyan("doctor")}          Check CLI installs, auth, and destination config
  ${c.cyan("rotate <name>")}   Rotate the named rotation (interactive)
  ${c.cyan("verify <name>")}   Verify a single key (prompts for value)
  ${c.cyan("verify-all")}      Read-only health check of every key in keyrotate.toml
  ${c.cyan("audit [N]")}       Show the last N rotations (default 20)
  ${c.cyan("add-custom <id>")} Interactive wizard for a custom API provider
  ${c.cyan("discover")}        Scan .env / 1Password / Bitwarden for existing keys (read-only)
  ${c.cyan("import <name>")}   First-time import of an existing key into the vault
  ${c.cyan("auto-rotate <name>")} Zero-prompt rotation (Resend/PostHog; uses provider create() API)
  ${c.cyan("check-rotations")} Print rotations due/overdue; --email sends summary via your Resend key
  ${c.cyan("help")}            Show this message
  ${c.cyan("version")}         Print version

${c.bold("Config discovery:")} walks up from cwd looking for keyrotate.toml.

${c.dim("Repo: https://github.com/Prompto-Studio/keyrotate")}
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined: case "help": case "-h": case "--help":  console.log(HELP); return 0;
    case "version": case "-v": case "--version":            console.log(VERSION); return 0;
    case "setup":       return await cmdSetup();
    case "init":        return await cmdInit();
    case "list":        return await cmdList();
    case "doctor":      return await cmdDoctor();
    case "rotate":      return await cmdRotate(rest);
    case "verify":      return await cmdVerify(rest);
    case "verify-all":  return await cmdVerifyAll();
    case "audit":       return await cmdAudit(rest);
    case "add-custom":  return await cmdAddCustom(rest);
    case "discover":    return await cmdDiscover();
    case "import":      return await cmdImport(rest);
    case "auto-rotate": return await cmdAutoRotate(rest);
    case "check-rotations": return await cmdCheckRotations(rest);
    default:
      log.err(`Unknown command: ${cmd}`);
      console.log(HELP);
      return 1;
  }
}

main().then((code) => process.exit(code ?? 0)).catch((err) => {
  log.err(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
