import type { Provider } from "../types.ts";
export const cloudflare: Provider = {
  id: "cloudflare", label: "Cloudflare API token",
  rotateUrl: "https://dash.cloudflare.com/profile/api-tokens",
  async verify(key) {
    const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const j: { success?: boolean; result?: { status?: string } } = await r.json().catch(() => ({}));
    const ok = r.ok && j.success === true && j.result?.status === "active";
    return { ok, detail: ok ? "Cloudflare token active" : `Cloudflare ${r.status} ${j.result?.status ?? ""}`.trim(), status: r.status };
  },
};
