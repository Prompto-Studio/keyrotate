#!/usr/bin/env bun
import { log, c } from "./util.ts";
import { cmdList } from "./commands/list.ts";
import { cmdRotate } from "./commands/rotate.ts";
import { cmdVerify } from "./commands/verify.ts";
import { cmdAudit } from "./commands/audit.ts";
import { cmdInit } from "./commands/init.ts";
import { cmdDoctor } from "./commands/doctor.ts";
import { cmdVerifyAll } from "./commands/verifyAll.ts";

const VERSION = "0.3.1";

const HELP = `
${c.bold("keyrotate")} ${c.dim(`v${VERSION}`)}  ${c.dim("— one-command API-key rotation")}

${c.bold("Usage:")}
  keyrotate <command> [args]

${c.bold("Commands:")}
  ${c.cyan("init")}            Scaffold a keyrotate.toml in the current directory
  ${c.cyan("list")}            List rotations defined in keyrotate.toml
  ${c.cyan("doctor")}          Check CLI installs, auth, and destination config
  ${c.cyan("rotate <name>")}   Rotate the named rotation (interactive, prompts for new value)
  ${c.cyan("verify <name>")}   Verify a single key (prompts for value)
  ${c.cyan("verify-all")}      Read-only: verify every key in keyrotate.toml against its provider
  ${c.cyan("audit [N]")}       Show the last N rotations (default 20)
  ${c.cyan("help")}            Show this message
  ${c.cyan("version")}         Print version

${c.bold("Config discovery:")} walks up from the current directory looking for keyrotate.toml.

${c.dim("Repo: https://github.com/Prompto-Studio/keyrotate")}
`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case undefined: case "help": case "-h": case "--help":  console.log(HELP); return 0;
    case "version": case "-v": case "--version":            console.log(VERSION); return 0;
    case "init":        return await cmdInit();
    case "list":        return await cmdList();
    case "doctor":      return await cmdDoctor();
    case "rotate":      return await cmdRotate(rest);
    case "verify":      return await cmdVerify(rest);
    case "verify-all":  return await cmdVerifyAll();
    case "audit":       return await cmdAudit(rest);
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
