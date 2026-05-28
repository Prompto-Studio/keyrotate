import type { Provider } from "../types.ts";
export const vercel: Provider = {
  id: "vercel", label: "Vercel access token",
  rotateUrl: "https://vercel.com/account/tokens",
  async verify(key) {
    const r = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: r.ok, detail: r.ok ? "Vercel authenticated" : `Vercel HTTP ${r.status}`, status: r.status };
  },
};
