import type { Destination } from "../types.ts";
import { run, hasCommand } from "../util.ts";
export const flyio: Destination = {
  id: "flyio", label: "Fly.io app secret",
  async check(config) {
    if (!(await hasCommand("flyctl"))) return { ok: false, detail: "flyctl not installed" };
    if (!config.app) return { ok: false, detail: "destinations.flyio.app not set" };
    return { ok: true, detail: `flyctl ready, app ${String(config.app)}` };
  },
  async set(name, value, config) {
    const app = String(config.app);
    const secretName = String(config.secret_name ?? name);
    const r = await run(["flyctl", "secrets", "set", `${secretName}=${value}`, "--app", app, "--stage"]);
    if (!r.ok) return { ok: false, detail: `flyctl secrets set failed: ${r.stderr.trim()}` };
    return { ok: true, detail: `Staged Fly.io secret ${secretName} on ${app} (deploy to apply)` };
  },
};
