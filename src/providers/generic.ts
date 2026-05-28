import type { Provider } from "../types.ts";
export const generic: Provider = {
  id: "generic", label: "Generic (no verifier)",
  async verify() {
    return { ok: true, detail: "(skipped — generic provider has no verifier)" };
  },
};
