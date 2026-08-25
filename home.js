const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const insideTelegram = !!(tg && tg.initData);
if (tg) {
  tg.ready();
  tg.expand();
  applyThemeFromTelegram();
  tg.onEvent && tg.onEvent("themeChanged", applyThemeFromTelegram);
}
function applyThemeFromTelegram() {
  const p = tg.themeParams || {};
  const root = document.documentElement.style;
  if (p.bg_color) root.setProperty("--bg", p.bg_color);
  if (p.text_color) root.setProperty("--text", p.text_color);
  if (p.hint_color) root.setProperty("--text-hint", p.hint_color);
  if (p.secondary_bg_color) root.setProperty("--card", p.secondary_bg_color);
}
const tgBannerEl = document.getElementById("tgBanner");
if (tgBannerEl) tgBannerEl.hidden = insideTelegram;

const form = document.getElementById("homeSearchForm");
const input = document.getElementById("homeSearchInput");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  location.href = q ? `browse.html?q=${encodeURIComponent(q)}` : "browse.html";
});
