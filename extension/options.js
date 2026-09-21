const $ = (s) => document.querySelector(s);
chrome.storage.sync.get({ url: "http://localhost:4242/" }, ({ url }) => { $("#url").value = url; });
$("#save").onclick = () => {
  let url = $("#url").value.trim() || "http://localhost:4242/";
  if (!/^https?:\/\//.test(url)) url = "http://" + url;
  chrome.storage.sync.set({ url }, () => { $("#ok").textContent = "Saved"; });
};
