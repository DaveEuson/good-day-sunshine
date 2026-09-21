import * as github from "./github.js";
import * as youtube from "./youtube.js";
import * as twitch from "./twitch.js";
import * as attention from "./attention.js";
import * as weather from "./weather.js";
import * as calendar from "./calendar.js";
import * as email from "./email.js";
import * as news from "./news.js";

// Add a provider: export { meta, fetchData(cfg, env) } and register here.
// fetchData returns { title?, stats?: [{label,value,sub?}], items?: [{text,url?,badge?,sub?}],
//                     attention?: [{text,url,level:"high"|"med"|"low"}], setup?: string, error?: string }
export const providers = { github, youtube, twitch, attention, weather, calendar, email, news };

// Shown in the options menu as the per-widget options placeholder.
export const OPTION_HINTS = {
  github: '{"user":"your-login","top":6}',
  youtube: '{"channelId":"UC..."}',
  twitch: '{"login":"yourchannel"}',
  attention: "{}",
  weather: '{"city":"London","units":"c"}',
  calendar: '{"days":7,"max":6}',
  email: '{"max":6}',
  news: '{"feeds":["https://hnrss.org/frontpage"],"max":10}',
  garden: "{}",
};
