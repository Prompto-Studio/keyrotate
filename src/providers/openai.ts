import type { Provider } from "../types.ts";
export const openai: Provider = {
  id: "openai", label: "OpenAI",
  rotateUrl: "https://platform.openai.com/api-keys",
  looksLikeKey: (v) => /^sk-[A-Za-z0-9-_]{20,}$/.test(v),
  async verify(key) {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "OpenAI authenticated" : `OpenAI HTTP ${r.status}`, status: r.status };
  },
};
