chrome.storage.sync.get({ url: "http://localhost:4242/" }, async ({ url }) => {
  try {
    await fetch(new URL("/api/users", url), { signal: AbortSignal.timeout(1500) });
    const f = document.getElementById("page");
    f.src = url; f.hidden = false;
  } catch {
    document.getElementById("down").style.display = "flex";
  }
});
document.getElementById("cfg").onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
