// Lightweight usage beacon: pings the Cloudflare Worker once per page load
// when running inside Telegram, so we can see how many people actually use
// the bot/app. Fails silently outside Telegram or if the worker is down —
// never blocks or breaks the page.
(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg || !tg.initData) return;

  var TRACK_URL = "https://cordoba-carnet-bot.WORKERS_SUBDOMAIN.workers.dev/track";

  fetch(TRACK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData: tg.initData }),
  }).catch(function () {});
})();
