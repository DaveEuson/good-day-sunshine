import * as github from "./github.js";
import * as youtube from "./youtube.js";
import * as twitch from "./twitch.js";
import * as attention from "./attention.js";
import * as weather from "./weather.js";
import * as calendar from "./calendar.js";
import * as email from "./email.js";
import * as news from "./news.js";
import * as ai from "./aistatus.js";
import * as credits from "./credits.js";

// Add a provider: export { meta, fetchData(cfg, env) } and register here.
// fetchData returns { title?, stats?: [{label,value,sub?}], items?: [{text,url?,badge?,sub?}],
//                     attention?: [{text,url,level:"high"|"med"|"low"}], setup?: string, error?: string }
export const providers = { github, youtube, twitch, attention, weather, calendar, email, news, ai, credits };

// Secrets the options menu can set. Stored in .env, never sent back to the browser (except `secret: false` ones).
// `group` = heading in the Keys tab; `for` = widget types that use the key ("@ai" = AI model providers). The tab
// orders groups by what needs you: failing widgets first, then missing keys, working ones, AI, and keys for widgets that are off.
export const KEYS = [
  { group: "AI models", for: ["@ai"], key: "ANTHROPIC_API_KEY", label: "Anthropic API key", help: "Lets Claude write the brief and answer chat. Then pick a claude-* model on the AI tab.", url: "https://console.anthropic.com/settings/keys" },
  { group: "AI models", for: ["@ai"], key: "OPENROUTER_API_KEY", label: "OpenRouter API key", help: "One key, any hosted model. Then pick an openrouter/… model on the AI tab.", url: "https://openrouter.ai/keys" },
  { group: "AI credits", for: ["credits"], key: "ANTHROPIC_ADMIN_KEY", label: "Anthropic admin key", help: "Month-to-date spend. sk-ant-admin…, organization accounts only.", url: "https://platform.claude.com/settings/admin-keys" },
  { group: "AI credits", for: ["credits"], key: "OPENAI_ADMIN_KEY", label: "OpenAI admin key", help: "Month-to-date spend. An admin key, not a project key.", url: "https://platform.openai.com/settings/organization/admin-keys" },
  { group: "AI credits", for: ["credits"], key: "OPENROUTER_MANAGEMENT_KEY", optional: true, label: "OpenRouter management key", help: "Optional. Exact credits left; without it the card uses your normal key’s limit.", url: "https://openrouter.ai/settings/keys" },
  { group: "AI credits", for: ["credits"], key: "DEEPSEEK_API_KEY", label: "DeepSeek API key", help: "Account balance.", url: "https://platform.deepseek.com/api_keys" },
  { group: "Calendar", for: ["calendar"], key: "CALENDAR_ICS", label: "Calendar iCal URL", help: "Google Calendar → Settings → your calendar → Secret address in iCal format. Comma-separate several." },
  { group: "Inbox", for: ["email"], key: "GMAIL_USER", label: "Gmail address", help: "", secret: false },
  { group: "Inbox", for: ["email"], key: "GMAIL_APP_PASSWORD", label: "Gmail app password", help: "Google Account → Security → 2-Step Verification → App passwords.", url: "https://myaccount.google.com/apppasswords" },
  { group: "GitHub", for: ["github","attention"], key: "GITHUB_TOKEN", optional: true, label: "GitHub token", help: "Optional if `gh auth login` is done. Scopes: repo, notifications.", url: "https://github.com/settings/tokens" },
  { group: "YouTube", for: ["youtube"], key: "YOUTUBE_API_KEY", label: "YouTube API key", help: "Google Cloud → YouTube Data API v3 → Credentials.", url: "https://console.cloud.google.com/apis/credentials" },
  { group: "YouTube", for: ["youtube"], key: "YOUTUBE_CHANNEL_ID", label: "YouTube channel id", help: "Starts with UC. YouTube Studio → Settings → Channel → Advanced.", secret: false },
  { group: "Twitch", for: ["twitch"], key: "TWITCH_LOGIN", label: "Twitch channel", help: "Your channel name.", secret: false },
  { group: "Twitch", for: ["twitch"], key: "TWITCH_CLIENT_ID", label: "Twitch client id", help: "dev.twitch.tv → Console → Register application.", url: "https://dev.twitch.tv/console/apps", secret: false },
  { group: "Twitch", for: ["twitch"], key: "TWITCH_CLIENT_SECRET", label: "Twitch client secret", help: "Same application → New secret." },
  { group: "Twitch", for: ["twitch"], key: "TWITCH_USER_TOKEN", optional: true, label: "Twitch user token", help: "Optional, for follower count. Needs moderator:read:followers." },
];

// Per-widget settings shown in the Widgets tab. Types: text | number | select | list (one per line).
// `k` may be dotted ("budget.anthropic") to write into a nested object. `ph` is an example, shown greyed.
export const OPTION_FIELDS = {
  attention: [],
  calendar: [
    { k: "days", label: "Days ahead", type: "number", min: 1, max: 30, def: 7 },
    { k: "max", label: "Events shown", type: "number", min: 1, max: 20, def: 6 },
  ],
  weather: [
    { k: "city", label: "City", type: "text", ph: "blank = guess from your network" },
    { k: "units", label: "Units", type: "select", options: [["c", "°C"], ["f", "°F"]], def: "c" },
  ],
  email: [{ k: "max", label: "Messages shown", type: "number", min: 1, max: 20, def: 6 }],
  news: [
    { k: "feeds", label: "Feeds", type: "list", ph: "one RSS URL per line · blank = Hacker News, BBC World, Ars Technica" },
    { k: "max", label: "Stories shown", type: "number", min: 1, max: 20, def: 10 },
  ],
  github: [
    { k: "user", label: "GitHub login", type: "text", ph: "e.g. octocat" },
    { k: "top", label: "Repos shown", type: "number", min: 1, max: 20, def: 5 },
    { k: "window", label: "Traffic window", type: "select", options: [[7, "7 days"], [14, "14 days"], [30, "30 days"], [90, "90 days"]], def: 14 },
  ],
  youtube: [{ k: "channelId", label: "Channel id", type: "text", ph: "blank = the one on the Keys tab" }],
  twitch: [{ k: "login", label: "Channel", type: "text", ph: "blank = the one on the Keys tab" }],
  credits: [
    { k: "budget.anthropic", label: "Anthropic budget ($/month)", type: "number", min: 0, ph: "none" },
    { k: "budget.openai", label: "OpenAI budget ($/month)", type: "number", min: 0, ph: "none" },
  ],
  ai: [],
  garden: [],
  noticed: [],
};
