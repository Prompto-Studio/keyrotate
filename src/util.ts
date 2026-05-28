/** TTY/exec helpers — no deps so the binary stays small. */
const T = process.stdout.isTTY;
const wrap = (open: string, close: string) => (s: string) => T ? `\x1b[${open}m${s}\x1b[${close}m` : s;
export const c = {
  dim: wrap("2", "22"), bold: wrap("1", "22"),
  red: wrap("31", "39"), green: wrap("32", "39"), yellow: wrap("33", "39"),
  blue: wrap("34", "39"), magenta: wrap("35", "39"), cyan: wrap("36", "39"),
};
export const log = {
  info: (m: string) => console.log(`  ${c.dim("▸")} ${m}`),
  step: (m: string) => console.log(`  ${c.cyan("▸")} ${c.bold(m)}`),
  ok:   (m: string) => console.log(`  ${c.green("✓")} ${m}`),
  warn: (m: string) => console.log(`  ${c.yellow("⚠")} ${m}`),
  err:  (m: string) => console.log(`  ${c.red("✗")} ${m}`),
  heading: (m: string) => console.log(`\n${c.bold(m)}\n`),
  blank: () => console.log(""),
};
async function readLine(): Promise<string> {
  return new Promise((res) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl >= 0) { process.stdin.off("data", onData); process.stdin.pause(); res(buf.slice(0, nl).trim()); }
    };
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}
export async function prompt(q: string): Promise<string> {
  process.stdout.write(`  ${c.blue("?")} ${q} `);
  return await readLine();
}
export async function promptSecret(q: string): Promise<string> {
  process.stdout.write(`  ${c.blue("?")} ${q} `);
  try { await run(["stty", "-echo"]); } catch {}
  const v = await readLine();
  try { await run(["stty", "echo"]); } catch {}
  process.stdout.write("\n");
  return v;
}
export async function confirm(q: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const a = (await prompt(`${q} ${hint}`)).toLowerCase();
  if (!a) return defaultYes;
  return a === "y" || a === "yes";
}
export interface ExecResult { ok: boolean; stdout: string; stderr: string; code: number; }
export async function run(cmd: string[]): Promise<ExecResult> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { ok: code === 0, stdout, stderr, code };
}
export async function runWithStdin(cmd: string[], stdin: string): Promise<ExecResult> {
  const proc = Bun.spawn(cmd, { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  proc.stdin.write(stdin); proc.stdin.end();
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { ok: code === 0, stdout, stderr, code };
}
export async function hasCommand(cmd: string): Promise<boolean> {
  const r = await run(["sh", "-lc", `command -v ${cmd}`]);
  return r.ok && r.stdout.trim().length > 0;
}
export function nowIso(): string { return new Date().toISOString(); }
export function mask(s: string, keep = 4): string {
  if (!s) return "";
  if (s.length <= keep * 2) return "•".repeat(s.length);
  return s.slice(0, keep) + "…" + s.slice(-keep);
}
