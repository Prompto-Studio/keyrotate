import type { Provider } from "../types.ts";
export const supabase: Provider = {
  id: "supabase", label: "Supabase Management API",
  rotateUrl: "https://supabase.com/dashboard/account/tokens",
  looksLikeKey: (v) => v.startsWith("sbp_"),
  async verify(key) {
    const r = await fetch("https://api.supabase.com/v1/projects", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "Supabase Management API authenticated" : `Supabase HTTP ${r.status}`, status: r.status };
  },
};
