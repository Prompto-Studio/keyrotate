# Morning checklist — picking up from last night

You crashed at the end of a long session. Here's exactly where everything stands and the 10 minutes of input I couldn't do without you.

## ✅ What's done

- **v00.00.16 → v00.00.19 all shipped** to npm, GitHub Releases, and the Homebrew tap. Try it:
  ```bash
  brew update && brew upgrade keyrotate
  keyrotate version       # → 00.00.19
  keyrotate help          # 14 commands
  ```
- **keyrotate.dev** is live with full SSL + the 9-page trust stack
- **GitHub repo About sidebar** populated (description, website, topics, discussions enabled)
- **README updated** with the new commands in the Quick start section
- **Each release was manually pushed to the Homebrew tap** because the auto-push secret isn't set yet (see item 1 below)

## 🟡 Three loose ends I literally can't do without your browser

### 1. Set `HOMEBREW_TAP_TOKEN` (5 min) — so I stop manually pushing the tap

Without this, every future release will skip the auto-push to `Prompto-Studio/homebrew-tap` and someone (you or me in another session) has to push the formula by hand. With it, the release workflow does it forever.

- Go to https://github.com/settings/personal-access-tokens/new
- **Token name**: `keyrotate-homebrew-tap`
- **Resource owner**: `Prompto-Studio`
- **Repository access**: **Only select repositories** → check `homebrew-tap`
- **Expiration**: 1 year
- **Permissions → Repository → Contents**: **Read and write**
- Generate, copy the `github_pat_…` value
- ```bash
  gh secret set HOMEBREW_TAP_TOKEN --repo Prompto-Studio/keyrotate
  # paste, Enter, Ctrl+D
  ```

### 2. Set up Cloudflare Email Routing for keyrotate.dev (5 min) — so the legal-page addresses receive mail

Right now the Trust / Privacy / Terms pages reference `security@keyrotate.dev`, `privacy@keyrotate.dev`, and `hello@keyrotate.dev` — but mail to those addresses goes nowhere.

- Go to https://dash.cloudflare.com → keyrotate.dev → **Email** → **Email Routing**
- Click **Enable Email Routing**. Cloudflare auto-adds the MX records (3 of them) — accept.
- Under **Destination addresses**: add your real inbox (the address you'll actually read), confirm via the email Cloudflare sends.
- Under **Routes** → add catch-all rule: `* → <your real address>` (simplest)
- Or three specific routes:
  - `security@keyrotate.dev → <your address>`
  - `privacy@keyrotate.dev → <your address>`
  - `hello@keyrotate.dev → <your address>`
- Save. Done — keyrotate.dev now receives mail.

### 3. Upload the GitHub social preview image (15 seconds)

- Go to https://github.com/Prompto-Studio/keyrotate/settings
- Scroll to **Social preview** → **Edit** → upload `~/code/keyrotate/docs/social-preview.png`
- Save

## ⚙️ Optional polish (no rush)

- Write a v00.00.19 announcement post in the keyrotate Discussions, summarizing the new commands for any followers.
- Apply for GitHub Sponsors at https://github.com/sponsors (if you want the ♥ Sponsor button in the README to actually open a working page).
- Walk through `keyrotate discover` on your own machine to validate the scanner works against your real `.env` / 1Password setup.

## 🌐 Where everything lives now

| Thing | URL / location |
|---|---|
| Marketing site | https://keyrotate.dev |
| Source repo | https://github.com/Prompto-Studio/keyrotate |
| npm package | https://www.npmjs.com/package/keyrotate |
| Homebrew tap | https://github.com/Prompto-Studio/homebrew-tap |
| Latest release | https://github.com/Prompto-Studio/keyrotate/releases/tag/v00.00.19 |
| Audit log on your machine | `~/.config/keyrotate/audit.log` |
| Your Prompto rotation config | `~/code/promptostudio/Prompto-Bot-Img/keyrotate.toml` |

## 🤝 Honest acknowledgments from last night's session

- **Auto-rotation works for Resend and PostHog only** — not the 6 providers I originally promised. The other 4 (Stripe restricted keys, Netlify PAT, Fly.io, Supabase Mgmt) need real OAuth flows that ran past this session's window. Their interactive `rotate` flow still works fine.
- **GitHub OAuth device flow returns an OAuth user token, not a Personal Access Token.** GitHub doesn't expose an API to mint PATs — they're dashboard-only. The OAuth token works as Bearer auth for most REST API calls but isn't the same thing.
- **Google Cloud OAuth device flow (for service-account-key creation) didn't ship.** It's ~3h of focused work; queued for v00.00.20 if you want it.

Sleep well. 🌙
