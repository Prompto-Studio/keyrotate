import type { Destination } from "../types.ts";
import { run, runWithStdin, hasCommand } from "../util.ts";
export const github: Destination = {
  id: "github", label: "GitHub Actions secret",
  async check(config) {
    if (!(await hasCommand("gh"))) return { ok: false, detail: "gh CLI not installed" };
    if (!config.repo) return { ok: false, detail: "destinations.github.repo not set in keyrotate.toml" };
    const r = await run(["gh", "auth", "status"]);
    if (!r.ok) return { ok: false, detail: "gh not authenticated: run `gh auth login`" };
    return { ok: true, detail: `gh ready, repo ${String(config.repo)}` };
  },
  async set(name, value, config) {
    const repo = String(config.repo);
    const secretName = String(config.secret_name ?? name);
    const r = await runWithStdin(["gh", "secret", "set", secretName, "--repo", repo, "--body", "-"], value);
    if (!r.ok) return { ok: false, detail: `gh secret set failed: ${r.stderr.trim()}` };
    return { ok: true, detail: `Set GitHub secret ${secretName} on ${repo}` };
  },
};
