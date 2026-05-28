import type { Destination } from "../types.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Writes/updates `NAME=VALUE` in a .env file. Idempotent. */
export const envfile: Destination = {
  id: "envfile", label: "Local .env file",
  async check(config) {
    if (!config.path) return { ok: false, detail: "destinations.envfile.path not set" };
    return { ok: true, detail: `envfile target: ${resolve(String(config.path))}` };
  },
  async set(name, value, config) {
    const p = resolve(String(config.path));
    const envName = String(config.env_name ?? name);
    let body = existsSync(p) ? readFileSync(p, "utf8") : "";
    const re = new RegExp(`^${envName}=.*$`, "m");
    const line = `${envName}=${value}`;
    body = re.test(body) ? body.replace(re, line) : (body + (body.endsWith("\n") || !body ? "" : "\n") + line + "\n");
    writeFileSync(p, body, { encoding: "utf8", mode: 0o600 });
    return { ok: true, detail: `Wrote ${envName} to ${p}` };
  },
};
