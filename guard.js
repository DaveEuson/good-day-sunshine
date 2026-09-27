// Request guards, kept separate so they can be tested.
import os from "node:os";

// Host header must name this machine. Blocks DNS rebinding: an attacker's domain resolving to 127.0.0.1 still
// carries its own name in Host. Allowed: localhost forms, this machine's IPv4 addresses, its hostname (+ .local).
export function allowedHosts(extra = []) {
  const set = new Set(["localhost", "127.0.0.1", "[::1]", "::1", ...extra.map((h) => h.toLowerCase())]);
  const name = os.hostname().toLowerCase();
  set.add(name); set.add(`${name}.local`);
  for (const addrs of Object.values(os.networkInterfaces())) for (const a of addrs ?? []) if (a.family === "IPv4") set.add(a.address);
  return set;
}
export function hostOk(hostHeader, allowed) {
  if (!hostHeader) return false;
  const h = hostHeader.toLowerCase().replace(/:\d+$/, "");
  return allowed.has(h) || h.endsWith(".localhost");
}
// State-changing requests from another site: a present Origin must be this same host.
export function originOk(method, originHeader, hostHeader) {
  if (method === "GET" || method === "HEAD" || !originHeader) return true;
  try { return new URL(originHeader).host.toLowerCase() === String(hostHeader).toLowerCase(); } catch { return false; }
}
// .env values: one line, printable, bounded. A newline would let a value write extra settings.
export function envValueOk(v) {
  return typeof v === "string" && v.length <= 4096 && !/[\r\n\0]/.test(v);
}
// Links shown on the page: only http(s) (an RSS <link>javascript:…</link> must not become clickable).
export const safeHref = (u) => (/^https?:\/\//i.test(String(u ?? "")) ? u : "");
