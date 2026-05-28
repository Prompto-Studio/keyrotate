/** Shared types. Two plugin interfaces drive everything: Provider (verify) + Destination (write). */
export interface VerifyResult { ok: boolean; detail: string; status?: number; }

export interface Provider {
  id: string;
  label: string;
  rotateUrl?: string;
  looksLikeKey?(value: string): boolean;
  /**
   * "string"  → paste the secret directly (default)
   * "file"    → user types a path to a file; keyrotate reads the contents
   *             before passing to verify() and storing in destinations.
   */
  inputMode?: "string" | "file";
  /**
   * Static config keys this provider reads from `[providers.<id>]` in
   * keyrotate.toml. Useful for things like tenant_id, client_id, region —
   * values that don't rotate but the verifier needs.
   */
  configKeys?: string[];
  /** Hit a cheap, idempotent endpoint to confirm the key is live. */
  verify(key: string, opts?: Record<string, string>): Promise<VerifyResult>;
}

export interface WriteResult { ok: boolean; detail: string; }
export interface Destination {
  id: string;
  label: string;
  set(name: string, value: string, config: Record<string, unknown>): Promise<WriteResult>;
  check(config: Record<string, unknown>): Promise<WriteResult>;
}

export interface RotationConfig {
  name: string;
  provider: string;
  title?: string;
  destinations: string[];
  secret_name?: string;
  overrides?: Record<string, Record<string, unknown>>;
  postRotateWorkflow?: string;
  notes?: string;
}

export interface DestinationConfig { [k: string]: unknown; }

/**
 * Per-provider static config: anything the verifier needs but doesn't rotate
 * (tenant IDs, client IDs, regions, etc.). Custom providers also declare
 * verify_url + verify_auth here.
 */
export interface ProviderConfig {
  [k: string]: unknown;
}

export interface KeyrotateConfig {
  defaults?: { op_vault?: string; op_tags?: string[]; op_category?: string };
  rotations: Record<string, RotationConfig>;
  destinations: Record<string, DestinationConfig>;
  /** Optional per-provider static config. `providers.custom.<id>` defines user-declared providers. */
  providers?: Record<string, ProviderConfig> & { custom?: Record<string, CustomProviderSpec> };
}

/**
 * A user-declared provider in keyrotate.toml:
 *
 *   [providers.custom.workspace-admin]
 *   label       = "Google Workspace Admin"
 *   rotate_url  = "https://admin.google.com/ac/owl/list?tab=apps"
 *   verify_url  = "https://admin.googleapis.com/admin/directory/v1/users?maxResults=1"
 *   verify_auth = "Bearer ${KEY}"        # or "x-api-key: ${KEY}", "Key ${KEY}", etc.
 *   key_prefix  = "ya29."                # optional sanity check
 *   verify_method = "GET"                # optional; default GET
 */
export interface CustomProviderSpec {
  label: string;
  rotate_url?: string;
  verify_url: string;
  /** Authorization header value with ${KEY} substituted. e.g. "Bearer ${KEY}". */
  verify_auth: string;
  key_prefix?: string;
  verify_method?: "GET" | "POST" | "HEAD";
  /** Optional: response status range counted as success. Default: 200-299. */
  ok_statuses?: number[];
}

export interface AuditEntry {
  timestamp: string;
  rotation: string;
  provider: string;
  destinations_attempted: string[];
  destinations_succeeded: string[];
  destinations_failed: { id: string; error: string }[];
  verify: VerifyResult;
  operator: string;
  outcome: "success" | "partial" | "failure";
}
