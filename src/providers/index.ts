import type { Provider } from "../types.ts";
import { resend } from "./resend.ts";
import { openai } from "./openai.ts";
import { googleCloud } from "./google-cloud.ts";
import { fal } from "./fal.ts";
import { elevenlabs } from "./elevenlabs.ts";
import { stripe } from "./stripe.ts";
import { netlify } from "./netlify.ts";
import { supabase } from "./supabase.ts";
import { huggingface } from "./huggingface.ts";
import { posthog } from "./posthog.ts";
import { abuseipdb } from "./abuseipdb.ts";
import { generic } from "./generic.ts";

const REGISTRY: Provider[] = [
  resend, openai, googleCloud, fal, elevenlabs, stripe,
  netlify, supabase, huggingface, posthog, abuseipdb, generic,
];
export function getProvider(id: string): Provider | null {
  return REGISTRY.find((p) => p.id === id) ?? null;
}
export function listProviders(): Provider[] { return REGISTRY; }
