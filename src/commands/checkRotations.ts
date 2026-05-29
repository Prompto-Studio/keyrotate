import { findConfigPath, loadConfig } from "../config.ts";
import { readAudit } from "../audit.ts";
import { log, c, run } from "../util.ts";

/**
 * `keyrotate check-rotations` — read-only rotation-due check.
 *
 * Reads each rotation's `rotate_every` policy (e.g. "90d") from keyrotate.toml,
 * looks up the last successful rotation in the audit log, and prints warnings
 * for any rotation that's due or overdue.
 *
 * If [notify] in keyrotate.toml has a resend_api_key + to_email, ALSO sends
 * an email summary so the operator gets paged even if cron output goes
 * nowhere. The user provides their OWN Resend credentials — we never
 * see or store them.
 *
 * Designed to be installed as a daily cron / Task Scheduler job.
 */

interface DueItem {
  name: string;
  due: "ok" | "soon" | "due" | "overdue" | "never";
  rotateEvery: string;
  daysSince: number | "never";
  daysUntilDue: number | null;
}

function parseDuration(s: string): number {
  // Supports: "90d", "12w", "6m", "1y"
  const m = s.match(/^(\d+)([dwmy])$/);
  if (!m) return NaN;
  const n = parseInt(m[1], 10);
  switch (m[2]) {
    case "d": return n;
    case "w": return n * 7;
    case "m": return n * 30;
    case "y": return n * 365;
    default: return NaN;
  }
}

export async function cmdCheckRotations(args: string[]): Promise<number> {
  const path = findConfigPath();
  if (!path) { log.err("No keyrotate.toml found. Try `keyrotate init`."); return 1; }
  const cfg = loadConfig(path);
  const audit = readAudit(10_000);
  const emit = args.includes("--email") || (cfg as any).notify?.always_email === true;
  const verbose = args.includes("--verbose") || args.includes("-v");

  const items: DueItem[] = [];
  for (const [name, r] of Object.entries(cfg.rotations)) {
    const rotateEvery = (r as any).rotate_every as string | undefined;
    if (!rotateEvery) continue; // no policy → not checked
    const days = parseDuration(rotateEvery);
    if (!Number.isFinite(days)) {
      log.warn(`Rotation "${name}" has invalid rotate_every="${rotateEvery}" — expected like "90d" or "6m". Skipping.`);
      continue;
    }
    // Last successful rotation timestamp
    const last = [...audit].reverse().find((e) => e.rotation === name && e.outcome === "success");
    if (!last) {
      items.push({ name, due: "never", rotateEvery, daysSince: "never", daysUntilDue: null });
      continue;
    }
    const lastT = new Date(last.timestamp).getTime();
    const ageMs = Date.now() - lastT;
    const daysSince = Math.floor(ageMs / 86400_000);
    const daysUntilDue = days - daysSince;
    let due: DueItem["due"];
    if (daysUntilDue < 0) due = "overdue";
    else if (daysUntilDue <= 7) due = "due";
    else if (daysUntilDue <= 14) due = "soon";
    else due = "ok";
    items.push({ name, due, rotateEvery, daysSince, daysUntilDue });
  }

  if (items.length === 0) {
    log.info("No rotations have `rotate_every` policies set. Nothing to check.");
    log.info(`  Add e.g. \`rotate_every = "90d"\` to a rotation block to enable reminders.`);
    return 0;
  }

  const needAttention = items.filter((i) => i.due !== "ok");
  console.log();
  if (verbose || needAttention.length > 0) {
    console.log(c.bold("Rotation status:"));
    for (const i of items) {
      const tag =
        i.due === "overdue" ? c.red("OVERDUE") :
        i.due === "due"     ? c.yellow("DUE")     :
        i.due === "soon"    ? c.dim("soon")       :
        i.due === "never"   ? c.red("NEVER ROTATED") :
        c.dim("ok");
      const daysStr =
        i.daysSince === "never" ? "never" :
        i.due === "overdue"     ? `${-i.daysUntilDue!} days overdue` :
                                   `${i.daysUntilDue} days remaining`;
      console.log(`  ${tag.padEnd(20)} ${i.name.padEnd(28)} ${c.dim(`(every ${i.rotateEvery}, ${daysStr})`)}`);
    }
    console.log();
  }

  if (needAttention.length === 0) {
    log.ok("All rotations within policy.");
    return 0;
  }

  // Print a single summary line for cron logs.
  const overdueCount = items.filter((i) => i.due === "overdue" || i.due === "never").length;
  const dueCount = items.filter((i) => i.due === "due").length;
  log.warn(`Attention: ${overdueCount} overdue/never, ${dueCount} due within 7 days.`);

  // Optionally email via Resend.
  if (emit) {
    const notify = (cfg as any).notify ?? {};
    const apiKey = notify.resend_api_key as string | undefined;
    const to = notify.to_email as string | undefined;
    const from = (notify.from_email as string | undefined) ?? "keyrotate@no-reply.local";
    if (!apiKey || !to) {
      log.warn("Email requested but [notify].resend_api_key + [notify].to_email aren't both set. Skipping email.");
    } else {
      const lines = needAttention.map((i) => {
        const status = i.due === "overdue" ? "OVERDUE" : i.due === "never" ? "NEVER ROTATED" : "DUE";
        const days = i.daysSince === "never" ? "never" : `${i.daysSince} days ago`;
        return `  • [${status}] ${i.name} — last rotated ${days}, policy every ${i.rotateEvery}`;
      }).join("\n");
      const body = `keyrotate has ${needAttention.length} rotation(s) needing attention:\n\n${lines}\n\n— run \`keyrotate rotate <name>\` or \`keyrotate auto-rotate <name>\` to handle each.\n\n— sent automatically by your local keyrotate via your own Resend key.`;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to: [to],
          subject: `[keyrotate] ${needAttention.length} rotation(s) need attention`,
          text: body,
        }),
      });
      if (r.ok) log.ok(`Emailed summary to ${to}`);
      else log.err(`Email failed: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
  }

  return needAttention.length > 0 ? 2 : 0;
}
