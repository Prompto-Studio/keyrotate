import type { Provider } from "../types.ts";
import { run, hasCommand } from "../util.ts";
/**
 * AWS access keys can't be verified by HTTP alone (requires SigV4 signing).
 * Easiest reliable check: shell out to the AWS CLI with the candidate keys
 * in environment variables and call `aws sts get-caller-identity`.
 *
 * Pass the candidate as "<access_key_id>:<secret_access_key>" (colon-separated)
 * since rotation prompts handle a single string per key.
 */
export const aws: Provider = {
  id: "aws", label: "AWS (access key + secret)",
  rotateUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
  looksLikeKey: (v) => /^AKIA[A-Z0-9]{16}:.+/.test(v) || /^ASIA[A-Z0-9]{16}:.+/.test(v),
  async verify(combined) {
    if (!(await hasCommand("aws"))) return { ok: false, detail: "aws CLI not installed (required for AWS verification)" };
    const [id, secret] = combined.split(":");
    if (!id || !secret) return { ok: false, detail: "Expected format: <access_key_id>:<secret_access_key>" };
    const proc = Bun.spawn(["aws", "sts", "get-caller-identity"], {
      env: { ...process.env, AWS_ACCESS_KEY_ID: id, AWS_SECRET_ACCESS_KEY: secret, AWS_DEFAULT_REGION: "us-east-1" },
      stdout: "pipe", stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    return { ok: code === 0, detail: code === 0 ? "AWS authenticated" : `aws sts failed: ${stderr.trim().split("\n")[0]}` };
  },
};
