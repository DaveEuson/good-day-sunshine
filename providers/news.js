// Top stories from RSS/Atom feeds. No keys. cfg.feeds = [urls]; default is a sane mix.
export const meta = { title: "Top stories", icon: "▤" };

const DEFAULT_FEEDS = [
  "https://hnrss.org/frontpage?points=100",
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://feeds.arstechnica.com/arstechnica/index",
];

const strip = (s) => (s ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (x, t) => x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`))?.[1];

export function parseFeed(xml, url) {
  const source = (strip(tag(xml.split(/<(?:item|entry)[\s>]/)[0], "title")) || new URL(url).hostname.replace(/^www\./, "")).split(/\s[-–|:]\s/)[0].slice(0, 24);
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
  return blocks.map((b) => {
    const link = strip(tag(b, "link")) || b.match(/<link[^>]*href="([^"]+)"/)?.[1] || strip(tag(b, "guid"));
    const date = strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    return { title: strip(tag(b, "title")), url: link, source, t: Date.parse(date) || 0 };
  }).filter((i) => i.title && i.url);
}

const age = (t) => {
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60_000);
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
};

export async function fetchData(cfg) {
  const feeds = cfg.feeds?.length ? cfg.feeds : DEFAULT_FEEDS;
  const per = cfg.perFeed ?? 4;
  const results = await Promise.all(feeds.map(async (u) => {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "good-day-sunshine" } });
      if (!r.ok) throw new Error(r.status);
      return parseFeed(await r.text(), u).slice(0, per);
    } catch { return []; }
  }));
  const items = results.flat().sort((a, b) => b.t - a.t).slice(0, cfg.max ?? 10);
  if (!items.length) return { error: "No stories fetched. Check feed URLs." };
  return { items: items.map((i) => ({ text: i.title, url: i.url, sub: `${i.source}${i.t ? " · " + age(i.t) : ""}` })) };
}
