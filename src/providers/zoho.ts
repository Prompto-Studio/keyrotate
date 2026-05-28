import type { Provider } from "../types.ts";

/**
 * Rotates a Zoho OAuth refresh token. client_id + client_secret are static in
 * [providers.zoho] — they don't rotate. The refresh token does.
 *
 * Verify: exchange the new refresh_token for an access_token.
 *
 * Config:
 *   [providers.zoho]
 *   client_id     = "1000.xxx"
 *   client_secret = "yyy"
 *   region        = "com"          # com (US), eu, in, com.au, com.cn (varies by where you registered)
 */
export const zoho: Provider = {
  id: "zoho",
  label: "Zoho (OAuth refresh token)",
  rotateUrl: "https://api-console.zoho.com",
  looksLikeKey: (v) => v.startsWith("1000."),
  configKeys: ["client_id", "client_secret", "region"],
  async verify(refreshToken, opts) {
    const clientId = opts?.client_id;
    const clientSecret = opts?.client_secret;
    const region = (opts?.region as string) ?? "com";
    if (!clientId || !clientSecret) {
      return { ok: false, detail: "Missing client_id or client_secret in [providers.zoho]" };
    }
    const r = await fetch(`https://accounts.zoho.${region}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    const j: { access_token?: string; error?: string } = await r.json().catch(() => ({}));
    if (r.ok && j.access_token) return { ok: true, detail: "Zoho refresh token exchanged successfully", status: r.status };
    return { ok: false, detail: `Zoho ${r.status} ${j.error ?? "unknown error"}`, status: r.status };
  },
};
