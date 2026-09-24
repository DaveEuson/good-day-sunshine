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

// Secrets the options menu can set. Stored in .env, never sent back to the browser.
export const KEYS = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic API key", help: "Lets Claude write the brief and answer chat instead of a local model. Pick a claude-* model in the AI section.", url: "https://console.anthropic.com/settings/keys" },
  { key: "OPENROUTER_API_KEY", label: "OpenRouter API key", help: "One key, any hosted model. Pick an openrouter/… model in the AI section. Sends your dashboard data to OpenRouter.", url: "https://openrouter.ai/keys" },
  { key: "ANTHROPIC_ADMIN_KEY", label: "Anthropic admin key", help: "For the AI credits card: month-to-date spend. sk-ant-admin…, organization accounts only (Console → Settings → Admin keys).", url: "https://platform.claude.com/settings/admin-keys" },
  { key: "OPENAI_ADMIN_KEY", label: "OpenAI admin key", help: "For the AI credits card: month-to-date spend. Admin key, not a project key (platform.openai.com → Settings → Admin keys).", url: "https://platform.openai.com/settings/organization/admin-keys" },
  { key: "OPENROUTER_MANAGEMENT_KEY", label: "OpenRouter management key", help: "Optional. Exact credits balance for the AI credits card; without it the card uses your normal key’s limit/usage.", url: "https://openrouter.ai/settings/keys" },
  { key: "DEEPSEEK_API_KEY", label: "DeepSeek API key", help: "For the AI credits card: account balance.", url: "https://platform.deepseek.com/api_keys" },
  { key: "GITHUB_TOKEN", label: "GitHub token", help: "Optional if `gh auth login` is done. Scopes: repo, notifications.", url: "https://github.com/settings/tokens" },
  { key: "YOUTUBE_API_KEY", label: "YouTube API key", help: "Google Cloud → APIs → YouTube Data API v3 → Credentials.", url: "https://console.cloud.google.com/apis/credentials" },
  { key: "YOUTUBE_CHANNEL_ID", label: "YouTube channel id", help: "UC… (YouTube Studio → Settings → Channel → Advanced).", secret: false },
  { key: "TWITCH_CLIENT_ID", label: "Twitch client id", help: "dev.twitch.tv → Console → Register app.", url: "https://dev.twitch.tv/console/apps", secret: false },
  { key: "TWITCH_CLIENT_SECRET", label: "Twitch client secret", help: "Same app → New secret." },
  { key: "TWITCH_LOGIN", label: "Twitch login", help: "Your channel name.", secret: false },
  { key: "TWITCH_USER_TOKEN", label: "Twitch user token", help: "Optional, for follower count. Needs moderator:read:followers." },
  { key: "CALENDAR_ICS", label: "Calendar iCal URL(s)", help: "Google Calendar → Settings → your calendar → Secret address in iCal format. Comma-separate several." },
  { key: "GMAIL_USER", label: "Gmail address", help: "", secret: false },
  { key: "GMAIL_APP_PASSWORD", label: "Gmail app password", help: "Google Account → Security → 2-Step → App passwords.", url: "https://myaccount.google.com/apppasswords" },
];

// Shown in the options menu as the per-widget options placeholder.
export const OPTION_HINTS = {
  github: '{"user":"your-login","top":6,"window":14}',
  youtube: '{"channelId":"UC..."}',
  twitch: '{"login":"yourchannel"}',
  attention: "{}",
  weather: '{"city":"London","units":"c"}',
  calendar: '{"days":7,"max":6}',
  email: '{"max":6}',
  news: '{"feeds":["https://hnrss.org/frontpage"],"max":10}',
  garden: "{}",
  ai: "{}",
  credits: '{"budget":{"anthropic":50,"openai":20}}',
};
