/** Shared types. Two plugin interfaces drive everything: Provider (verify) + Destination (write). */
export interface VerifyResult { ok: boolean; detail: string; status?: number; }
export interface Provider {
  id: string;
  label: string;
  rotateUrl?: string;
  looksLikeKey?(value: string): boolean;
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
  /** Default secret/env-var name used by every destination that needs one. */
  secret_name?: string;
  /** Per-destination config overrides. e.g. overrides.envfile.env_name = "VITE_OPENAI_API_KEY" */
  overrides?: Record<string, Record<string, unknown>>;
  /** Optional GH workflow to trigger after success (relative path under .github/workflows/). */
  postRotateWorkflow?: string;
  notes?: string;
}
export interface DestinationConfig { [k: string]: unknown; }
export interface KeyrotateConfig {
  defaults?: { op_vault?: string; op_tags?: string[]; op_category?: string };
  rotations: Record<string, RotationConfig>;
  destinations: Record<string, DestinationConfig>;
  providers?: Record<string, { verify_url?: string; verify_header?: string }>;
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
