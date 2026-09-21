const API = "https://api.twitch.tv/helix";
let appToken = null;

export const meta = { title: "Twitch", icon: "◉" };

async function getAppToken(env) {
  if (appToken && appToken.exp > Date.now()) return appToken.v;
  const url = `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_CLIENT_ID}&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`;
  const r = await fetch(url, { method: "POST" });
  if (!r.ok) throw new Error(`twitch token → ${r.status}`);
  const j = await r.json();
  appToken = { v: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return appToken.v;
}

async function tw(path, env, tok) {
  const r = await fetch(API + path, { headers: { "Client-Id": env.TWITCH_CLIENT_ID, Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`twitch ${path.split("?")[0]} → ${r.status}`);
  return r.json();
}

export async function fetchData(cfg, env) {
  const login = cfg.login ?? env.TWITCH_LOGIN;
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET || !login)
    return { setup: "Set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_LOGIN in .env." };

  const tok = await getAppToken(env);
  const u = (await tw(`/users?login=${login}`, env, tok)).data?.[0];
  if (!u) return { error: "Twitch user not found." };

  const [streams, videos, clips] = await Promise.all([
    tw(`/streams?user_id=${u.id}`, env, tok),
    tw(`/videos?user_id=${u.id}&first=5&type=archive`, env, tok),
    tw(`/clips?broadcaster_id=${u.id}&first=5`, env, tok),
  ]);
  const live = streams.data?.[0];
  const vodViews = videos.data.reduce((n, v) => n + v.view_count, 0);

  // Follower count needs a user token (moderator:read:followers). Optional.
  let followers = null;
  if (env.TWITCH_USER_TOKEN) {
    const f = await tw(`/channels/followers?broadcaster_id=${u.id}&first=1`, env, env.TWITCH_USER_TOKEN).catch(() => null);
    followers = f?.total ?? null;
  }

  const stats = [
    { label: "Status", value: live ? `LIVE · ${live.viewer_count}` : "Offline" },
    { label: "Last 5 VOD views", value: vodViews },
  ];
  if (followers != null) stats.unshift({ label: "Followers", value: followers });

  return {
    stats,
    items: [
      ...videos.data.map((v) => ({ text: v.title, url: v.url, badge: `${v.view_count} views`, sub: v.duration })),
      ...clips.data.map((c) => ({ text: `Clip: ${c.title}`, url: c.url, badge: `${c.view_count} views` })),
    ].slice(0, 6),
  };
}
