const MINIAPP_URL = "https://gvinp.github.io/cordoba-carnet-quiz/";
const WELCOME_TEXT =
  "🚦 Готовлю к теоретическому экзамену на права категории B в Кордове.\n\n" +
  "205 билетов на испанском и русском, поиск по темам, практика по всем вопросам или как на настоящем экзамене (30 вопросов).\n\n" +
  "Жми кнопку ниже, чтобы начать.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://gvinp.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/telegram-webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    if (url.pathname === "/track" && request.method === "POST") {
      return handleTrack(request, env);
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      return handleStats(request, env);
    }

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleWebhook(request, env) {
  const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (secret !== env.WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const message = update.message;
  if (message && message.from) {
    await upsertUser(env, message.from, { startedBot: message.text === "/start" });

    if (message.text === "/start") {
      await sendMessage(env, message.chat.id, WELCOME_TEXT, {
        inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: MINIAPP_URL } }]],
      });
    }
  }

  return new Response("ok");
}

async function handleTrack(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400, headers: CORS_HEADERS });
  }

  const initData = body && body.initData;
  if (!initData || typeof initData !== "string") {
    return new Response("Bad Request", { status: 400, headers: CORS_HEADERS });
  }

  const user = await verifyInitData(initData, env.TELEGRAM_BOT_TOKEN);
  if (!user) {
    return new Response("Invalid initData", { status: 401, headers: CORS_HEADERS });
  }

  await upsertUser(env, user, { startedBot: false });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

async function handleStats(request, env) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key !== env.STATS_KEY) {
    return new Response("Forbidden", { status: 403 });
  }

  const totals = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total_users,
       SUM(started_bot) AS started_bot_count,
       SUM(CASE WHEN last_seen_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS active_1d,
       SUM(CASE WHEN last_seen_at >= datetime('now', '-7 day') THEN 1 ELSE 0 END) AS active_7d,
       SUM(CASE WHEN last_seen_at >= datetime('now', '-30 day') THEN 1 ELSE 0 END) AS active_30d,
       SUM(open_count) AS total_opens
     FROM bot_users`
  ).first();

  return new Response(JSON.stringify(totals, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}

async function upsertUser(env, from, { startedBot }) {
  await env.DB.prepare(
    `INSERT INTO bot_users (user_id, username, first_name, started_bot)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(user_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       last_seen_at = datetime('now'),
       open_count = open_count + 1,
       started_bot = MAX(started_bot, excluded.started_bot)`
  )
    .bind(from.id, from.username || null, from.first_name || null, startedBot ? 1 : 0)
    .run();
}

async function sendMessage(env, chatId, text, replyMarkup) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });
}

// Validates Telegram WebApp initData per the documented algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
async function verifyInitData(initData, botToken) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const pairs = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`);
  const dataCheckString = pairs.join("\n");

  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretKeyBytes = await crypto.subtle.sign("HMAC", secretKey, encoder.encode(botToken));

  const signingKey = await crypto.subtle.importKey(
    "raw",
    secretKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", signingKey, encoder.encode(dataCheckString));
  const computedHash = [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (computedHash !== hash) return null;

  const authDate = Number(params.get("auth_date") || 0);
  const MAX_AGE_SECONDS = 86400;
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}
