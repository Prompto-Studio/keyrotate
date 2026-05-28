# keyrotate

One-command API-key rotation for solo founders and small teams. Rotates a key in **1Password** (canonical source of truth), then propagates the new value to every place it's actually used — GitHub Actions secrets, Supabase Edge Function secrets, Netlify env vars, Fly.io app secrets, local `.env` files — and **verifies** the new key against the upstream provider.

Stops you from getting halfway through a rotation, breaking production, and forgetting which destinations you already updated.

## Status

`v0.2` — active development by [BotFlow Lab](https://promptostudio.ai). Used internally for Prompto Studio AI.

## Install

### Option A — Homebrew (recommended once the tap is up)

```bash
brew tap botflowlab/tap          # one-time
brew install keyrotate
```

### Option B — curl one-liner (works as soon as v0.2.0 is on GitHub Releases)

```bash
curl -fsSL https://raw.githubusercontent.com/botflowlab/keyrotate/main/scripts/install.sh | bash
```

Drops the binary in `~/bin/keyrotate` (and aliases `kr`). No sudo, no compile.

### Option C — From source

```bash
git clone https://github.com/botflowlab/keyrotate.git
cd keyrotate
bun install
bun run build
ln -sf "$(pwd)/dist/keyrotate" ~/bin/keyrotate
ln -sf "$(pwd)/dist/keyrotate" ~/bin/kr
```

## Quick start

```bash
$ cd /path/to/your/project
$ keyrotate init                  # writes keyrotate.toml
$ keyrotate list                  # see rotations
$ keyrotate rotate resend-alerts  # do a rotation, interactive
$ keyrotate audit                 # see history
```

## Config (`keyrotate.toml`)

```toml
[defaults]
op_vault = "Private"

[rotations.resend-alerts]
provider     = "resend"
title        = "Prompto · Resend Alerts"
secret_name  = "RESEND_API_KEY"           # used by all destinations
destinations = ["onepassword", "github", "supabase"]
postRotateWorkflow = ".github/workflows/test-alerts.yml"   # optional

# Per-destination override (rare — when secret name differs across destinations)
[rotations.openai.overrides.envfile]
env_name = "VITE_OPENAI_API_KEY"

[destinations.github]
repo = "owner/repo"

[destinations.supabase]
project_ref = "abcdefghij"

[destinations.onepassword]
vault = "Private"
```

## Providers (verify-on-rotation)

`resend`, `openai`, `google-cloud` (Gemini/Imagen/Veo), `fal`, `elevenlabs`, `stripe`, `netlify`, `supabase`, `huggingface`, `posthog`, `abuseipdb`, `generic`.

## Destinations (write-secrets)

| Destination | CLI required | Notes |
|---|---|---|
| `onepassword` | `op` | **Default canonical.** Auto-creates the item if missing, updates `rotated_at` metadata otherwise. |
| `github` | `gh` | Sets a repo-scoped Actions secret. |
| `supabase` | `supabase` | Sets an Edge Function secret. |
| `netlify` | `netlify` | Sets a site env var (per-context). |
| `flyio` | `flyctl` | Sets an app secret (staged — `--stage`, deploy to apply). |
| `envfile` | — | Writes `NAME=VALUE` to a local `.env` file. |

## What it does, exactly

1. Walks up from cwd to find `keyrotate.toml`.
2. Pre-flights every destination (CLI installed? authenticated? scope set?). Aborts if anything's missing.
3. Prompts for the new key value with `stty -echo` (hidden input).
4. **Verifies the new key against the provider's API.** Nothing gets written if verification fails.
5. Writes to each destination in order, surfacing per-destination success/failure.
6. Optionally triggers a post-rotate GitHub Actions workflow.
7. Writes a JSONL audit entry to `~/.config/keyrotate/audit.log`.
8. Offers to open the provider's revocation page in your browser.

## Requirements

- macOS / Linux (Apple Silicon or x64)
- `op` (1Password CLI) — only if `1password` is in any rotation
- `gh`, `supabase`, `netlify`, `flyctl` — only the ones you use
- Nothing else at runtime (binary is standalone)

## Cutting a release (maintainers)

```bash
bun version patch     # bumps package.json
git push && git push --tags
# .github/workflows/release.yml builds darwin-arm64 + darwin-x64 + linux-x64
# tarballs them, attaches to the GitHub Release, and emits an updated Formula/keyrotate.rb.
# Copy that formula into the botflowlab/homebrew-tap repo to publish via brew.
```

## License

MIT © BotFlow Lab
