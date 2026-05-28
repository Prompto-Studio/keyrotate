import type { Destination } from "../types.ts";
import { run, hasCommand } from "../util.ts";
export const supabaseDest: Destination = {
  id: "supabase", label: "Supabase Edge Function secret",
  async check(config) {
    if (!(await hasCommand("supabase"))) return { ok: false, detail: "supabase CLI not installed" };
    if (!config.project_ref) return { ok: false, detail: "destinations.supabase.project_ref not set" };
    return { ok: true, detail: `supabase ready, project ${String(config.project_ref)}` };
  },
  async set(name, value, config) {
    const ref = String(config.project_ref);
    const secretName = String(config.secret_name ?? name);
    // supabase secrets set takes NAME=VALUE on argv — secret will appear in the process list briefly.
    // Acceptable for now; a future enhancement could use the Management API directly.
    const r = await run(["supabase", "secrets", "set", `${secretName}=${value}`, "--project-ref", ref]);
    if (!r.ok) return { ok: false, detail: `supabase secrets set failed: ${r.stderr.trim()}` };
    return { ok: true, detail: `Set Supabase secret ${secretName} on ${ref}` };
  },
};
