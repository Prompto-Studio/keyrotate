import type { Provider } from "../types.ts";
export const resend: Provider = {
  id: "resend", label: "Resend",
  rotateUrl: "https://resend.com/api-keys",
  looksLikeKey: (v) => /^re_[A-Za-z0-9_]+$/.test(v),
  async verify(key) {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "Resend authenticated" : `Resend HTTP ${r.status}`, status: r.status };
  },
};
