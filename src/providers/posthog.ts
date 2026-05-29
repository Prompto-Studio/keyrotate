import type { Provider } from "../types.ts";
export const posthog: Provider = {
  id: "posthog",
  label: "PostHog",
  rotateUrl: "https://us.posthog.com/settings/user-api-keys",
  looksLikeKey: (v) => v.startsWith("phx_") || v.startsWith("phs_"),
  async verify(key) {
    const r = await fetch("https://us.i.posthog.com/api/users/@me/", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "PostHog authenticated" : `PostHog HTTP ${r.status}`, status: r.status };
  },
  /**
   * PostHog personal API key creation:
   * https://posthog.com/docs/api/personal-api-keys
   * POST /api/personal_api_keys/  with { label, scopes }
   */
  async create(oldKey) {
    const label = `keyrotate-${new Date().toISOString().slice(0, 10)}`;
    const r = await fetch("https://us.i.posthog.com/api/personal_api_keys/", {
      method: "POST",
      headers: { Authorization: `Bearer ${oldKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ label, scopes: ["*"] }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `PostHog create-key failed: HTTP ${r.status} ${t.slice(0, 200)}` };
    }
    const body = (await r.json()) as { value?: string; id?: string; key?: string };
    const value = body.value || body.key;
    if (!value) return { ok: false, detail: "PostHog create-key: response missing key value" };
    return { ok: true, key: value, id: body.id, detail: `PostHog created new key "${label}"` };
  },
  /**
   * DELETE /api/personal_api_keys/:id/
   * Note: id must be the UUID returned by create(), not the key value.
   */
  async revoke(oldKeyOrId) {
    if (oldKeyOrId.startsWith("phx_") || oldKeyOrId.startsWith("phs_")) {
      return { ok: false, detail: "PostHog revoke needs the key id (from create()); the value alone is not enough." };
    }
    const r = await fetch(`https://us.i.posthog.com/api/personal_api_keys/${encodeURIComponent(oldKeyOrId)}/`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${oldKeyOrId}` },
    });
    return { ok: r.ok, detail: r.ok ? `PostHog key ${oldKeyOrId} revoked` : `PostHog revoke failed: HTTP ${r.status}`, status: r.status };
  },
};
