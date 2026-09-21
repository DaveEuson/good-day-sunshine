import * as github from "./github.js";
import * as youtube from "./youtube.js";
import * as twitch from "./twitch.js";
import * as attention from "./attention.js";

// Add a provider: export { meta, fetchData(cfg, env) } and register here.
// fetchData returns { stats?: [{label,value,sub?}], items?: [{text,url,badge?,sub?}],
//                     attention?: [{text,url,level:"high"|"med"|"low"}], setup?: string, error?: string }
export const providers = { github, youtube, twitch, attention };
