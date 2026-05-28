import type { Destination } from "../types.ts";
import { run, runWithStdin, hasCommand, nowIso } from "../util.ts";

/**
 * 1Password destination — the canonical source of truth.
 * - Looks up an item by title in the configured vault.
 * - If it exists, updates the `credential` (password) field + adds rotated_at + previous_revoked metadata.
 * - If not, creates a new "API Credential" item.
 *
 * Config keys (set via [destinations.onepassword] in keyrotate.toml, OR
 * passed per-rotation via the rotation's `title` field):
 *   vault     — 1Password vault name (default: "Private")
 *   title     — item title (required; usually pulled from the rotation config)
 *   tags      — comma-separated tags
 *   category  — 1Password category, default "API Credential"
 *   field     — which field stores the secret; default "credential"
 */
export const onepassword: Destination = {
  id: "onepassword",
  label: "1Password",

  async check(config) {
    if (!(await hasCommand("op"))) {
      return { ok: false, detail: "1Password CLI 'op' not found — install from https://1password.com/downloads/command-line" };
    }
    // Confirm we're signed in / can list vaults
    const r = await run(["op", "vault", "list", "--format=json"]);
    if (!r.ok) return { ok: false, detail: "Not signed in to 1Password. Run: op signin" };
    const vault = (config.vault as string) ?? "Private";
    if (!r.stdout.includes(`"name": "${vault}"`) && !r.stdout.includes(`"name":"${vault}"`)) {
      return { ok: false, detail: `Vault "${vault}" not found in this account` };
    }
    return { ok: true, detail: `1Password ready (vault: ${vault})` };
  },

  async set(_name, value, config) {
    const vault = (config.vault as string) ?? "Private";
    const title = config.title as string;
    if (!title) return { ok: false, detail: "1Password destination requires a 'title' (set per rotation)" };
    const category = (config.category as string) ?? "API Credential";
    const field = (config.field as string) ?? "credential";
    const tags = (config.tags as string) ?? "keyrotate";

    // Does the item exist? `op item get` returns non-zero if not found.
    const probe = await run(["op", "item", "get", title, "--vault", vault, "--format=json"]);

    if (probe.ok) {
      // Update existing item — pass the secret via stdin to keep it off argv.
      const upd = await runWithStdin(
        ["op", "item", "edit", title, "--vault", vault, `${field}[password]=-`, `rotated_at[text]=${nowIso()}`, `previous_revoked[text]=pending`],
        value,
      );
      if (!upd.ok) return { ok: false, detail: `op edit failed: ${upd.stderr.trim() || upd.stdout.trim()}` };
      return { ok: true, detail: `Updated 1Password item "${title}" (vault: ${vault})` };
    }

    // Create a new item.
    // `op item create` accepts --generate-password OR a field assignment;
    // we use the field assignment so we can store the user-provided secret.
    const create = await runWithStdin(
      ["op", "item", "create",
        `--category=${category}`,
        `--title=${title}`,
        `--vault=${vault}`,
        `--tags=${tags}`,
        `${field}[password]=-`,
        `rotated_at[text]=${nowIso()}`,
        `previous_revoked[text]=n/a`,
      ],
      value,
    );
    if (!create.ok) return { ok: false, detail: `op create failed: ${create.stderr.trim() || create.stdout.trim()}` };
    return { ok: true, detail: `Created 1Password item "${title}" (vault: ${vault})` };
  },
};
