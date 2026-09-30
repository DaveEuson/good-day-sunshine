// Gmail via the Atom feed + app password (Google account → Security → App passwords; needs 2FA).
// The whole-inbox unread count is usually noise (promotions pile up), so the card leads with what is new
// in the last day in one folder, Primary by default. cfg.folder: "primary" | "important" | "inbox".
export const meta = { title: "Inbox", icon: "✉" };

const FOLDERS = {
  primary: { label: "^smartlabel_personal", name: "Primary" },
  important: { label: "^iim", name: "Important" },
  inbox: { label: "", name: "Inbox" },
};
const DAY = 86_400_000;
const tag = (s, t) => s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1]?.trim() ?? "";
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const ago = (t) => { const m = Math.round((Date.now() - t) / 60_000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };

// Pure: parse one Atom feed. The feed carries at most 20 entries, so a full page of recent mail means "20 or more".
export function parseFeed(xml, now = Date.now()) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
    const e = m[1];
    const t = Date.parse(tag(e, "issued") || tag(e, "modified"));
    return { title: unesc(tag(e, "title")) || "(no subject)", url: e.match(/<link[^>]*href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&"), from: unesc(tag(e, "name")), email: unesc(tag(e, "email")).toLowerCase(), summary: unesc(tag(e, "summary")), t: Number.isFinite(t) ? t : 0 };
  });
  const recent = entries.filter((e) => now - e.t < DAY).length;
  return { unread: +tag(xml, "fullcount") || 0, entries, recent, recentCapped: recent === entries.length && entries.length >= 20 };
}

async function feed(label, auth) {
  const r = await fetch(`https://mail.google.com/mail/feed/atom/${label}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(10_000) });
  if (r.status === 401) return { error: "Gmail rejected the app password." };
  if (!r.ok) throw new Error(`gmail feed → ${r.status}`);
  return parseFeed(await r.text());
}

export async function fetchData(cfg, env) {
  const user = cfg.user ?? env.GMAIL_USER, pass = env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { setup: "Add your Gmail address and app password in ⚙ Options → Keys." };
  const auth = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  const folder = FOLDERS[cfg.folder] ?? FOLDERS.primary;

  const [f, all] = await Promise.all([feed(folder.label, auth), folder.label ? feed("", auth).catch(() => null) : null]);
  if (f.error) return { error: f.error };
  const recentLabel = f.recentCapped ? "20+" : f.recent;

  return {
    title: folder.label ? `Inbox · ${folder.name}` : "Inbox",
    stats: [
      { label: `New in ${folder.name}, 24h`, value: f.recentCapped ? recentLabel : f.recent },
      { label: `Unread in ${folder.name}`, value: f.unread, sub: all && !all.error ? `${all.unread.toLocaleString()} in the whole inbox` : undefined },
    ],
    items: f.entries.slice(0, cfg.max ?? 6).map((e) => ({ text: e.title, url: e.url, badge: e.from, email: e.email, sub: `${e.t ? ago(e.t) + " · " : ""}${e.summary}` })),
    mail: { folder: folder.name, recent: f.recent, recentCapped: f.recentCapped, unread: f.unread },
  };
}
