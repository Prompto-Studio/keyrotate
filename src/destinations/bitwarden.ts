import type { Destination } from "../types.ts";
import { run, runWithStdin, hasCommand, nowIso } from "../util.ts";

/**
 * Bitwarden destination — alternative canonical vault for teams already on
 * Bitwarden / Vaultwarden, and the recommended vault for headless server use
 * (1Password's `op` CLI wants biometrics; `bw` works fully unattended via
 * env-injected API key auth).
 *
 * Config keys (set via [destinations.bitwarden] in keyrotate.toml, OR
 * passed per-rotation via the rotation's `title` field):
 *   title     — item name (required; usually pulled from the rotation config)
 *   folder    — Bitwarden folder name (optional, default: none)
 *   notes     — extra notes appended to the item (optional)
 *
 * Headless / server-side auth (no interactive prompts):
 *   export BW_CLIENTID="user.xxxxxx"          # from bitwarden.com/settings/security/keys
 *   export BW_CLIENTSECRET="xxxxx"
 *   export BW_PASSWORD="vault master password"
 *   bw login --apikey
 *   export BW_SESSION="$(bw unlock --passwordenv BW_PASSWORD --raw)"
 *
 * Once BW_SESSION is in the environment, keyrotate can write to Bitwarden
 * without any further interactive input — ideal for cron / systemd units.
 */
export const bitwarden: Destination = {
  id: "bitwarden",
  label: "Bitwarden",

  async check(_config) {
    if (!(await hasCommand("bw"))) {
      return {
        ok: false,
        detail:
          "Bitwarden CLI 'bw' not found — install via `npm install -g @bitwarden/cli` or `brew install bitwarden-cli`",
      };
    }
    // bw status is the cheapest call that reports auth + lock state
    const r = await run(["bw", "status"]);
    if (!r.ok) {
      return { ok: false, detail: "bw status failed — try: bw login" };
    }
    // Parse the JSON status. Possible values: unauthenticated, locked, unlocked.
    let status: string;
    try {
      status = (JSON.parse(r.stdout) as { status: string }).status;
    } catch {
      status = "unknown";
    }
    if (status === "unauthenticated") {
      return {
        ok: false,
        detail: "Not signed in to Bitwarden. Run: bw login (or bw login --apikey with BW_CLIENTID/BW_CLIENTSECRET set)",
      };
    }
    if (status === "locked") {
      return {
        ok: false,
        detail: "Bitwarden vault is locked. Run: export BW_SESSION=\"$(bw unlock --raw)\"",
      };
    }
    return { ok: true, detail: "Bitwarden ready (unlocked)" };
  },

  async set(_name, value, config) {
    const title = config.title as string;
    if (!title) {
      return { ok: false, detail: "Bitwarden destination requires a 'title' (set per rotation)" };
    }

    // Sync first so we see the latest server state.
    await run(["bw", "sync"]);

    // Probe: does an item with this name already exist?
    const probe = await run(["bw", "get", "item", title]);

    if (probe.ok) {
      // Update: edit the existing item. bw expects the full encoded item JSON via stdin.
      let item: Record<string, unknown>;
      try {
        item = JSON.parse(probe.stdout);
      } catch {
        return { ok: false, detail: "Could not parse existing Bitwarden item JSON" };
      }
      // Mutate the password field of the login object.
      const login = (item.login as Record<string, unknown>) ?? {};
      login.password = value;
      item.login = login;
      // Append a rotation note to the existing notes (keyrotate never logs the secret value).
      const stamp = `keyrotate: rotated_at=${nowIso()}`;
      item.notes = item.notes ? `${item.notes}\n${stamp}` : stamp;

      const encoded = Buffer.from(JSON.stringify(item)).toString("base64");
      const upd = await run(["bw", "edit", "item", item.id as string, encoded]);
      if (!upd.ok) {
        return { ok: false, detail: `bw edit failed: ${upd.stderr.trim() || upd.stdout.trim()}` };
      }
      await run(["bw", "sync"]);
      return { ok: true, detail: `Updated Bitwarden item "${title}"` };
    }

    // Create: build a new login item template, fill it, and encode it.
    const tplRaw = await run(["bw", "get", "template", "item"]);
    if (!tplRaw.ok) {
      return { ok: false, detail: "Could not fetch bw item template" };
    }
    let tpl: Record<string, unknown>;
    try {
      tpl = JSON.parse(tplRaw.stdout);
    } catch {
      return { ok: false, detail: "Could not parse bw item template" };
    }
    tpl.type = 1; // 1 = login
    tpl.name = title;
    tpl.login = { username: "", password: value, totp: null, uris: [] };
    tpl.notes = `keyrotate: created_at=${nowIso()}` + (config.notes ? `\n${config.notes}` : "");

    if (config.folder) {
      // Look up folder id by name.
      const folders = await run(["bw", "list", "folders"]);
      if (folders.ok) {
        try {
          const fs = JSON.parse(folders.stdout) as Array<{ id: string; name: string }>;
          const folder = fs.find((f) => f.name === config.folder);
          if (folder) tpl.folderId = folder.id;
        } catch {
          /* non-fatal — create without folder */
        }
      }
    }

    const encoded = Buffer.from(JSON.stringify(tpl)).toString("base64");
    const create = await run(["bw", "create", "item", encoded]);
    if (!create.ok) {
      return { ok: false, detail: `bw create failed: ${create.stderr.trim() || create.stdout.trim()}` };
    }
    await run(["bw", "sync"]);
    return { ok: true, detail: `Created Bitwarden item "${title}"` };
  },
};
