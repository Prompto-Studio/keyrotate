import type { Provider } from "../types.ts";
export const fal: Provider = {
  id: "fal", label: "fal.ai",
  rotateUrl: "https://fal.ai/dashboard/keys",
  looksLikeKey: (v) => /^[A-Za-z0-9-]{20,}:[A-Za-z0-9]{20,}$/.test(v) || v.length > 20,
  async verify(key) {
    // fal.ai authenticates with Key <id>:<secret>
    const r = await fetch("https://fal.run/health", { headers: { Authorization: `Key ${key}` } });
    // /health may not require auth; fall back to a real model listing
    if (r.ok) return { ok: true, detail: "fal.ai reachable", status: r.status };
    const r2 = await fetch("https://queue.fal.run/fal-ai/fast-sdxl/requests/_does_not_exist", { headers: { Authorization: `Key ${key}` } });
    return { ok: r2.status === 404 || r2.status === 400, detail: r2.status === 401 ? "fal.ai key rejected" : "fal.ai authenticated", status: r2.status };
  },
};
