import type { Provider } from "../types.ts";
export const netlify: Provider = {
  id: "netlify",
  label: "Netlify",
  rotateUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
  async verify(key) {
    const r = await fetch("https://api.netlify.com/api/v1/user", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "Netlify authenticated" : `Netlify HTTP ${r.status}`, status: r.status };
  },
  /**
   * Netlify exposes POST /api/v1/oauth/applications/create_token but it
   * requires OAuth app credentials, not a PAT-for-PAT swap. There is no
   * documented public endpoint that mints a new PAT using an existing PAT.
   * We deliberately omit create() here so the auto-rotate flow gracefully
   * falls back to the paste flow. See server-install.html for OAuth setup.
   */
};
