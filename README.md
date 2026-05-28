<div align="center">

<img src="docs/wordmark.svg" alt="keyrotate" width="420"/>

### Rotate any API key in one command. Update 1Password, GitHub, Supabase, Netlify, Fly.io, and your `.env` in one shot — verified end-to-end.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with Bun](https://img.shields.io/badge/runtime-Bun-fbf0df.svg)](https://bun.sh)
[![macOS Apple Silicon](https://img.shields.io/badge/macOS-Apple%20Silicon-black?logo=apple)](#install)
[![Linux x64](https://img.shields.io/badge/Linux-x64-yellow?logo=linux)](#install)
[![Windows x64](https://img.shields.io/badge/Windows-x64-0078D6?logo=windows)](#on-windows)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#status)

**Stops you from getting halfway through an API-key rotation, breaking production, and forgetting which destinations you already updated.**

</div>

---

## The pain this solves

Rotating one API key isn't one step — it's six. Take Resend, used both by your backend and a GitHub Action:

1. Create the new key in the Resend dashboard
2. Update the secret in **GitHub Actions** (`gh secret set …`)
3. Update the secret in **Supabase Edge Functions** (`supabase secrets set …`)
4. Save the new key in **1Password** so you and your team don't lose it
5. **Verify** the new key actually works against the upstream API (a typo here = silent production outage)
6. Revoke the old key in the dashboard

Miss any of those and you've just shipped a half-rotated key. Either the alert path is broken, or the old key is still alive, or your team's vault is out of sync. Every solo founder eventually builds a sloppy bash script for this; we made a clean one.

```bash
$ keyrotate rotate resend-alerts

  Provider:     Resend
  Destinations: onepassword, github, supabase
  Create new at: https://resend.com/api-keys

  ✓ 1Password: 1Password ready (vault: Private)
  ✓ GitHub Actions secret: gh ready, repo Prompto-Studio/Prompto-Bot-Img
  ✓ Supabase Edge Function secret: supabase ready, project lubvpbxxwyy…

  ? Paste the new Resend key (hidden): ****

  ▸ Verifying against Resend…
  ✓ Resend authenticated
  ▸ Writing to 1Password (RESEND_API_KEY)…
  ✓ Updated 1Password item "Prompto · Resend Alerts" (vault: Private)
  ▸ Writing to GitHub Actions secret (RESEND_API_KEY)…
  ✓ Set GitHub secret RESEND_API_KEY on Prompto-Studio/Prompto-Bot-Img
  ▸ Writing to Supabase Edge Function secret (RESEND_API_KEY)…
  ✓ Set Supabase secret RESEND_API_KEY on lubvpbxxwyylzsnriorr
  ▸ Triggering post-rotate workflow .github/workflows/test-alerts.yml…
  ✓ Workflow triggered (check Actions tab)

  ✓ Rotation complete (3/3 destinations).
  ? Open https://resend.com/api-keys to revoke the old key now? [Y/n]
```

One command. ~30 seconds. Audit-logged. Verified.

---

## Why keyrotate over a bash script

| | Bash script | `keyrotate` |
|---|---|---|
| Verifies the new key *before* writing | ❌ | ✅ Hits the provider's API first; aborts if the key is rejected |
| Updates 1Password alongside the destinations | Maybe | ✅ Auto-creates the vault item if it doesn't exist, updates `rotated_at` if it does |
| Hidden-input prompt for the secret | If you remember `read -s` | ✅ Built-in, with paste-detection |
| Audit log of every rotation | ❌ | ✅ JSONL at `~/.config/keyrotate/audit.log` — grep, ship to SIEM, anything |
| Multi-rotation config in your repo | One script per key | ✅ One `keyrotate.toml` per project — every key your service uses, in one file |
| Per-destination overrides (e.g. `VITE_FOO` in `.env`, `FOO` in GitHub) | Manual | ✅ `[rotations.x.overrides.envfile] env_name = "VITE_FOO"` |
| Triggers a post-rotate verification workflow | If you remember | ✅ Configurable in `keyrotate.toml`, runs after success |
| Works across macOS Apple Silicon, Intel, Linux | Maybe | ✅ Single-binary, no Node/Bun needed at runtime |

---

## Install

### Easiest — `npx` (no install)

If you have Node.js 18+ on your Mac, you can run keyrotate without installing anything:

```bash
npx keyrotate setup       # interactive wizard
npx keyrotate rotate <name>
```

Each `npx` invocation downloads the right binary for your Mac (Apple Silicon or Intel) automatically. Good for trying it out.

### Recommended on macOS — `npm install -g`

If you'll use keyrotate more than once, install it globally so `keyrotate` and `kr` are always on your `PATH`:

```bash
# 1. Make sure Node.js is installed.
#    Check with: node --version    (need 18 or newer)
#    Install via Homebrew if missing:
brew install node

# 2. Install keyrotate
npm install -g keyrotate

# 3. Verify it works
keyrotate version
kr version                # `kr` is the short alias
```

That's it — `keyrotate` and `kr` now work in any terminal.

### On Windows

Same as macOS — pick `npx` for a one-off or `npm install -g` to make it permanent. Works in PowerShell, Command Prompt, or Windows Terminal:

```powershell
# Make sure Node.js 18+ is installed (https://nodejs.org or `winget install OpenJS.NodeJS.LTS`)
node --version

# One-off
npx keyrotate setup

# Or install globally
npm install -g keyrotate
keyrotate version
kr version
```

WSL2 users can use the macOS/Linux instructions instead — `npx keyrotate setup` works identically under Ubuntu/Debian WSL.

Before your first rotation on Windows, install the destination CLIs (use `winget` or each tool's official MSI):

```powershell
winget install 1Password.CLI       # `op`
winget install GitHub.CLI          # `gh`
winget install Supabase.CLI        # `supabase`
winget install Netlify.Netlify     # `netlify`
winget install Fly-io.flyctl       # `flyctl`
```

Sign each one in once (`op signin`, `gh auth login`, etc.) and you're set. 1Password unlock on Windows uses Windows Hello instead of Touch ID — otherwise the flow is identical to macOS.

### Homebrew *(once the tap is published — currently in setup)*

```bash
brew tap Prompto-Studio/homebrew-tap
brew install keyrotate
```

### Curl one-liner *(no Node, no Homebrew)*

```bash
curl -fsSL https://raw.githubusercontent.com/Prompto-Studio/keyrotate/main/scripts/install.sh | bash
```

Drops the binary at `~/bin/keyrotate` (and the `kr` short alias). Honors `KEYROTATE_INSTALL_DIR` and `KEYROTATE_REPO` if you want to override.

### From source

```bash
git clone https://github.com/Prompto-Studio/keyrotate.git
cd keyrotate && bun install && bun run build
ln -sf "$(pwd)/dist/keyrotate" ~/bin/keyrotate
ln -sf "$(pwd)/dist/keyrotate" ~/bin/kr
```

Requires [Bun](https://bun.sh) 1.2+ to build (not at runtime — the binary is standalone).

### Before your first rotation

You'll also need these CLIs signed in (only the ones for destinations you actually use):

```bash
brew install --cask 1password-cli   # `op` — 1Password vault
brew install gh                     # GitHub Actions secrets
brew install supabase/tap/supabase  # Supabase Edge Function secrets
brew install netlify-cli            # Netlify env vars
brew install flyctl                 # Fly.io app secrets

# Sign each one in once:
op signin
gh auth login
supabase login
netlify login
flyctl auth login
```

Then run `keyrotate setup` (interactive wizard) or `keyrotate init` (write a starter `keyrotate.toml`).

---

## Quick start

```bash
cd /path/to/your/project
keyrotate init                  # scaffolds keyrotate.toml
$EDITOR keyrotate.toml          # define your rotations
keyrotate list                  # show all rotations
keyrotate rotate <name>         # rotate a key (interactive)
keyrotate audit                 # show rotation history
```

---

## Core concepts

**Rotation** = a (provider × destinations × secret-name) tuple you'll rotate as a unit. You define them once in `keyrotate.toml`; you trigger them by name.

**Provider** = how `keyrotate` knows that a value *works* — a cheap, idempotent HTTP call to the upstream service. Verifies the new key **before** anything is written anywhere.

**Destination** = where the new value gets written. Always 1Password (the canonical truth), plus whichever CI / runtime / hosting platforms actually need the value.

---

## Supported providers

Each provider knows how to verify that a candidate key actually works against the upstream service. New providers are ~30 lines each — PRs welcome.

| Provider | ID | Verifier endpoint |
|---|---|---|
| Resend | `resend` | `GET /domains` |
| OpenAI | `openai` | `GET /v1/models` |
| Google Cloud (Gemini, Imagen, Veo) | `google-cloud` | `GET /v1beta/models` |
| fal.ai | `fal` | `GET /health` |
| ElevenLabs | `elevenlabs` | `GET /v1/user` |
| Stripe | `stripe` | `GET /v1/balance` |
| Netlify | `netlify` | `GET /api/v1/user` |
| Supabase Management API | `supabase` | `GET /v1/projects` |
| HuggingFace | `huggingface` | `GET /api/whoami-v2` |
| PostHog | `posthog` | `GET /api/users/@me` |
| AbuseIPDB | `abuseipdb` | `GET /api/v2/check` |
| Generic (no verifier) | `generic` | (skips verification) |

Coming soon: Anthropic, AWS, Cloudflare, Dropbox, Google OAuth, Backblaze B2, Fly.io tokens, GitHub PATs, Vercel.

---

## Supported destinations

| Destination | ID | CLI needed | What it does |
|---|---|---|---|
| **1Password** | `onepassword` | `op` | Default canonical store. Auto-creates the item if missing; updates `credential` + `rotated_at` metadata otherwise. |
| **GitHub Actions secrets** | `github` | `gh` | Repo-scoped Actions secret. |
| **Supabase Edge Function secrets** | `supabase` | `supabase` | Project-scoped function secret. |
| **Netlify env vars** | `netlify` | `netlify` | Per-context site env var. |
| **Fly.io app secrets** | `flyio` | `flyctl` | Staged with `--stage` (deploy to apply). |
| **Local `.env` file** | `envfile` | — | `NAME=VALUE` line, idempotent rewrite. Mode `0600`. |

---

## Configuration reference

A minimal `keyrotate.toml`:

```toml
[defaults]
op_vault = "Private"                   # 1Password vault for all rotations

[rotations.resend-alerts]
provider     = "resend"                # which provider plugin to use
title        = "Prompto · Resend Alerts"  # 1Password item title
secret_name  = "RESEND_API_KEY"        # secret name used by destinations
destinations = ["onepassword", "github", "supabase"]
postRotateWorkflow = ".github/workflows/test-alerts.yml"  # optional

[destinations.github]
repo = "owner/repo"

[destinations.supabase]
project_ref = "abcdefghij"

[destinations.onepassword]
vault = "Private"
```

A more complex rotation with **per-destination overrides** (rare but useful — e.g. the local `.env` uses `VITE_OPENAI_API_KEY` but Supabase uses `OPENAI_API_KEY`):

```toml
[rotations.openai]
provider     = "openai"
title        = "Prompto · OpenAI"
secret_name  = "OPENAI_API_KEY"
destinations = ["onepassword", "supabase", "envfile"]

[rotations.openai.overrides.envfile]
path     = ".env.local"
env_name = "VITE_OPENAI_API_KEY"

[destinations.envfile]
path = ".env.local"
```

Multiple Fly.io apps? Override `app` per rotation:

```toml
[rotations.fly-ffmpeg]
provider     = "flyio"
title        = "Prompto · Fly.io ffmpeg-svc"
destinations = ["onepassword", "flyio"]

[rotations.fly-ffmpeg.overrides.flyio]
app = "prompto-ffmpeg-svc"
```

---

## What `rotate` actually does, step by step

1. **Find config.** Walks up from cwd until it finds `keyrotate.toml`.
2. **Pre-flight every destination.** Does `gh auth status` succeed? Is `op` signed in? Is the configured vault reachable? Aborts before asking for the key if anything's missing.
3. **Hidden-input prompt** (`stty -echo`) for the new value, with paste-tolerance.
4. **Format check.** If the provider exposes a `looksLikeKey` predicate, sanity-check the format before going further.
5. **Verify against the provider.** Hits a cheap idempotent endpoint with the new key. **If this fails, nothing is written anywhere.** (This is the single most important thing keyrotate does.)
6. **Write to each destination in order.** Surfaces per-destination success/failure. Partial failures don't unwind earlier successes — you can re-run.
7. **Optional post-rotate workflow.** Triggers a GitHub Actions workflow via `gh workflow run` to verify the end-to-end path (e.g. our `test-alerts.yml` confirms the new Resend key actually delivers email).
8. **Audit log.** Appends a JSONL entry to `~/.config/keyrotate/audit.log` — timestamp, provider, destinations attempted/succeeded/failed, verifier result, operator.
9. **Offer to revoke.** Opens the provider's revocation page in your browser.

---

## A real-world example

[Prompto Studio AI](https://promptostudio.ai) — a solo-founder AI-video SaaS — runs 11 rotations through `keyrotate`: Resend, OpenAI, Google Cloud (Gemini/Imagen/Veo), fal.ai, ElevenLabs, Stripe, Netlify PAT, Supabase Management PAT, PostHog, HuggingFace, and AbuseIPDB. Each one writes to 1Password + the right combination of GitHub / Supabase / Netlify / Fly.io. A full rotation including post-rotate verification: ~30 seconds.

See [`examples/keyrotate.toml`](examples/keyrotate.toml) for the full Prompto config.

---

## Security model

- **Secrets never appear in process argv** for 1Password and GitHub — they're piped via stdin. (Supabase CLI and Fly.io CLI accept secrets via argv only; that's their interface — `ps` can briefly see them. PRs to use Management API directly are welcome.)
- **No telemetry.** Zero phone-home. The binary makes HTTP calls only to the provider you're verifying against and the destination CLIs you've configured.
- **No keys logged.** The audit log records `rotated_at`, outcome, destinations succeeded/failed — never the key value.
- **`.env` files written with mode 0600.**
- **1Password unlock uses your system biometrics** (Touch ID on macOS) via the `op` CLI. `keyrotate` never sees your master password.

---

## Roadmap

**v0.3 (next):**
- More provider verifiers (Anthropic, AWS, Cloudflare, Dropbox, Google OAuth, GitHub PATs)
- `keyrotate verify-all` — re-verify every key in `keyrotate.toml` (read-only health check)
- `keyrotate doctor` — diagnose missing CLIs / auth / scopes

**v0.4:**
- Bitwarden + LastPass destinations
- Slack notifications on rotation outcome
- Scheduled rotations via cron / GitHub Actions

**v1.0:**
- Stable plugin API for providers and destinations
- Homebrew core formula

---

## FAQ

**Why Bun instead of Node?** Single-binary compilation. `bun build --compile` ships a 60-80 MB statically-linked executable. No runtime, no `node_modules`, no version-mismatch dramas. The binary works on machines that have never seen Bun installed.

**Why not [the popular DevOps secret tool]?** Most "real" secret tools (HashiCorp Vault, Doppler, Infisical, Bitwarden Secrets Manager) are great if your team has $200+/mo in budget and infrastructure to run a secret backend. `keyrotate` is for the case before that — where 1Password is already the source of truth and you just need to stop hand-syncing it with GitHub/Supabase/Netlify.

**Does it work in CI?** Yes, if you wire `op` service-account tokens into your runner. We use it locally and in CI for one-off "rotate everything quarterly" scripts.

**What about Windows?** Bun supports Windows but I haven't tested keyrotate there. PRs welcome.

**Can I add a new provider?** Yes — ~30 lines in `src/providers/<id>.ts` and one line in the registry. See [`src/providers/resend.ts`](src/providers/resend.ts) as the canonical example.

**Can I add a new destination?** Slightly more involved — the destination plugin implements `set()` + `check()`. See [`src/destinations/onepassword.ts`](src/destinations/onepassword.ts) for the most feature-complete example.

---

## Contributing

Issues and PRs welcome. The codebase is small and intentionally dependency-light (one runtime dep: `@iarna/toml`).

```bash
git clone https://github.com/Prompto-Studio/keyrotate.git
cd keyrotate
bun install
bun run dev rotate <name>     # run from source against your project
bun run test
bun run lint                  # tsc --noEmit
```

---

## License

[MIT](LICENSE) © [BotFlow Lab](https://promptostudio.ai)

---

## Support

If `keyrotate` saved you from a production outage, the most useful thing you can do is **[⭐ star the repo](https://github.com/Prompto-Studio/keyrotate)** — that's what helps other devs find it.

If you want to do more, **[♥ Sponsor on GitHub](https://github.com/sponsors/SteveKinzey)** is the preferred way (it covers recurring + one-time; GitHub takes no fee). Ko-fi support is coming soon.

---

<sub>Built by [@SteveKinzey](https://github.com/SteveKinzey) for solo founders who got tired of rotation footguns.</sub>
