// --- Telegram WebApp bootstrap -------------------------------------------
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const insideTelegram = !!(tg && tg.initData);

if (tg) {
  tg.ready();
  tg.expand();
  applyThemeFromTelegram();
  tg.onEvent && tg.onEvent("themeChanged", applyThemeFromTelegram);
}

const tgBannerEl = document.getElementById("tgBanner");
if (tgBannerEl) tgBannerEl.hidden = insideTelegram;

function applyThemeFromTelegram() {
  const p = tg.themeParams || {};
  const root = document.documentElement.style;
  if (p.bg_color) root.setProperty("--bg", p.bg_color);
  if (p.text_color) root.setProperty("--text", p.text_color);
  if (p.hint_color) root.setProperty("--text-hint", p.hint_color);
  if (p.secondary_bg_color) root.setProperty("--card", p.secondary_bg_color);
}

function haptic(style) {
  if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(style);
}

const ANSWERABLE = QUESTIONS.filter((q) => !q.needsImage);
const PENDING_IMAGES = QUESTIONS.length - ANSWERABLE.length;

let deck = shuffle(ANSWERABLE.slice());
let index = 0;
let answered = false;
let results = []; // { question, chosenKey, correct }

const qImage = document.getElementById("qImage");
const qEs = document.getElementById("qEs");
const qRu = document.getElementById("qRu");
const optionsEl = document.getElementById("options");
const noteEl = document.getElementById("note");
const nextBtn = document.getElementById("nextBtn");
const progressPill = document.getElementById("progressPill");
const progressFill = document.getElementById("progressFill");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderQuestion() {
  answered = false;
  nextBtn.disabled = true;
  nextBtn.textContent = index === deck.length - 1 ? "Результаты →" : "Далее →";

  const q = deck[index];
  qEs.textContent = q.es;
  qRu.textContent = q.ru;

  if (q.image) {
    qImage.src = q.image;
    qImage.hidden = false;
  } else {
    qImage.hidden = true;
    qImage.removeAttribute("src");
  }

  progressPill.textContent = `${index + 1}/${deck.length}`;
  progressFill.style.width = `${((index + 1) / deck.length) * 100}%`;

  if (q.note) {
    noteEl.hidden = false;
    noteEl.textContent = q.note;
  } else if (q.verify) {
    noteEl.hidden = false;
    noteEl.textContent = "⚠ Точная цифра здесь не проверена по официальному источнику — сверь с методичкой.";
  } else {
    noteEl.hidden = true;
  }

  optionsEl.innerHTML = "";
  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option";
    const imgHtml = opt.image ? `<img class="option-image" src="${opt.image}" alt="" />` : "";
    btn.innerHTML = `
      <span class="key">${opt.key}</span>
      <span class="txt">
        ${imgHtml}
        <span class="es">${opt.es}</span>
        <span class="ru">${opt.ru}</span>
      </span>
    `;
    btn.addEventListener("click", () => selectAnswer(q, opt.key, btn));
    optionsEl.appendChild(btn);
  });
}

function selectAnswer(question, chosenKey, btnEl) {
  if (answered) return;
  answered = true;

  const isCorrect = chosenKey === question.correct;
  results.push({ question, chosenKey, correct: isCorrect });
  haptic(isCorrect ? "light" : "medium");

  [...optionsEl.children].forEach((btn, i) => {
    const opt = question.options[i];
    btn.disabled = true;
    if (opt.key === question.correct) btn.classList.add("correct");
    else if (opt.key === chosenKey) btn.classList.add("wrong");
  });

  nextBtn.disabled = false;
}

function next() {
  if (!answered) return;
  index += 1;
  if (index >= deck.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

function showResults() {
  quizScreen.hidden = true;
  resultScreen.hidden = false;

  const total = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const pct = Math.round((correctCount / total) * 100);

  document.getElementById("resultScore").textContent = `${correctCount} / ${total}`;

  const emojiEl = document.getElementById("resultEmoji");
  const textEl = document.getElementById("resultText");
  if (pct === 100) {
    emojiEl.textContent = "🏆";
    textEl.textContent = "Все верно! Можно идти сдавать.";
  } else if (pct >= 80) {
    emojiEl.textContent = "🎉";
    textEl.textContent = "Отличный результат, ещё чуть-чуть — и порядок.";
  } else if (pct >= 50) {
    emojiEl.textContent = "🙂";
    textEl.textContent = "Неплохо, но стоит повторить ошибки.";
  } else {
    emojiEl.textContent = "📖";
    textEl.textContent = "Пока рано — разбери ошибки ниже и попробуй снова.";
  }

  const wrong = results.filter((r) => !r.correct);
  const retryBtn = document.getElementById("retryWrongBtn");
  retryBtn.hidden = wrong.length === 0;
  retryBtn.onclick = () => startQuiz(wrong.map((r) => r.question));

  const reviewEl = document.getElementById("review");
  reviewEl.innerHTML = wrong
    .map((r) => {
      const correctOpt = r.question.options.find((o) => o.key === r.question.correct);
      const chosenOpt = r.question.options.find((o) => o.key === r.chosenKey);
      return `
        <div class="review-item">
          <div class="q">${r.question.es}</div>
          <div class="a wrong">Ваш ответ: ${chosenOpt.es}</div>
          <div class="a right">Верно: ${correctOpt.es}</div>
        </div>`;
    })
    .join("");
}

function startQuiz(pool) {
  deck = shuffle(pool.slice());
  index = 0;
  results = [];
  quizScreen.hidden = false;
  resultScreen.hidden = true;
  renderQuestion();
}

nextBtn.addEventListener("click", next);
document.getElementById("restartBtn").addEventListener("click", () => startQuiz(ANSWERABLE));

const pendingEl = document.getElementById("pendingImages");
if (pendingEl) {
  if (PENDING_IMAGES > 0) {
    pendingEl.hidden = false;
    pendingEl.textContent = `Ещё ${PENDING_IMAGES} билетов ждут картинок — их пока нет в игре.`;
  } else {
    pendingEl.hidden = true;
  }
}

renderQuestion();
