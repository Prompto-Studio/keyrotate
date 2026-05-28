import type { Provider } from "../types.ts";
export const anthropic: Provider = {
  id: "anthropic", label: "Anthropic (Claude)",
  rotateUrl: "https://console.anthropic.com/settings/keys",
  looksLikeKey: (v) => /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v),
  async verify(key) {
    // /v1/messages with an empty body returns 400 if auth is OK; 401 if not.
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    });
    const ok = r.status !== 401 && r.status !== 403;
    return { ok, detail: ok ? "Anthropic authenticated" : `Anthropic HTTP ${r.status}`, status: r.status };
  },
};
