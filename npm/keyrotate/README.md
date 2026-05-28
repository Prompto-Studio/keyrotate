# keyrotate

> **Rotate any API key in one command.** Updates 1Password, GitHub Actions secrets, Supabase Edge Function secrets, Netlify env vars, Fly.io app secrets, and your local `.env` — then verifies the new key against the provider.

```bash
npx keyrotate setup           # guided wizard — set up your project
npx keyrotate rotate resend   # rotate one key, verified end-to-end
```

## Install

```bash
npm install -g keyrotate
# or
brew install Prompto-Studio/homebrew-tap/keyrotate
```

This package contains a tiny shim that runs the right standalone binary for your platform (macOS Apple Silicon, macOS Intel, or Linux x64). No Node code executes the rotation logic.

## Full docs

- **Source + full README:** https://github.com/Prompto-Studio/keyrotate
- **Releases:** https://github.com/Prompto-Studio/keyrotate/releases
- **Issues:** https://github.com/Prompto-Studio/keyrotate/issues

## Supported

**Providers (22 built-in + unlimited config-driven):** Resend · OpenAI · Anthropic · Google Cloud (Gemini/Imagen/Veo) · Google Workspace · fal.ai · ElevenLabs · Stripe · Netlify · Supabase · HuggingFace · PostHog · AbuseIPDB · AWS · Cloudflare · Dropbox · GitHub PAT · Vercel · Microsoft 365 / Entra ID · Zoho · generic — plus your own via `[providers.custom.<id>]` in `keyrotate.toml`.

**Destinations:** 1Password · GitHub Actions secrets · Supabase Edge Function secrets · Netlify env vars · Fly.io app secrets · `.env` files.

MIT © BotFlow Lab
