import type { Provider } from "../types.ts";
export const netlify: Provider = {
  id: "netlify", label: "Netlify",
  rotateUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
  async verify(key) {
    const r = await fetch("https://api.netlify.com/api/v1/user", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "Netlify authenticated" : `Netlify HTTP ${r.status}`, status: r.status };
  },
};
