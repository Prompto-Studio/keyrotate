import type { Provider } from "../types.ts";

/**
 * Rotates the client_secret for an Azure AD / Entra ID app registration.
 * tenant_id + client_id are static, declared in [providers.microsoft365] —
 * they never rotate. Only the client_secret changes.
 *
 * Verify: client_credentials OAuth flow against the tenant's v2 endpoint.
 *
 * Config:
 *   [providers.microsoft365]
 *   tenant_id = "your-tenant-uuid"
 *   client_id = "your-app-uuid"
 *   scope     = "https://graph.microsoft.com/.default"   # optional, default shown
 */
export const microsoft365: Provider = {
  id: "microsoft365",
  label: "Microsoft 365 / Entra ID (client secret)",
  rotateUrl: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
  configKeys: ["tenant_id", "client_id", "scope"],
  async verify(clientSecret, opts) {
    const tenantId = opts?.tenant_id;
    const clientId = opts?.client_id;
    const scope = (opts?.scope as string) ?? "https://graph.microsoft.com/.default";
    if (!tenantId || !clientId) {
      return { ok: false, detail: "Missing tenant_id or client_id in [providers.microsoft365]" };
    }
    const r = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }).toString(),
    });
    if (r.ok) return { ok: true, detail: "Microsoft 365 client_credentials grant succeeded", status: r.status };
    const err: { error?: string; error_description?: string } = await r.json().catch(() => ({}));
    return { ok: false, detail: `Microsoft 365 ${r.status} ${err.error ?? ""}: ${(err.error_description ?? "").slice(0, 120)}`.trim(), status: r.status };
  },
};
