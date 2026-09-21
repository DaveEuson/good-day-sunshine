// Things that need you: GitHub notifications, review requests, assigned issues.
import { gh, token } from "./github.js";

export const meta = { title: "Needs attention", icon: "!" };

const htmlUrl = (n) => {
  const u = n.subject?.url ?? "";
  return u.replace("api.github.com/repos", "github.com").replace("/pulls/", "/pull/");
};

export async function fetchData(cfg, env) {
  const tok = token(env);
  if (!tok) return { setup: "Set GitHub token in ⚙ Options → Keys, or run gh auth login." };

  const [notifs, reviews, assigned] = await Promise.all([
    gh("/notifications?per_page=20", tok).catch(() => []),
    gh("/search/issues?q=is:open+is:pr+review-requested:@me&per_page=10", tok).catch(() => ({ items: [] })),
    gh("/search/issues?q=is:open+assignee:@me&per_page=10", tok).catch(() => ({ items: [] })),
  ]);

  const attention = [
    ...reviews.items.map((p) => ({ text: `Review: ${p.title}`, url: p.html_url, level: "high" })),
    ...notifs.map((n) => ({ text: `${n.repository.name}: ${n.subject.title}`, url: htmlUrl(n), level: n.reason === "mention" ? "high" : "med" })),
    ...assigned.items.map((i) => ({ text: `Assigned: ${i.title}`, url: i.html_url, level: "low" })),
  ];

  return {
    stats: [
      { label: "Unread", value: notifs.length },
      { label: "Reviews", value: reviews.total_count ?? reviews.items.length },
      { label: "Assigned", value: assigned.total_count ?? assigned.items.length },
    ],
    attention,
  };
}
