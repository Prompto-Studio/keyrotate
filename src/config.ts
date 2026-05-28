import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import toml from "@iarna/toml";
import type { KeyrotateConfig } from "./types.ts";

export function findConfigPath(start: string = process.cwd()): string | null {
  let dir = start;
  for (let i = 0; i < 16; i++) {
    const p = join(dir, "keyrotate.toml");
    if (existsSync(p)) return p;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
export function loadConfig(path: string): KeyrotateConfig {
  const raw = readFileSync(path, "utf8");
  const parsed = toml.parse(raw) as unknown as KeyrotateConfig;
  if (!parsed.rotations || typeof parsed.rotations !== "object") {
    throw new Error(`No [rotations.*] tables found in ${path}`);
  }
  if (!parsed.destinations || typeof parsed.destinations !== "object") parsed.destinations = {};
  for (const [name, r] of Object.entries(parsed.rotations)) {
    (r as { name?: string }).name = name;
  }
  return parsed;
}
