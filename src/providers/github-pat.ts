import type { Provider } from "../types.ts";
export const githubPat: Provider = {
  id: "github-pat", label: "GitHub Personal Access Token",
  rotateUrl: "https://github.com/settings/tokens",
  looksLikeKey: (v) => /^(ghp|github_pat)_[A-Za-z0-9_]{20,}$/.test(v),
  async verify(key) {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": "keyrotate" },
    });
    if (!r.ok) return { ok: false, detail: `GitHub HTTP ${r.status}`, status: r.status };
    const j: { login?: string } = await r.json().catch(() => ({}));
    return { ok: true, detail: `GitHub authenticated as ${j.login ?? "?"}`, status: r.status };
  },
};
