const API = "https://www.googleapis.com/youtube/v3";

export const meta = { title: "YouTube", icon: "▶" };

async function yt(path, key) {
  const r = await fetch(`${API}${path}&key=${key}`);
  if (!r.ok) throw new Error(`youtube ${path.split("?")[0]} → ${r.status}`);
  return r.json();
}

export async function fetchData(cfg, env) {
  const key = env.YOUTUBE_API_KEY, id = cfg.channelId ?? env.YOUTUBE_CHANNEL_ID;
  if (!key || !id) return { setup: "Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in .env." };

  const ch = await yt(`/channels?part=statistics,contentDetails,snippet&id=${id}`, key);
  const c = ch.items?.[0];
  if (!c) return { error: "Channel not found." };
  const s = c.statistics;

  const uploads = c.contentDetails.relatedPlaylists.uploads;
  const pl = await yt(`/playlistItems?part=contentDetails&maxResults=5&playlistId=${uploads}`, key);
  const ids = pl.items.map((i) => i.contentDetails.videoId).join(",");
  const vids = ids ? await yt(`/videos?part=statistics,snippet&id=${ids}`, key) : { items: [] };

  return {
    stats: [
      { label: "Subscribers", value: +s.subscriberCount },
      { label: "Views", value: +s.viewCount },
      { label: "Videos", value: +s.videoCount },
    ],
    items: vids.items.map((v) => ({
      text: v.snippet.title,
      url: `https://youtu.be/${v.id}`,
      badge: `${Number(v.statistics.viewCount).toLocaleString()} views`,
      sub: `${v.statistics.likeCount ?? 0} likes · ${v.statistics.commentCount ?? 0} comments`,
    })),
  };
}
