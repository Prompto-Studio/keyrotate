import { log, c, prompt } from "../util.ts";

/**
 * `keyrotate github-oauth` — bootstrap a GitHub OAuth token via device flow.
 *
 * What this DOES:
 *   - Starts the OAuth device flow against github.com using a client_id you
 *     provide (you register your own OAuth App at
 *     https://github.com/settings/applications/new — 2 min).
 *   - Polls until you authorize, then returns the access token.
 *
 * What this DOES NOT do:
 *   - Create a Personal Access Token (PAT). GitHub does not expose a public
 *     API to mint PATs; they can only be created in the dashboard. The OAuth
 *     token returned here is usable as Bearer auth for most REST API calls
 *     but is NOT a PAT. If you specifically need a PAT (e.g. for git push
 *     over HTTPS or for tools that strictly require ghp_/github_pat_ format),
 *     create it in the dashboard as usual.
 *
 * Usage:
 *   keyrotate github-oauth <client_id> [--scope=repo,workflow]
 *
 * Or set GITHUB_OAUTH_CLIENT_ID in the environment.
 */
export async function cmdGithubOAuth(args: string[]): Promise<number> {
  const clientId = args[0] || process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    log.err("Need a GitHub OAuth App client_id.");
    log.info("  Register one at https://github.com/settings/applications/new");
    log.info("  Application type: 'Device Flow Enabled' = YES");
    log.info("  Then pass it: keyrotate github-oauth <client_id>");
    return 1;
  }
  const scopeArg = args.find((a) => a.startsWith("--scope="))?.slice("--scope=".length);
  const scope = scopeArg || "repo,workflow,read:user";

  log.heading("GitHub OAuth device flow");
  log.info(`Client ID: ${clientId}`);
  log.info(`Scopes:    ${scope}`);
  log.blank();

  log.step("Requesting device code…");
  const dc = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  if (!dc.ok) {
    log.err(`GitHub returned HTTP ${dc.status} requesting device code: ${(await dc.text()).slice(0, 200)}`);
    return 1;
  }
  const dcBody = (await dc.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };

  console.log();
  console.log(c.bold("  1. Open this URL in your browser:"));
  console.log(`     ${c.cyan(dcBody.verification_uri)}`);
  console.log();
  console.log(c.bold("  2. Enter this code:"));
  console.log(`     ${c.cyan(dcBody.user_code)}`);
  console.log();
  log.info(`  (Code expires in ${Math.round(dcBody.expires_in / 60)} minutes.)`);
  console.log();
  log.step("Waiting for authorization… polling every " + dcBody.interval + "s");

  const startedAt = Date.now();
  while (Date.now() - startedAt < dcBody.expires_in * 1000) {
    await new Promise((r) => setTimeout(r, dcBody.interval * 1000));
    const poll = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: dcBody.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const j = (await poll.json()) as { access_token?: string; error?: string; token_type?: string; scope?: string };
    if (j.access_token) {
      log.blank();
      log.ok(c.bold("Authorized! Got a new OAuth token."));
      log.info(`  Type:   ${j.token_type ?? "bearer"}`);
      log.info(`  Scopes: ${j.scope ?? "(unknown)"}`);
      console.log();
      console.log(c.bold("Token value (handle with care):"));
      console.log(`  ${j.access_token}`);
      console.log();
      log.info("Next step: paste this into `keyrotate import` or `keyrotate rotate` for a GitHub-token-based rotation.");
      log.warn("Reminder: this is an OAuth user token, not a Personal Access Token. Use a PAT if a tool specifically requires that format.");
      return 0;
    }
    if (j.error === "authorization_pending") {
      // Normal — user hasn't completed auth yet. Keep polling.
      continue;
    }
    if (j.error === "slow_down") {
      // GitHub wants us to back off.
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (j.error === "expired_token" || j.error === "access_denied") {
      log.err(`OAuth flow ended: ${j.error}`);
      return 1;
    }
    // Unknown error — keep polling but log it.
    log.warn(`Unexpected poll response: ${JSON.stringify(j)}`);
  }
  log.err("Authorization timed out. Try again.");
  return 1;
}
