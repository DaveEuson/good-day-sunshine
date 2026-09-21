// Gmail unread via the Atom feed + app password (Google account → Security → App passwords; needs 2FA).
export const meta = { title: "Inbox", icon: "✉" };

const tag = (s, t) => s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1]?.trim() ?? "";
const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export async function fetchData(cfg, env) {
  const user = cfg.user ?? env.GMAIL_USER, pass = env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { setup: "Set GMAIL_USER and GMAIL_APP_PASSWORD in ⚙ Options → Keys." };

  const r = await fetch("https://mail.google.com/mail/feed/atom", {
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") },
  });
  if (r.status === 401) return { error: "Gmail rejected the app password." };
  if (!r.ok) throw new Error(`gmail feed → ${r.status}`);
  const xml = await r.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);

  return {
    stats: [{ label: "Unread", value: +tag(xml, "fullcount") || 0 }],
    items: entries.slice(0, cfg.max ?? 6).map((e) => ({
      text: unesc(tag(e, "title")) || "(no subject)",
      url: e.match(/<link[^>]*href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&"),
      badge: unesc(tag(e, "name")),
      sub: unesc(tag(e, "summary")),
    })),
  };
}
