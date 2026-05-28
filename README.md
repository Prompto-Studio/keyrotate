# keyrotate

One-command API-key rotation for solo founders and small teams. Rotates a key in **1Password** (canonical source of truth), then propagates the new value to every place it's used — GitHub Actions secrets, Supabase Edge Function secrets, Netlify env vars, Fly.io app secrets, local `.env` files — and **verifies** the new key against the upstream provider.

## Status
`v0.1` — active development by [BotFlow Lab](https://promptostudio.ai). Used internally for Prompto Studio AI.

## What it does
```
$ keyrotate rotate resend-alerts

  Provider: Resend (re_…)
  Destinations: 1password, github(...), supabase(...)

  ▸ Open https://resend.com/api-keys, paste new key:
    [paste re_NEW]
  ✓ Validated against Resend (HTTP 200)
  ✓ Updated 1Password item "Prompto · Resend Alerts"
  ✓ Set GitHub secret RESEND_API_KEY
  ✓ Set Supabase secret RESEND_API_KEY
  ✓ Ran test workflow → success (10s)
  ? Revoke previous key now? [Y/n] y

  Done in 24s.
```

## Install (from source)
```bash
git clone https://github.com/botflowlab/keyrotate.git
cd keyrotate && bun install && bun run build
sudo ln -sf "$(pwd)/dist/keyrotate" /usr/local/bin/keyrotate
```

## Per-project config (`keyrotate.toml`)
See `keyrotate.example.toml` for the full schema. Minimal:
```toml
[defaults]
op_vault = "Private"

[rotations.resend-alerts]
provider = "resend"
title = "Prompto · Resend Alerts"
destinations = ["onepassword", "github", "supabase"]

[destinations.github]
repo = "owner/repo"
secret_name = "RESEND_API_KEY"

[destinations.supabase]
project_ref = "xxx"
secret_name = "RESEND_API_KEY"
```

## Providers
`resend`, `openai`, `google-cloud`, `fal`, `elevenlabs`, `stripe`, `flyio`, `supabase`, `netlify`, `huggingface`, `backblaze`, `posthog`, `abuseipdb`, `dropbox`, `google-oauth`, `generic`.

## Destinations
**1Password** (default canonical), **GitHub Actions secrets**, **Supabase Edge Function secrets**, **Netlify env vars**, **Fly.io app secrets**, **local `.env` files**.

## Requirements
- macOS / Linux on Apple Silicon or x64
- `bun` (only to build — runtime binary is standalone)
- `op` (1Password CLI) when using `1password` destination
- `gh`, `supabase`, `netlify`, `flyctl` — only the ones you actually use

## License
MIT © BotFlow Lab
