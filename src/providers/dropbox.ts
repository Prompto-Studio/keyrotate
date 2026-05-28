import type { Provider } from "../types.ts";
export const dropbox: Provider = {
  id: "dropbox", label: "Dropbox access token",
  rotateUrl: "https://www.dropbox.com/developers/apps",
  looksLikeKey: (v) => /^sl\.[A-Za-z0-9_-]{40,}$/.test(v),
  async verify(key) {
    const r = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
    });
    return { ok: r.ok, detail: r.ok ? "Dropbox authenticated" : `Dropbox HTTP ${r.status}`, status: r.status };
  },
};
