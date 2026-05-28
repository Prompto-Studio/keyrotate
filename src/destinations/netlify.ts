import type { Destination } from "../types.ts";
import { run, hasCommand } from "../util.ts";
export const netlifyDest: Destination = {
  id: "netlify", label: "Netlify env var",
  async check(config) {
    if (!(await hasCommand("netlify"))) return { ok: false, detail: "netlify CLI not installed" };
    if (!config.site) return { ok: false, detail: "destinations.netlify.site not set (site name or ID)" };
    return { ok: true, detail: `netlify ready, site ${String(config.site)}` };
  },
  async set(name, value, config) {
    const site = String(config.site);
    const envName = String(config.env_name ?? name);
    const ctx = (config.context as string) ?? "all";
    const r = await run(["netlify", "env:set", envName, value, "--site", site, "--context", ctx]);
    if (!r.ok) return { ok: false, detail: `netlify env:set failed: ${r.stderr.trim()}` };
    return { ok: true, detail: `Set Netlify env ${envName} on ${site} (${ctx})` };
  },
};
