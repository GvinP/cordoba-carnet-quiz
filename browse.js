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

const listEl = document.getElementById("list");
const searchInput = document.getElementById("searchInput");
const searchEmptyEl = document.getElementById("searchEmpty");
const countLabelEl = document.getElementById("countLabel");

countLabelEl.textContent = `${QUESTIONS.length} вопросов`;

function optionRow(q, opt) {
  const isCorrect = opt.key === q.correct;
  const imgHtml = opt.image ? `<img class="option-image" src="${opt.image}" alt="" />` : "";
  return `
    <div class="b-option${isCorrect ? " b-correct" : ""}">
      <span class="key">${opt.key}${isCorrect ? " ✓" : ""}</span>
      <span class="txt">
        ${imgHtml}
        <span class="es">${opt.es}</span>
        <span class="ru">${opt.ru}</span>
      </span>
    </div>`;
}

function card(q) {
  const el = document.createElement("article");
  el.className = "ticket-card";

  const imgHtml = q.image ? `<img class="q-image" src="${q.image}" alt="" />` : "";
  const verifyHtml = q.verify
    ? `<p class="note">⚠ Точная цифра здесь не проверена по официальному источнику — сверь с методичкой.</p>`
    : "";

  el.innerHTML = `
    <div class="ticket-num">№ ${q.id}</div>
    ${imgHtml}
    <p class="q-es">${q.es}</p>
    <p class="q-ru">${q.ru}</p>
    <div class="b-options">${q.options.map((o) => optionRow(q, o)).join("")}</div>
    ${verifyHtml}
  `;

  el.dataset.search = `${q.id} ${q.es} ${q.ru} ${q.options.map((o) => `${o.es} ${o.ru}`).join(" ")}`.toLowerCase();
  return el;
}

const frag = document.createDocumentFragment();
QUESTIONS.forEach((q) => frag.appendChild(card(q)));
listEl.appendChild(frag);

const cards = [...listEl.children];

function applyFilter() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = 0;
  cards.forEach((el) => {
    const match = !query || el.dataset.search.includes(query);
    el.hidden = !match;
    if (match) visible += 1;
  });
  searchEmptyEl.hidden = visible !== 0;
}

let debounceTimer = null;
searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(applyFilter, 80);
});

const initialQuery = new URLSearchParams(location.search).get("q");
if (initialQuery) {
  searchInput.value = initialQuery;
  applyFilter();
}
