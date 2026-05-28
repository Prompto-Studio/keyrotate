import { existsSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { findConfigPath } from "../config.ts";
import { listProviders } from "../providers/index.ts";
import { run, hasCommand, prompt, promptSecret, confirm, log, c, mask, nowIso } from "../util.ts";
import type { Provider } from "../types.ts";

/**
 * `keyrotate setup` — interactive wizard.
 *
 * Walks the user through:
 *   1. Project-level defaults (1Password vault, default destinations: GH repo,
 *      Supabase project, Netlify site, Fly app).
 *   2. Per-provider opt-in: for each supported provider, ask if they want to
 *      configure a rotation now. If yes:
 *        a. Show where to create the key (browser-open offered).
 *        b. Prompt for the key (or file path for file-mode providers).
 *        c. Verify against the upstream API.
 *        d. Save to 1Password (auto-creates the item).
 *        e. Append the rotation to keyrotate.toml.
 *   3. For unselected providers, write commented-out templates so the user
 *      can enable them later without consulting the docs.
 *
 * No username/password ever leaves the machine. Every credential is either
 * pasted by the user (after creating it in their normal browser session) or
 * read from a local file path they provide.
 */
export async function cmdSetup(): Promise<number> {
  log.heading("keyrotate setup — interactive wizard");

  const existing = findConfigPath();
  if (existing) {
    log.warn(`A keyrotate.toml already exists at:\n      ${existing}`);
    if (!(await confirm("Continue and APPEND new rotations to it?", false))) {
      log.info("Aborted. To start fresh, delete that file and re-run setup.");
      return 1;
    }
  }
  log.blank();

  // ── 1. Project-level defaults ──────────────────────────────────────────
  log.step("Project-level defaults");
  const cwd = process.cwd();
  const projectName = basename(cwd) || "project";
  log.info(`Detected project: ${c.cyan(projectName)}`);
  log.info(`Config will be written to: ${c.dim(resolve(cwd, "keyrotate.toml"))}`);

  const opVault = (await prompt("1Password vault to use [Private]:")).trim() || "Private";

  // Pre-flight 1Password — we'll use it heavily.
  if (!(await hasCommand("op"))) {
    log.err("1Password CLI 'op' is required. Install: https://1password.com/downloads/command-line");
    return 1;
  }
  const opCheck = await run(["op", "vault", "list"]);
  if (!opCheck.ok) {
    log.err("1Password is not signed in. Run `op signin` and try again.");
    return 1;
  }
  log.ok(`1Password ready (vault: ${opVault})`);
  log.blank();

  log.step("Default destinations  " + c.dim("(leave any blank to skip)"));
  const githubRepo = (await prompt("GitHub repo for Actions secrets (owner/repo):")).trim();
  const supabaseRef = (await prompt("Supabase project ref:")).trim();
  const netlifySite = (await prompt("Netlify site name or ID:")).trim();
  const flyApp = (await prompt("Default Fly.io app:")).trim();
  log.blank();

  // ── 2. Per-provider opt-in ─────────────────────────────────────────────
  const providers = listProviders().filter((p) => p.id !== "generic");
  log.step(`Now choose which providers to configure (${providers.length} available)`);
  log.info("For each provider you choose, we'll open the dashboard, you'll paste the key, we verify it, and save to 1Password.");
  log.blank();

  const configured: ConfiguredRotation[] = [];
  for (const p of providers) {
    const yes = await confirm(`Configure ${c.bold(p.label)}?`, false);
    if (!yes) continue;
    const r = await configureProvider(p, { projectName, opVault, githubRepo, supabaseRef, netlifySite, flyApp });
    if (r) configured.push(r);
    log.blank();
  }

  // ── 3. Custom provider ────────────────────────────────────────────────
  if (await confirm("Add a custom provider not in the built-in list?", false)) {
    const custom = await configureCustom({ projectName, opVault, githubRepo, supabaseRef });
    if (custom) configured.push(custom);
  }

  // ── 4. Write keyrotate.toml ────────────────────────────────────────────
  const tomlPath = resolve(cwd, "keyrotate.toml");
  const toml = renderToml({
    opVault,
    githubRepo, supabaseRef, netlifySite, flyApp,
    configured,
    allProviders: providers,
  });
  writeFileSync(tomlPath, toml, "utf8");
  log.blank();
  log.ok(c.green(`Wrote ${tomlPath}`));
  log.info(`  ${configured.length} active rotation(s) · ${providers.length - configured.length} commented templates`);
  log.blank();
  log.info("Next: " + c.cyan("keyrotate list") + "  — see what's configured");
  log.info("      " + c.cyan("keyrotate doctor") + " — confirm every destination is reachable");
  log.info("      " + c.cyan("keyrotate verify-all") + " — health-check every key");
  return 0;
}

interface ProjectDefaults {
  projectName: string;
  opVault: string;
  githubRepo: string;
  supabaseRef: string;
  netlifySite: string;
  flyApp: string;
}

interface ConfiguredRotation {
  name: string;
  providerId: string;
  title: string;
  secretName: string;
  destinations: string[];
  /** Extra per-rotation overrides (rare). */
  overrides?: Record<string, Record<string, string>>;
  /** For custom providers, the spec to embed in [providers.custom.<id>]. */
  customSpec?: Record<string, string>;
}

async function configureProvider(p: Provider, def: ProjectDefaults): Promise<ConfiguredRotation | null> {
  log.heading(`→ ${p.label}`);

  // Step 1: show where to get the key + optionally open browser
  if (p.rotateUrl) {
    log.info(`Where to get this key: ${c.cyan(p.rotateUrl)}`);
    if (await confirm("Open it in your browser?", true)) {
      await run(["open", p.rotateUrl]).catch(() => {});
      log.ok("Browser opened");
    }
  } else {
    log.warn(`No dashboard URL on file for ${p.label} — you know where to look.`);
  }

  // Step 2: collect the value
  let value: string;
  if (p.inputMode === "file") {
    const path = (await prompt(`Path to the new ${p.label} file:`)).trim();
    if (!path) { log.warn("Skipped (no path)."); return null; }
    const abs = resolve(path.replace(/^~/, process.env.HOME ?? ""));
    if (!existsSync(abs)) { log.err(`File not found: ${abs}`); return null; }
    value = await Bun.file(abs).text();
    log.info(`Loaded ${value.length} bytes`);
  } else {
    value = (await promptSecret(`Paste the new ${p.label} key (hidden):`)).trim();
    if (!value) { log.warn("Skipped (no value)."); return null; }
    log.info(`Value: ${mask(value)}`);
    if (p.looksLikeKey && !p.looksLikeKey(value)) {
      if (!(await confirm("Value doesn't match the expected format. Continue anyway?", false))) {
        log.warn("Skipped."); return null;
      }
    }
  }

  // Step 3: verify (some providers need extra static config; we ask inline)
  const providerStatic: Record<string, string> = {};
  if (p.configKeys && p.configKeys.length) {
    log.info(`${p.label} needs some static config (these don't rotate — stored in keyrotate.toml):`);
    for (const k of p.configKeys) {
      const v = (await prompt(`  ${k}:`)).trim();
      if (v) providerStatic[k] = v;
    }
  }
  log.info(`Verifying against ${p.label}…`);
  const v = await p.verify(value, providerStatic);
  if (!v.ok) {
    log.err(`Verification failed: ${v.detail}`);
    if (!(await confirm("Save anyway? (you'll fix it later with `kr rotate`)", false))) return null;
  } else {
    log.ok(v.detail);
  }

  // Step 4: 1Password item
  const defaultTitle = `${def.projectName} · ${p.label}`;
  const title = (await prompt(`1Password item title [${defaultTitle}]:`)).trim() || defaultTitle;
  const opCmd = await opItemUpsert(title, def.opVault, value, p.id);
  if (!opCmd.ok) {
    log.err(`1Password save failed: ${opCmd.detail}`);
    if (!(await confirm("Continue without 1Password save?", false))) return null;
  } else {
    log.ok(opCmd.detail);
  }

  // Step 5: which destinations does this rotation go to?
  const defaultName = suggestSecretName(p.id);
  const secretName = (await prompt(`Secret/env name [${defaultName}]:`)).trim() || defaultName;
  const destinations: string[] = ["onepassword"];
  if (def.githubRepo && (await confirm(`Mirror to GitHub Actions secret on ${def.githubRepo}?`, true))) destinations.push("github");
  if (def.supabaseRef && (await confirm(`Mirror to Supabase secret on ${def.supabaseRef}?`, true))) destinations.push("supabase");
  if (def.netlifySite && (await confirm(`Mirror to Netlify env on ${def.netlifySite}?`, false))) destinations.push("netlify");
  if (def.flyApp && (await confirm(`Mirror to Fly.io app ${def.flyApp}?`, false))) destinations.push("flyio");

  return {
    name: p.id.replace(/^custom:/, "").replace(/[^a-z0-9-]/gi, "-"),
    providerId: p.id,
    title,
    secretName,
    destinations,
    ...(Object.keys(providerStatic).length ? { overrides: { provider: providerStatic } } : {}),
  };
}

async function configureCustom(def: ProjectDefaults): Promise<ConfiguredRotation | null> {
  log.heading("→ Custom provider");
  const id = (await prompt("Provider ID (lowercase, no spaces, e.g. brevo):")).trim();
  if (!id) return null;
  const label = (await prompt(`Display label [${id}]:`)).trim() || id;
  const rotateUrl = (await prompt("Where to create/manage the key (URL):")).trim();
  const verifyUrl = (await prompt("Verify URL (a cheap authenticated GET endpoint):")).trim();
  const verifyAuth = (await prompt('Auth header, with ${KEY} as a placeholder [Bearer ${KEY}]:')).trim() || "Bearer ${KEY}";
  const keyPrefix = (await prompt("Key prefix (optional, e.g. xkeysib-):")).trim();
  const value = (await promptSecret(`Paste the ${label} key (hidden):`)).trim();
  if (!value) return null;

  log.info(`Testing ${label}…`);
  const auth = verifyAuth.replace("${KEY}", value);
  const [headerName, ...rest] = auth.includes(":") ? auth.split(":") : ["Authorization", auth];
  const r = await fetch(verifyUrl, { headers: { [headerName.trim()]: rest.join(":").trim() || auth } });
  if (!r.ok) log.warn(`Verifier returned HTTP ${r.status}`);
  else log.ok(`${label} authenticated`);

  const title = `${def.projectName} · ${label}`;
  await opItemUpsert(title, def.opVault, value, id);

  const customSpec: Record<string, string> = { label, verify_url: verifyUrl, verify_auth: verifyAuth };
  if (rotateUrl) customSpec.rotate_url = rotateUrl;
  if (keyPrefix) customSpec.key_prefix = keyPrefix;

  const destinations = ["onepassword"];
  if (def.githubRepo && (await confirm(`Mirror to GitHub Actions secret on ${def.githubRepo}?`, false))) destinations.push("github");
  if (def.supabaseRef && (await confirm(`Mirror to Supabase secret on ${def.supabaseRef}?`, false))) destinations.push("supabase");

  return {
    name: id,
    providerId: id,
    title,
    secretName: suggestSecretName(id),
    destinations,
    customSpec,
  };
}

async function opItemUpsert(title: string, vault: string, value: string, providerId: string): Promise<{ ok: boolean; detail: string }> {
  const probe = await run(["op", "item", "get", title, "--vault", vault, "--format=json"]);
  if (probe.ok) {
    const proc = Bun.spawn(
      ["op", "item", "edit", title, "--vault", vault, "credential[password]=-", `rotated_at[text]=${nowIso()}`, "previous_revoked[text]=pending"],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    );
    proc.stdin.write(value); proc.stdin.end();
    const code = await proc.exited;
    return { ok: code === 0, detail: code === 0 ? `Updated 1Password item "${title}"` : "op edit failed" };
  }
  const proc = Bun.spawn(
    ["op", "item", "create", "--category=API Credential", `--title=${title}`, `--vault=${vault}`, `--tags=keyrotate,${providerId}`, "credential[password]=-", `rotated_at[text]=${nowIso()}`, "previous_revoked[text]=n/a"],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  proc.stdin.write(value); proc.stdin.end();
  const code = await proc.exited;
  return { ok: code === 0, detail: code === 0 ? `Created 1Password item "${title}"` : "op create failed" };
}

function suggestSecretName(providerId: string): string {
  const map: Record<string, string> = {
    "resend": "RESEND_API_KEY", "openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY",
    "google-cloud": "GEMINI_API_KEY", "google-workspace": "GOOGLE_WORKSPACE_SA_JSON",
    "fal": "FAL_KEY", "elevenlabs": "ELEVENLABS_API_KEY", "stripe": "STRIPE_SECRET_KEY",
    "netlify": "NETLIFY_PAT", "supabase": "SUPABASE_PAT", "huggingface": "HF_API_KEY",
    "posthog": "POSTHOG_API_KEY", "abuseipdb": "ABUSEIPDB_API_KEY",
    "aws": "AWS_ACCESS_KEY", "cloudflare": "CLOUDFLARE_API_TOKEN", "dropbox": "DROPBOX_TOKEN",
    "github-pat": "GITHUB_PAT", "vercel": "VERCEL_TOKEN",
    "microsoft365": "ENTRA_CLIENT_SECRET", "zoho": "ZOHO_REFRESH_TOKEN",
  };
  return map[providerId] ?? providerId.replace(/[-:]/g, "_").toUpperCase() + "_KEY";
}

interface RenderOpts {
  opVault: string;
  githubRepo: string; supabaseRef: string; netlifySite: string; flyApp: string;
  configured: ConfiguredRotation[];
  allProviders: Provider[];
}
function renderToml(o: RenderOpts): string {
  const lines: string[] = [];
  lines.push("# keyrotate.toml — generated by `keyrotate setup`");
  lines.push("# Run `kr rotate <name>` to rotate any of the rotations below.");
  lines.push("");
  lines.push("[defaults]");
  lines.push(`op_vault = ${JSON.stringify(o.opVault)}`);
  lines.push("op_tags = [\"keyrotate\"]");
  lines.push("op_category = \"API Credential\"");
  lines.push("");

  // Destinations block (only the ones that were filled in)
  lines.push("# ═══ Destinations ═════════════════════════════════════════");
  if (o.githubRepo)   { lines.push("[destinations.github]");   lines.push(`repo = ${JSON.stringify(o.githubRepo)}`);   lines.push(""); }
  if (o.supabaseRef)  { lines.push("[destinations.supabase]"); lines.push(`project_ref = ${JSON.stringify(o.supabaseRef)}`); lines.push(""); }
  if (o.netlifySite)  { lines.push("[destinations.netlify]");  lines.push(`site = ${JSON.stringify(o.netlifySite)}`);  lines.push(""); }
  if (o.flyApp)       { lines.push("[destinations.flyio]");    lines.push(`app  = ${JSON.stringify(o.flyApp)}`);       lines.push(""); }
  lines.push("[destinations.onepassword]");
  lines.push(`vault = ${JSON.stringify(o.opVault)}`);
  lines.push("");

  // Active rotations
  if (o.configured.length) {
    lines.push("# ═══ Active rotations ═════════════════════════════════════");
    for (const r of o.configured) {
      lines.push(`[rotations.${r.name}]`);
      lines.push(`provider = ${JSON.stringify(r.providerId.startsWith("custom:") ? r.providerId.slice(7) : r.providerId)}`);
      lines.push(`title = ${JSON.stringify(r.title)}`);
      lines.push(`secret_name = ${JSON.stringify(r.secretName)}`);
      lines.push(`destinations = [${r.destinations.map((d) => JSON.stringify(d)).join(", ")}]`);
      lines.push("");

      // Inline custom-provider spec
      if (r.customSpec) {
        lines.push(`[providers.custom.${r.name}]`);
        for (const [k, v] of Object.entries(r.customSpec)) lines.push(`${k} = ${JSON.stringify(v)}`);
        lines.push("");
      }

      // Per-provider static config (e.g. microsoft365 tenant_id)
      if (r.overrides?.provider) {
        lines.push(`[providers.${r.providerId}]`);
        for (const [k, v] of Object.entries(r.overrides.provider)) lines.push(`${k} = ${JSON.stringify(v)}`);
        lines.push("");
      }
    }
  }

  // Commented-out templates for unselected providers
  const configuredIds = new Set(o.configured.map((c) => c.providerId));
  const unselected = o.allProviders.filter((p) => !configuredIds.has(p.id));
  if (unselected.length) {
    lines.push("# ═══ Available providers (commented templates) ════════════");
    lines.push("# Uncomment + fill in to enable, or re-run `keyrotate setup` to add interactively.");
    lines.push("");
    for (const p of unselected) {
      const slug = p.id;
      const sn = suggestSecretName(p.id);
      lines.push(`# [rotations.${slug}]`);
      lines.push(`# provider = ${JSON.stringify(p.id)}`);
      lines.push(`# title = ${JSON.stringify(`<project> · ${p.label}`)}`);
      lines.push(`# secret_name = ${JSON.stringify(sn)}`);
      lines.push(`# destinations = ["onepassword"${o.githubRepo ? ', "github"' : ""}${o.supabaseRef ? ', "supabase"' : ""}]`);
      if (p.rotateUrl) lines.push(`# # create key at: ${p.rotateUrl}`);
      if (p.configKeys?.length) {
        lines.push(`# [providers.${p.id}]`);
        for (const k of p.configKeys) lines.push(`# ${k} = ""`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
