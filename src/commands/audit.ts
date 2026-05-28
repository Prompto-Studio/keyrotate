import { readAudit } from "../audit.ts";
import { log, c } from "../util.ts";

export async function cmdAudit(args: string[]): Promise<number> {
  const limit = parseInt(args[0] ?? "20", 10);
  const entries = readAudit(limit);
  if (entries.length === 0) { log.info("(no rotations yet)"); return 0; }
  log.heading(`Recent rotations (last ${entries.length})`);
  for (const e of entries) {
    const tag = e.outcome === "success" ? c.green("✓") : e.outcome === "partial" ? c.yellow("⚠") : c.red("✗");
    console.log(`  ${tag} ${c.dim(e.timestamp)}  ${c.bold(e.rotation)}  ${c.dim("→")} ${e.destinations_succeeded.join(", ")}${e.destinations_failed.length ? "  " + c.red("FAILED: " + e.destinations_failed.map(f => f.id).join(",")) : ""}`);
  }
  return 0;
}
