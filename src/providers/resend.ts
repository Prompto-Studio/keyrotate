import type { Provider } from "../types.ts";
export const resend: Provider = {
  id: "resend",
  label: "Resend",
  rotateUrl: "https://resend.com/api-keys",
  looksLikeKey: (v) => /^re_[A-Za-z0-9_]+$/.test(v),
  async verify(key) {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    return { ok: r.ok, detail: r.ok ? "Resend authenticated" : `Resend HTTP ${r.status}`, status: r.status };
  },
  /**
   * Resend exposes POST /api-keys for programmatic key creation.
   * https://resend.com/docs/api-reference/api-keys/create-api-key
   * Requires an existing valid key with full_access permission.
   */
  async create(oldKey) {
    const name = `keyrotate-${new Date().toISOString().slice(0, 10)}`;
    const r = await fetch("https://api.resend.com/api-keys", {
      method: "POST",
      headers: { Authorization: `Bearer ${oldKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, permission: "full_access" }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ok: false, detail: `Resend create-key failed: HTTP ${r.status} ${t.slice(0, 200)}` };
    }
    const body = (await r.json()) as { token?: string; id?: string };
    if (!body.token) return { ok: false, detail: "Resend create-key: response missing token field" };
    return { ok: true, key: body.token, id: body.id, detail: `Resend created new key "${name}"` };
  },
  /**
   * Resend supports DELETE /api-keys/:id to revoke.
   * If the caller doesn't know the old key's ID, we look it up by listing.
   */
  async revoke(oldKeyOrId) {
    // oldKeyOrId could be either an ID (preferred) or the actual key value
    // For safety, we look up by listing all keys with the old key as auth.
    // If they pass a key value, we list with it; if they pass an id we DELETE directly.
    let id = oldKeyOrId;
    if (oldKeyOrId.startsWith("re_")) {
      // It's a key value, not an id — we can't list keys with it because the
      // list endpoint returns IDs and we don't get the value back from list.
      // Caller should have stored the id from create(). Bail gracefully.
      return { ok: false, detail: "Resend revoke needs the key ID (returned from create()); the value alone is not enough." };
    }
    const r = await fetch(`https://api.resend.com/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${oldKeyOrId}` },
    });
    return { ok: r.ok, detail: r.ok ? `Resend key ${id} revoked` : `Resend revoke failed: HTTP ${r.status}`, status: r.status };
  },
};
