import type { Provider } from "../types.ts";
export const posthog: Provider = {
  id: "posthog", label: "PostHog",
  rotateUrl: "https://us.posthog.com/settings/user-api-keys",
  looksLikeKey: (v) => v.startsWith("phx_") || v.startsWith("phs_"),
  async verify(key) {
    const r = await fetch("https://us.i.posthog.com/api/users/@me/", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "PostHog authenticated" : `PostHog HTTP ${r.status}`, status: r.status };
  },
};
