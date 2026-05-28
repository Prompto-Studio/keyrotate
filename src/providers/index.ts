import type { Provider, KeyrotateConfig } from "../types.ts";
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
import { anthropic } from "./anthropic.ts";
import { aws } from "./aws.ts";
import { cloudflare } from "./cloudflare.ts";
import { dropbox } from "./dropbox.ts";
import { githubPat } from "./github-pat.ts";
import { vercel } from "./vercel.ts";
import { googleWorkspace } from "./google-workspace.ts";
import { microsoft365 } from "./microsoft365.ts";
import { zoho } from "./zoho.ts";
import { generic } from "./generic.ts";
import { buildCustomProvider } from "./custom.ts";

const BUILTIN: Provider[] = [
  resend, openai, anthropic, googleCloud, googleWorkspace, fal, elevenlabs, stripe,
  netlify, supabase, huggingface, posthog, abuseipdb,
  aws, cloudflare, dropbox, githubPat, vercel,
  microsoft365, zoho,
  generic,
];

/** Get a provider by id, including custom ones loaded from config. */
export function getProvider(id: string, cfg?: KeyrotateConfig | null): Provider | null {
  const builtin = BUILTIN.find((p) => p.id === id);
  if (builtin) return builtin;
  // Custom providers declared in [providers.custom.<id>]
  if (cfg?.providers?.custom && id in cfg.providers.custom) {
    return buildCustomProvider(id, cfg.providers.custom[id]!);
  }
  // Also accept the "custom:" prefix.
  if (id.startsWith("custom:") && cfg?.providers?.custom) {
    const realId = id.slice("custom:".length);
    if (realId in cfg.providers.custom) {
      return buildCustomProvider(realId, cfg.providers.custom[realId]!);
    }
  }
  return null;
}

export function listProviders(cfg?: KeyrotateConfig | null): Provider[] {
  const out = [...BUILTIN];
  if (cfg?.providers?.custom) {
    for (const [id, spec] of Object.entries(cfg.providers.custom)) {
      out.push(buildCustomProvider(id, spec));
    }
  }
  return out;
}
