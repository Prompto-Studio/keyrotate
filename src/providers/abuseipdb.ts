import type { Provider } from "../types.ts";
export const abuseipdb: Provider = {
  id: "abuseipdb", label: "AbuseIPDB",
  rotateUrl: "https://www.abuseipdb.com/account/api",
  async verify(key) {
    const r = await fetch("https://api.abuseipdb.com/api/v2/check?ipAddress=8.8.8.8", {
      headers: { Key: key, Accept: "application/json" },
    });
    return { ok: r.ok, detail: r.ok ? "AbuseIPDB authenticated" : `AbuseIPDB HTTP ${r.status}`, status: r.status };
  },
};
