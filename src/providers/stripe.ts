import type { Provider } from "../types.ts";
export const stripe: Provider = {
  id: "stripe", label: "Stripe",
  rotateUrl: "https://dashboard.stripe.com/apikeys",
  looksLikeKey: (v) => /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/.test(v),
  async verify(key) {
    const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "Stripe authenticated" : `Stripe HTTP ${r.status}`, status: r.status };
  },
};
