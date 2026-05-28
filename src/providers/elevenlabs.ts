import type { Provider } from "../types.ts";
export const elevenlabs: Provider = {
  id: "elevenlabs", label: "ElevenLabs",
  rotateUrl: "https://elevenlabs.io/app/settings/api-keys",
  looksLikeKey: (v) => /^[a-f0-9]{32,}$/i.test(v) || v.length > 20,
  async verify(key) {
    const r = await fetch("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": key } });
    return { ok: r.ok, detail: r.ok ? "ElevenLabs authenticated" : `ElevenLabs HTTP ${r.status}`, status: r.status };
  },
};
