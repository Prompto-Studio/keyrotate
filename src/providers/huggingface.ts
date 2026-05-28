import type { Provider } from "../types.ts";
export const huggingface: Provider = {
  id: "huggingface", label: "HuggingFace",
  rotateUrl: "https://huggingface.co/settings/tokens",
  looksLikeKey: (v) => v.startsWith("hf_"),
  async verify(key) {
    const r = await fetch("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "HuggingFace authenticated" : `HF HTTP ${r.status}`, status: r.status };
  },
};
