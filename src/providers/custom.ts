import type { Provider, CustomProviderSpec } from "../types.ts";

/**
 * Build a Provider on the fly from a user-declared spec in keyrotate.toml.
 * This is the long-tail solver: anyone can wire a provider we don't ship by
 * declaring [providers.custom.<id>] with a verify_url + verify_auth.
 */
export function buildCustomProvider(id: string, spec: CustomProviderSpec): Provider {
  const okStatuses = spec.ok_statuses ?? null;
  return {
    id: `custom:${id}`,
    label: spec.label || id,
    rotateUrl: spec.rotate_url,
    looksLikeKey: spec.key_prefix ? (v: string) => v.startsWith(spec.key_prefix!) : undefined,
    async verify(key) {
      const auth = spec.verify_auth.replace("${KEY}", key);
      const [headerName, ...rest] = auth.includes(":") ? auth.split(":") : ["Authorization", auth];
      const headerValue = rest.join(":").trim() || auth;
      const r = await fetch(spec.verify_url, {
        method: spec.verify_method ?? "GET",
        headers: { [headerName.trim()]: headerValue },
      });
      const ok = okStatuses ? okStatuses.includes(r.status) : r.ok;
      return { ok, detail: ok ? `${spec.label} authenticated` : `${spec.label} HTTP ${r.status}`, status: r.status };
    },
  };
}
