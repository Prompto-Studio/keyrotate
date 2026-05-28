import type { Destination } from "../types.ts";
import { onepassword } from "./onepassword.ts";
import { github } from "./github.ts";
import { supabaseDest } from "./supabase.ts";
import { netlifyDest } from "./netlify.ts";
import { flyio } from "./flyio.ts";
import { envfile } from "./envfile.ts";

const REGISTRY: Destination[] = [onepassword, github, supabaseDest, netlifyDest, flyio, envfile];
export function getDestination(id: string): Destination | null {
  return REGISTRY.find((d) => d.id === id) ?? null;
}
export function listDestinations(): Destination[] { return REGISTRY; }
