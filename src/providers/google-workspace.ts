import type { Provider } from "../types.ts";

/**
 * Rotates a Google Workspace service-account JSON keyfile.
 *
 * Flow:
 *   1. User pastes the path to a downloaded service-account JSON file.
 *   2. We parse it, validate client_email + private_key are present.
 *   3. Sign a JWT with the private key, exchange for an access token.
 *   4. Hit Admin SDK directory.users.list to confirm scope + creds work.
 *
 * Stored value: the entire JSON file contents (multi-line — 1Password
 * handles it fine in a password field).
 *
 * Config:
 *   [providers.google-workspace]
 *   scopes = "https://www.googleapis.com/auth/admin.directory.user.readonly"
 *   subject = "admin@yourdomain.com"   # the user the service account impersonates
 */
export const googleWorkspace: Provider = {
  id: "google-workspace",
  label: "Google Workspace (service account)",
  rotateUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts",
  inputMode: "file",
  configKeys: ["scopes", "subject"],
  async verify(jsonContents, opts) {
    let sa: { client_email?: string; private_key?: string; token_uri?: string };
    try { sa = JSON.parse(jsonContents); }
    catch { return { ok: false, detail: "Provided file is not valid JSON" }; }
    if (!sa.client_email || !sa.private_key) {
      return { ok: false, detail: "JSON missing client_email or private_key — not a service account keyfile" };
    }
    const scopes = (opts?.scopes as string) ?? "https://www.googleapis.com/auth/admin.directory.user.readonly";
    const subject = opts?.subject as string | undefined;

    try {
      const now = Math.floor(Date.now() / 1000);
      const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      const claim: Record<string, unknown> = {
        iss: sa.client_email,
        scope: scopes,
        aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
        iat: now, exp: now + 3600,
      };
      if (subject) claim.sub = subject;
      const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      const signingInput = `${header}.${claimB64}`;

      // Convert PEM private key → CryptoKey
      const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, "");
      const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8", der.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
      );
      const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput));
      const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
      const jwt = `${signingInput}.${sigB64}`;

      const tokenRes = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(jwt)}`,
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return { ok: false, detail: `Token exchange failed: ${tokenRes.status} ${err.slice(0, 200)}`, status: tokenRes.status };
      }
      return { ok: true, detail: `Google Workspace authenticated as ${sa.client_email}`, status: tokenRes.status };
    } catch (e) {
      return { ok: false, detail: `JWT sign/exchange failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};
