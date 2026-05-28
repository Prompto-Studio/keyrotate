import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AuditEntry } from "./types.ts";

export function auditPath(): string { return join(homedir(), ".config", "keyrotate", "audit.log"); }
function ensureDir() {
  const dir = join(homedir(), ".config", "keyrotate");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
export function appendAudit(entry: AuditEntry): void {
  ensureDir();
  appendFileSync(auditPath(), JSON.stringify(entry) + "\n", "utf8");
}
export function readAudit(limit = 50): AuditEntry[] {
  const p = auditPath();
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").trim().split("\n").filter(Boolean);
  return lines.slice(-limit).map((l) => JSON.parse(l) as AuditEntry);
}
