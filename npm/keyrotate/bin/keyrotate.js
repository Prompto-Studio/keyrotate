#!/usr/bin/env node
// Tiny shim — resolves the platform-specific binary that npm installed as an
// optional dependency, then execs it with our argv. Same pattern as esbuild,
// prisma, and swc.
const { spawn } = require("node:child_process");
const { chmodSync } = require("node:fs");

const platform = process.platform;
const arch = process.arch;

const map = {
  "darwin-arm64": { pkg: "keyrotate-darwin-arm64", bin: "keyrotate" },
  "darwin-x64":   { pkg: "keyrotate-darwin-x64",   bin: "keyrotate" },
  "linux-x64":    { pkg: "keyrotate-linux-x64",    bin: "keyrotate" },
  "win32-x64":    { pkg: "keyrotate-win32-x64",    bin: "keyrotate.exe" },
};
const entry = map[`${platform}-${arch}`];
if (!entry) {
  console.error(`[keyrotate] No prebuilt binary for ${platform}-${arch}.`);
  console.error("Supported: darwin-arm64, darwin-x64, linux-x64, win32-x64.");
  console.error("Build from source: https://github.com/Prompto-Studio/keyrotate#install");
  process.exit(1);
}

let bin;
try { bin = require.resolve(`${entry.pkg}/bin/${entry.bin}`); }
catch {
  console.error(`[keyrotate] The optional dependency \`${entry.pkg}\` was not installed.`);
  console.error("This usually means npm skipped optional deps. Try:");
  console.error("  npm install -g keyrotate --include=optional");
  process.exit(1);
}

// chmod is a no-op on Windows; harmless on POSIX where it ensures the exec bit
try { chmodSync(bin, 0o755); } catch {}

const child = spawn(bin, process.argv.slice(2), { stdio: "inherit" });
child.on("exit", (code, sig) => process.exit(sig ? 1 : (code ?? 0)));
child.on("error", (err) => { console.error(`[keyrotate] Failed to spawn binary: ${err.message}`); process.exit(1); });
