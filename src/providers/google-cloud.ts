import type { Provider } from "../types.ts";
export const googleCloud: Provider = {
  id: "google-cloud", label: "Google Cloud (Gemini/Imagen/Veo)",
  rotateUrl: "https://aistudio.google.com/app/apikey",
  looksLikeKey: (v) => /^AIza[A-Za-z0-9_-]{20,}$/.test(v),
  async verify(key) {
    // Lists models — cheap & requires the key.
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    return { ok: r.ok, detail: r.ok ? "Google Generative Language API authenticated" : `Google API HTTP ${r.status}`, status: r.status };
  },
};
