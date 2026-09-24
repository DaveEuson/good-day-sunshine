// Local AI status: which models answer the brief and chat, whether Ollama is up, what it has loaded, GPU memory if nvidia-smi exists.
import { execFile } from "node:child_process";

export const meta = { title: "Local AI", icon: "✳" };

const provider = (m) => (/^claude-/.test(m) ? "Anthropic" : /^openrouter\//.test(m) ? "OpenRouter" : "Ollama");
const gb = (b) => `${(b / 1e9).toFixed(1)} GB`;

function gpu() {
  return new Promise((resolve) => {
    execFile("nvidia-smi", ["--query-gpu=name,memory.used,memory.total,utilization.gpu", "--format=csv,noheader,nounits"], { timeout: 3000 }, (err, out) => {
      if (err || !out) return resolve(null);
      const [name, used, total, util] = out.trim().split("\n")[0].split(",").map((s) => s.trim());
      resolve({ name, used: +used, total: +total, util: +util });
    });
  });
}

export async function fetchData(cfg, env) {
  const briefModel = env.OLLAMA_MODEL || "qwen3.5:9b", chatModel = env.CHAT_MODEL || "llama3.2:3b";
  const url = env.OLLAMA_URL || "http://localhost:11434";
  let ps = null;
  try { ps = await (await fetch(`${url}/api/ps`, { signal: AbortSignal.timeout(3000) })).json(); } catch {}
  const g = await gpu();
  const cloud = [provider(briefModel), provider(chatModel)].filter((p) => p !== "Ollama");

  const stats = [
    { label: "Ollama", value: ps ? "Connected" : "Offline", sub: ps ? `${ps.models.length} loaded` : url.replace(/^https?:\/\//, "") },
  ];
  if (g) stats.push({ label: g.name.replace(/NVIDIA GeForce /, ""), value: `${(g.used / 1024).toFixed(1)} / ${(g.total / 1024).toFixed(0)} GB`, sub: `${g.util}% busy` });
  stats.push({ label: "Privacy", value: cloud.length ? "Cloud" : "Local only", sub: cloud.length ? `data goes to ${[...new Set(cloud)].join(", ")}` : "nothing leaves this machine" });

  const items = [
    { text: `Brief: ${briefModel}`, sub: provider(briefModel) },
    { text: `Chat: ${chatModel}`, sub: provider(chatModel) },
    ...(ps?.models ?? []).map((m) => ({ text: `Loaded: ${m.name}`, sub: `${m.details?.parameter_size ?? ""} ${m.details?.quantization_level ?? ""}`.trim(), badge: `${gb(m.size_vram || m.size)} VRAM` })),
  ];
  const attention = !ps && !cloud.length ? [{ text: "Ollama is offline and no cloud model is set: brief and chat will fall back.", url: "", level: "high" }] : [];
  return { stats, items, attention };
}
