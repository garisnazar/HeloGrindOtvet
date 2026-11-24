const TG = "https://api.telegram.org/bot";

const REGIONS = [
  "Москва", "Московская область", "Санкт-Петербург", "Ленинградская область",
  "Новосибирская область", "Свердловская область", "Татарстан",
  "Краснодарский край", "Ростовская область", "Башкортостан",
  "Челябинская область", "Нижегородская область", "Самарская область",
  "Красноярский край", "Воронежская область", "Пермский край",
  "Волгоградская область", "Саратовская область", "Тюменская область",
  "Иркутская область", "Омская область", "Приморский край",
  "Ставропольский край", "Хабаровский край", "Алтайский край"
];

const SUBJECTS = [
  "Русский язык", "Математика (профиль)", "Математика (база)",
  "Обществознание", "История", "Физика", "Химия", "Биология",
  "Информатика", "Английский язык", "Немецкий язык", "Французский язык",
  "Испанский язык", "Литература", "География"
];

async function tg(env, method, payload = {}) {
  const r = await fetch(`${TG}${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

const sendMessage = (env, chat_id, text, kb) =>
  tg(env, "sendMessage", {
    chat_id, text, parse_mode: "HTML",
    reply_markup: kb, disable_web_page_preview: true,
  });

const editMessage = (env, chat_id, message_id, text, kb) =>
  tg(env, "editMessageText", {
    chat_id, message_id, text, parse_mode: "HTML",
    reply_markup: kb, disable_web_page_preview: true,
  });

const answerCb = (env, id, text = "") =>
  tg(env, "answerCallbackQuery", { callback_query_id: id, text });

function paginated(items, prefix, page = 0, perPage = 6, backData = null) {
  const pages = Math.ceil(items.length / perPage);
  const chunk = items.slice(page * perPage, page * perPage + perPage);

  const rows = chunk.map((item, i) => ([{
    text: item,
    callback_data: `${prefix}:${page * perPage + i}:${page}`,
  }]));

  const nav = [];
  if (page > 0) nav.push({ text: "⬅️", callback_data: `${prefix}_page:${page - 1}` });
  if (page < pages - 1) nav.push({ text: "➡️", callback_data: `${prefix}_page:${page + 1}` });
  if (nav.length) rows.push(nav);
  if (backData) rows.push([{ text: "↩️ Назад", callback_data: backData }]);

  return { inline_keyboard: rows };
}

function startKeyboard(env) {
  const rows = [[
    { text: "🎓 Ответы ЕГЭ", callback_data: "exam:ege" },
    { text: "📘 Ответы ОГЭ", callback_data: "exam:oge" },
  ]];
  if (env.SUPPORT_URL) rows.push([{ text: "👨‍💻 Поддержка", url: env.SUPPORT_URL }]);
  return { inline_keyboard: rows };
}

const START_TEXT =
  "🔥 <b>ОТВЕТЫ НА ОГЭ ЕГЭ 2027</b> 🔥\n\n" +
  "✅ Реальные варианты 2027 года\n" +
  "✅ Все регионы России\n" +
  "✅ Моментальная выдача — сразу 5 вариантов\n" +
  "✅ Проверено тысячами выпускников\n\n" +
  "👇 <b>Выберите, что вам нужно:</b>";

async function onStart(env, msg) {
  return sendMessage(env, msg.chat.id, START_TEXT, startKeyboard(env));
}

async function onCallback(env, cb) {
  const data = cb.data || "";
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;

  try {
    if (data.startsWith("exam:")) {
      const type = data.split(":")[1].toUpperCase();
      await editMessage(
        env, chatId, msgId,
        `📍 <b>Вы выбрали: ${type}</b>\n\nУкажите ваш регион:`,
        paginated(REGIONS, "region", 0, 6, "back_start")
      );
      return answerCb(env, cb.id);
    }

    if (data.startsWith("region_page:")) {
      const page = +data.split(":")[1];
      await editMessage(
        env, chatId, msgId,
        "📍 Укажите ваш регион:",
        paginated(REGIONS, "region", page, 6, "back_start")
      );
      return answerCb(env, cb.id);
    }

    if (data.startsWith("region:")) {
      const [, idx] = data.split(":");
      const region = REGIONS[+idx];
      await editMessage(
        env, chatId, msgId,
        `📍 Регион: <b>${region}</b>\n\nТеперь выберите предмет:`,
        paginated(SUBJECTS, "subject", 0, 6, "back_start")
      );
      return answerCb(env, cb.id);
    }

    if (data.startsWith("subject_page:")) {
      const page = +data.split(":")[1];
      await editMessage(
        env, chatId, msgId,
        "📖 Выберите предмет:",
        paginated(SUBJECTS, "subject", page, 6, "back_start")
      );
      return answerCb(env, cb.id);
    }

    if (data.startsWith("subject:")) {
      const [, idx] = data.split(":");
      const subject = SUBJECTS[+idx];
      const text =
        "🧾 <b>Ваш заказ</b>\n\n" +
        `📖 Предмет: <b>${subject}</b>\n\n` +
        "💳 <b>Стоимость: 1 000 ₽</b>\n" +
        "🎁 Вы получите <b>СРАЗУ 5 вариантов</b> с ответами.\n\n" +
        "Нажмите «Оплатить», чтобы получить реквизиты:";

      const kb = {
        inline_keyboard: [
          [{ text: "💳 Оплатить 1000 ₽", callback_data: "pay_now" }],
          [{ text: "↩️ Назад", callback_data: "back_start" }],
        ],
      };
      await editMessage(env, chatId, msgId, text, kb);
      return answerCb(env, cb.id);
    }

    if (data === "pay_now") {
      const text =
        "💳 <b>Реквизиты для оплаты</b>\n\n" +
        "Номер карты:\n" +
        "<code>2200 2088 5803 3443</code>\n\n" +
        "Сумма: <b>1 000 ₽</b>\n\n" +
        "📌 После перевода нажмите «Я оплатил» и пришлите чек в поддержку — " +
        "ответы выдадим в течение 5 минут.";

      const rows = [
        [{ text: "✅ Я оплатил(а)", callback_data: "paid_done" }],
      ];
      if (env.SUPPORT_URL) rows.push([{ text: "👨‍💻 Поддержка", url: env.SUPPORT_URL }]);
      rows.push([{ text: "↩️ Назад", callback_data: "back_start" }]);

      await editMessage(env, chatId, msgId, text, { inline_keyboard: rows });
      return answerCb(env, cb.id);
    }

    if (data === "paid_done") {
      const text =
        "✅ <b>Спасибо!</b>\n\n" +
        "Пришлите чек об оплате в поддержку — " +
        "ответы выдадим в течение 5 минут.";
      const rows = [];
      if (env.SUPPORT_URL) rows.push([{ text: "👨‍💻 Написать в поддержку", url: env.SUPPORT_URL }]);
      await editMessage(env, chatId, msgId, text, { inline_keyboard: rows });
      return answerCb(env, cb.id, "Ожидайте выдачи");
    }

    if (data === "back_start") {
      await editMessage(env, chatId, msgId, START_TEXT, startKeyboard(env));
      return answerCb(env, cb.id);
    }
  } catch (e) {
    console.error("callback error:", e);
    return answerCb(env, cb.id, "Ошибка, попробуйте ещё раз");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Exam Bot Worker is running", { status: 200 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("bad json", { status: 400 });
    }

    if (update.message) {
      const msg = update.message;
      if (msg.text && msg.text.startsWith("/start")) {
        await onStart(env, msg);
      }
    } else if (update.callback_query) {
      await onCallback(env, update.callback_query);
    }

    return new Response("ok");
  },
};