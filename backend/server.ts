import "dotenv/config";
import path from "path";
import http from "http";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Telegraf, Markup } from "telegraf";
import { message } from "telegraf/filters";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { jsonrepair } from "jsonrepair";
import { TN_VED_DATABASE } from "./src/utils/ved-knowledge";
import { calculateDuty } from "./src/agents/ved-customs";
import type { TnVedCode } from "./src/types/ved";

// ─── Clients ──────────────────────────────────────────────────────────────────

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findProduct(query: string): TnVedCode | null {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const scored = TN_VED_DATABASE.map((entry) => {
    let score = 0;
    for (const word of words) {
      for (const kw of entry.keywords) {
        if (kw.includes(word) || word.includes(kw)) score += 3;
      }
      if (entry.description.toLowerCase().includes(word)) score += 2;
    }
    return { entry, score };
  });
  const best = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score)[0];
  return best?.entry ?? null;
}

function parseAmount(text: string): { value: number; currency: "USD" | "EUR" | "RUB" } | null {
  const d = text.match(/(\d+(?:[.,]\d+)?)\s*(?:доллар\w*|usd|\$)/i);
  const e = text.match(/(\d+(?:[.,]\d+)?)\s*(?:евро|eur|€)/i);
  const r = text.match(/(\d+(?:[.,]\d+)?)\s*(?:руб\w*|rub|₽)/i);
  if (d) return { value: parseFloat(d[1].replace(",", ".")), currency: "USD" };
  if (e) return { value: parseFloat(e[1].replace(",", ".")), currency: "EUR" };
  if (r) return { value: parseFloat(r[1].replace(",", ".")), currency: "RUB" };
  return null;
}

function parseQty(text: string): number {
  const m = text.match(/(\d+)\s*(?:шт\w*|единиц\w*|pcs|pieces|ед\.?)/i);
  return m ? parseInt(m[1]) : 1;
}

// ─── Question branches ────────────────────────────────────────────────────────

type Question = { text: string; options?: string[] };

const STATIC_QUESTIONS: Record<string, Question[]> = {
  MACHINE: [
    { text: "С ЧПУ или без?", options: ["С ЧПУ", "Без ЧПУ"] },
    { text: "Какой материал обрабатывает?", options: ["Металл", "Дерево", "Пластик"] },
  ],
  CLOTHING: [
    { text: "Состав ткани?", options: ["Хлопок", "Синтетика", "Смешанный"] },
    { text: "Для кого?", options: ["Мужская", "Женская", "Детская"] },
  ],
};

// ─── AI: Classify product category ────────────────────────────────────────────

async function classifyProduct(productQuery: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 10,
    messages: [{
      role: "user",
      content:
        `Classify this product into one category. Reply with exactly one word from: MACHINE, CLOTHING, ELECTRONICS, OTHER.\n` +
        `Product: ${productQuery}`,
    }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text.trim().toUpperCase() : "OTHER";
  const valid = ["MACHINE", "CLOTHING", "ELECTRONICS", "OTHER"];
  return valid.includes(raw) ? raw : "OTHER";
}

// ─── AI: Dynamic questions for OTHER / ELECTRONICS ────────────────────────────

async function generateClarifyingQuestions(productQuery: string): Promise<Question[]> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content:
        `Ты эксперт ВЭД. Пользователь хочет ввезти: "${productQuery}". ` +
        `Задай ровно 3 уточняющих вопроса, которые критически важны для точного определения кода ТН ВЭД. ` +
        `Пиши коротко, каждый вопрос с новой строки, без нумерации, только сами вопросы.`,
    }],
  });
  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  // Dynamic questions have no predefined options — free text answer
  return text.split("\n").filter((q) => q.trim()).map((q) => ({ text: q.trim() }));
}

async function getQuestionsForCategory(category: string, productQuery: string): Promise<Question[]> {
  return STATIC_QUESTIONS[category] ?? await generateClarifyingQuestions(productQuery);
}

// ─── AI: HS code classification from dialog ───────────────────────────────────

type HsClassification = {
  hs_code: string;
  confidence: "high" | "medium" | "low";
  reason: string;
};

async function classifyHsCode(
  initial_query: string,
  user_answers: string[],
  category: string | null
): Promise<HsClassification | null> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content:
        `На основе диалога определи код ТН ВЭД.\n` +
        `Товар: ${initial_query}\n` +
        `Ответы пользователя: ${user_answers.join(", ")}\n` +
        `Категория: ${category ?? "OTHER"}\n\n` +
        `Верни JSON: {"hs_code": "XXXX.XX.XX", "confidence": "high|medium|low", "reason": "краткое пояснение"}`,
    }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonrepair(jsonMatch[0]));
    const valid = ["high", "medium", "low"];
    if (parsed.hs_code && valid.includes(parsed.confidence)) {
      return parsed as HsClassification;
    }
  } catch (err) {
    console.error("HS classification parse error:", err, "raw:", raw);
  }
  return null;
}

// ─── Session management (Supabase) ────────────────────────────────────────────

type Session = {
  original_query: string;
  bot_questions: string;     // JSON string of Question[]
  stage: string;             // 'questions' | future stages
  category: string | null;
  step_index: number;
  collected_answers: string; // JSON string of string[]
};

async function getSession(userId: number): Promise<Session | null> {
  const { data, error } = await supabase
    .from("dialog_sessions")
    .select("original_query, bot_questions, stage, category, step_index, collected_answers")
    .eq("user_id", userId)
    .single();
  if (error) {
    // PGRST116 = row not found — нормальная ситуация
    if (error.code !== "PGRST116") {
      console.error(`[getSession] DB error user=${userId}: ${error.message} (code=${error.code})`);
    }
    return null;
  }
  if (!data) return null;
  return data as Session;
}

async function saveSession(
  userId: number,
  original_query: string,
  bot_questions: string,
  stage = "questions",
  category: string | null = null,
  step_index = 0,
  collected_answers = "[]"
): Promise<void> {
  await supabase.from("dialog_sessions").upsert({
    user_id: userId,
    original_query,
    bot_questions,
    stage,
    category,
    step_index,
    collected_answers,
  });
}

async function updateSessionStep(userId: number, step_index: number, collected_answers: string): Promise<void> {
  await supabase.from("dialog_sessions").update({ step_index, collected_answers }).eq("user_id", userId);
}

async function deleteSession(userId: number): Promise<void> {
  await supabase.from("dialog_sessions").delete().eq("user_id", userId);
}

// ─── Response builder ─────────────────────────────────────────────────────────

function generateProfessionalResponse(
  product: TnVedCode,
  calc: { dutyAmount: number; vatAmount: number; totalPayments: number },
  qty: number,
  amount: { value: number; currency: "USD" | "EUR" | "RUB" }
): string {
  const totalValue = amount.value * qty;

  // ── Раздел 1: Код ТН ВЭД ──
  const sectionCode =
    `🔢 *Код ТН ВЭД:* \`${product.code}\`\n` +
    `📦 *Товар:* ${product.description}\n` +
    `🧮 *${qty} шт × ${amount.value} ${amount.currency}* = ${totalValue.toLocaleString()} ${amount.currency}`;

  // ── Раздел 2: Налоги ──
  const sectionTax =
    `💸 Пошлина (${product.dutyRate}%): *${calc.dutyAmount.toLocaleString()} ₽*\n` +
    `🏛 НДС (${product.vatRate}%): *${calc.vatAmount.toLocaleString()} ₽*\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `💰 *ИТОГО к уплате: ${calc.totalPayments.toLocaleString()} ₽*`;

  // ── Раздел 3: Необходимые документы ──
  const docs: string[] = [];
  if (product.requiresCertification && product.certTypes?.length) {
    docs.push(...product.certTypes);
  }
  if (product.requiresMarking) {
    docs.push("Регистрация в системе Честный ЗНАК");
  }
  const sectionDocs = docs.length
    ? `📋 *Необходимые документы:*\n` + docs.map((d) => `• ${d}`).join("\n")
    : `📋 *Необходимые документы:* стандартный пакет (инвойс, упаковочный лист, контракт)`;

  // ── Раздел 4: Советы эксперта ──
  const tips: string[] = [
    `Запросите у поставщика инвойс с кодом ТН ВЭД \`${product.code}\``,
    "Оформите статистическую форму учёта товаров при необходимости",
  ];
  if (product.requiresMarking) {
    tips.push("⚠️ Зарегистрируйтесь в Честный ЗНАК до ввоза — штраф до 300 000 ₽");
  }
  if (calc.totalPayments > 200_000) {
    tips.push("При крупных партиях рассмотрите услуги таможенного брокера");
  }
  const sectionTips =
    `💡 *Советы эксперта:*\n` + tips.map((t) => `• ${t}`).join("\n");

  return (
    `✅ *Расчёт таможенных платежей*\n\n` +
    sectionCode + `\n\n` +
    sectionTax + `\n\n` +
    sectionDocs + `\n\n` +
    sectionTips + `\n\n` +
    `⚖️ _Справочный расчёт. Точные цифры уточняйте у брокера._`
  );
}

// ─── Send one question ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendQuestion(ctx: any, question: Question, stepIndex: number, total: number, userId: number): Promise<void> {
  const header = `📋 *Шаг ${stepIndex + 1} из ${total}:*\n\n${question.text}`;

  if (question.options?.length) {
    await ctx.reply(header, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(
        question.options.map((opt: string) =>
          Markup.button.callback(opt, `qa:${userId}:${stepIndex}:${opt}`)
        )
      ),
    });
  } else {
    await ctx.reply(header + "\n\n_Напишите ответ свободным текстом._", { parse_mode: "Markdown" });
  }
}

// ─── Final calculation after all answers collected ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runFinalCalculation(ctx: any, session: Session, answers: string[]): Promise<void> {
  const userId: number = ctx.from.id;
  const combinedQuery = `${session.original_query} ${answers.join(" ")}`;

  // ── AI-assisted HS code classification ──
  let aiClassification: HsClassification | null = null;
  try {
    aiClassification = await classifyHsCode(session.original_query, answers, session.category);
    if (aiClassification) {
      console.log(`🤖 AI HS: ${aiClassification.hs_code} [${aiClassification.confidence}] — ${aiClassification.reason}`);
    }
  } catch (err) {
    console.error("HS classification error:", err);
  }

  // Confidence=high/medium → ищем по AI-коду напрямую; low → keyword search
  let product: TnVedCode | null;
  if (aiClassification && (aiClassification.confidence === "high" || aiClassification.confidence === "medium")) {
    product =
      TN_VED_DATABASE.find((e) => e.code === aiClassification!.hs_code) ??
      findProduct(combinedQuery);
  } else {
    product = findProduct(combinedQuery);
  }

  const amount = parseAmount(combinedQuery);
  const qty = parseQty(combinedQuery);

  let reply = "";
  let duty_info: object | null = null;

  if (!product) {
    reply =
      `🤔 *Не удалось определить товар по описанию.*\n\n` +
      `Попробуйте описать иначе или напишите /cancel для нового запроса.`;
  } else if (!amount) {
    reply =
      `📦 *Товар определён:* ${product.description}\n` +
      `🔢 Код ТН ВЭД: \`${product.code}\`\n\n` +
      `💡 Укажи цену для расчёта пошлины, например: _"100 шт по $50"_`;
  } else {
    const totalValue = amount.value * qty;
    const calc = calculateDuty(product, totalValue, amount.currency);

    duty_info = {
      duty_amount: calc.dutyAmount,
      vat_amount: calc.vatAmount,
      total_payments: calc.totalPayments,
      currency: amount.currency,
      qty,
    };

    reply = generateProfessionalResponse(product, calc, qty, amount);
  }

  // Сохраняем лид и получаем lead_id (2.4: нужен для callback кнопок)
  let leadId: number | null = null;
  try {
    const { data, error } = await supabase.from("leads").insert([{
      user_id: userId,
      username: ctx.from.username ?? null,
      initial_query: session.original_query,
      bot_questions: session.bot_questions,
      user_answers: answers.join(" | "),
      product_query: combinedQuery,
      hs_code: product?.code ?? null,                      // ТН ВЭД (итоговый)
      ai_hs_code: aiClassification?.hs_code ?? null,       // код от Claude
      ai_confidence: aiClassification?.confidence ?? null, // high | medium | low
      category: session.category,
      duty_info,
      ai_response: reply,
      // delivery_timing и is_urgent выставляются кнопками timing_* (2.3)
    }]).select("id").single();
    if (error) throw error;
    leadId = data?.id ?? null;
    console.log(`✅ Лид по ТН ВЭД ${product?.code ?? "—"} сохранен (lead_id=${leadId}) для ${ctx.from.username ?? userId}`);
  } catch (err) {
    console.error("Ошибка Supabase:", err);
  }

  await deleteSession(userId);

  // Полный расчёт → сначала спрашиваем о сроках поставки (2.2)
  if (duty_info && leadId) {
    await ctx.reply(
      `⚠️ *Предварительный расчёт.* Окончательный код определяет таможня согласно ст. 20 ТК ЕАЭС.\n\n` +
      `Когда планируете поставку?`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          Markup.button.callback("🔥 В течение месяца", `timing_urgent:${leadId}`),
          Markup.button.callback("📅 1-3 месяца",       `timing_month3:${leadId}`),
          Markup.button.callback("🔍 Пока изучаю",      `timing_research:${leadId}`),
        ]),
      }
    );
  } else {
    // Неполный расчёт (нет товара / нет цены) — отвечаем сразу
    await ctx.reply(reply, { parse_mode: "Markdown" });
  }
}

// ─── /start ───────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  await deleteSession(ctx.from.id);
  ctx.reply(
    `👋 *Привет! Я Jarvis VED Expert.*\n\n` +
    `Рассчитаю таможенные пошлины для любого товара из Китая.\n\n` +
    `📌 *Как использовать:*\n` +
    `Просто напиши что везёшь, например:\n` +
    `• _100 ноутбуков по $500_\n` +
    `• _200 кроссовок по €15_\n` +
    `• _50 смартфонов по 200 долларов_\n\n` +
    `🤔 Сначала задам пару уточняющих вопросов, затем выдам точный расчёт.\n` +
    `_/cancel — сбросить диалог_`,
    { parse_mode: "Markdown" }
  );
});

// ─── /cancel ──────────────────────────────────────────────────────────────────

bot.command("cancel", async (ctx) => {
  await deleteSession(ctx.from.id);
  ctx.reply("🔄 Диалог сброшен. Напиши новый товар, чтобы начать заново.");
});

// ─── /help ────────────────────────────────────────────────────────────────────

bot.command("help", (ctx) => {
  ctx.reply(
    `🛠 *Справка — Jarvis VED Expert*\n\n` +
    `Я умею:\n` +
    `• Задавать уточняющие вопросы для точного определения кода ТН ВЭД\n` +
    `• Рассчитывать пошлину + НДС\n` +
    `• Предупреждать об обязательной маркировке (Честный ЗНАК)\n\n` +
    `📦 *База:* 44 кода ТН ВЭД, ставки февраль 2026\n` +
    `💱 *Валюты:* USD ($), EUR (€), RUB (₽)\n\n` +
    `🔄 _/cancel — сбросить текущий диалог_\n` +
    `⚖️ _Данные справочные. Точный расчёт — у брокера._`,
    { parse_mode: "Markdown" }
  );
});

// ─── Timing labels ────────────────────────────────────────────────────────────

const TIMING_MAP: Record<string, { delivery_timing: string; is_urgent: boolean; label: string }> = {
  urgent:   { delivery_timing: "urgent",   is_urgent: true,  label: "🔥 В течение месяца" },
  month3:   { delivery_timing: "month_3",  is_urgent: false, label: "📅 1-3 месяца" },
  research: { delivery_timing: "research", is_urgent: false, label: "🔍 Пока изучаю" },
};

const TIMING_LABELS: Record<string, string> = {
  urgent:   "🔥 В течение месяца",
  month_3:  "📅 1-3 месяца",
  research: "🔍 Пока изучаю",
};

// ─── Timing button handler (2.3) ─────────────────────────────────────────────

bot.action(/^timing_(urgent|month3|research):(\d+)$/, async (ctx) => {
  // Первой строкой — иначе Telegram блокирует кнопку на 10 сек
  await ctx.answerCbQuery();

  const timingKey = ctx.match[1] as keyof typeof TIMING_MAP;
  const leadId = parseInt(ctx.match[2]);
  const timing = TIMING_MAP[timingKey];

  // Обновляем лид: выставляем timing + получаем ai_response для финального ответа
  const { data: lead } = await supabase
    .from("leads")
    .update({ delivery_timing: timing.delivery_timing, is_urgent: timing.is_urgent })
    .eq("id", leadId)
    .select("ai_response")
    .single();

  const finalReply = lead?.ai_response as string | null;
  if (finalReply) {
    await ctx.reply(finalReply, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        Markup.button.callback("📞 Получить расчёт от проверенного брокера", `quote:${leadId}`),
      ]),
    });
  }
});

// ─── Quote button handler (2.4: lead_id в callback_data) ─────────────────────

bot.action(/^quote:(\d+)$/, async (ctx) => {
  // Первой строкой — иначе Telegram блокирует кнопку на 10 сек
  await ctx.answerCbQuery();

  const leadId = parseInt(ctx.match[1]); // 2.4: lead_id, не user_id

  const { data: lead } = await supabase
    .from("leads")
    .select("id, initial_query, hs_code, category, username, is_urgent, delivery_timing")
    .eq("id", leadId)
    .single();

  if (lead) {
    await supabase.from("leads").update({ status: "requested_quote" }).eq("id", leadId);

    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      const timingLabel = TIMING_LABELS[lead.delivery_timing ?? ""] ?? "—";
      const prefix = lead.is_urgent ? "🔥 *СРОЧНЫЙ ЛИД*\n\n" : "📋 *Новый лид*\n\n";

      const adminMsg =
        prefix +
        `Лид #${leadId}\n` +
        `📦 Товар: ${lead.initial_query}\n` +
        `🗂 Категория: ${lead.category ?? "—"}\n` +
        `🔢 Код ТН ВЭД: \`${lead.hs_code ?? "—"}\`\n` +
        `🗓 Поставка: ${timingLabel}\n` +
        `👤 Username: ${lead.username ? `@${lead.username}` : "—"}\n\n` +
        `📌 _Клиент ждёт звонка в течение 15 минут_`;

      try {
        await bot.telegram.sendMessage(adminChatId, adminMsg, { parse_mode: "Markdown" });
        console.log(`🔥 Уведомление о лиде #${leadId} отправлено администратору`);
      } catch (err) {
        console.error("Ошибка отправки уведомления администратору:", err);
      }
    }
  }

  await ctx.reply(
    `✅ *Ваша заявка принята!*\n\n` +
    `Специалист по таможне свяжется с вами в течение *15 минут*.\n\n` +
    `_Пока ожидаете — можете задать ещё один товар._`,
    { parse_mode: "Markdown" }
  );
});

// ─── QA button answer handler ─────────────────────────────────────────────────

bot.action(/^qa:(\d+):(\d+):(.+)$/, async (ctx) => {
  const callbackUserId = parseInt(ctx.match[1]);
  const stepIndex = parseInt(ctx.match[2]);
  const answer = ctx.match[3];

  // Проверяем владельца сессии
  if (callbackUserId !== ctx.from?.id) {
    await ctx.answerCbQuery("Это не ваш диалог.");
    return;
  }

  // Отвечаем Telegram сразу — до медленного DB-запроса, иначе истекает 10-секундный таймаут
  await ctx.answerCbQuery(`✅ ${answer}`);

  const session = await getSession(callbackUserId);

  console.log(`[qa] user=${callbackUserId} btn_step=${stepIndex} db_step=${session?.step_index ?? "NULL"} stage=${session?.stage ?? "NULL"}`);

  if (!session || session.stage !== "questions") {
    await ctx.reply("⚠️ Сессия не найдена. Напишите название товара заново, чтобы начать новый диалог.");
    return;
  }

  // Дублирующий клик — шаг уже продвинут, просто игнорируем
  if (session.step_index !== stepIndex) {
    return;
  }

  const questions = JSON.parse(session.bot_questions) as Question[];
  const answers = JSON.parse(session.collected_answers || "[]") as string[];
  answers.push(answer);

  const nextStep = stepIndex + 1;

  if (nextStep < questions.length) {
    await updateSessionStep(callbackUserId, nextStep, JSON.stringify(answers));
    await sendQuestion(ctx, questions[nextStep], nextStep, questions.length, callbackUserId);
  } else {
    await runFinalCalculation(ctx, session, answers);
  }
});

// ─── Main handler ─────────────────────────────────────────────────────────────

bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  const session = await getSession(userId);

  if (!session) {
    // ─ Stage 1: новый запрос → классификация + первый вопрос ─

    await ctx.reply("🔍 *Анализирую товар...*", { parse_mode: "Markdown" });

    let category: string;
    let questions: Question[];
    try {
      category = await classifyProduct(text);
      questions = await getQuestionsForCategory(category, text);
    } catch (err) {
      console.error("Claude API error:", err);
      await ctx.reply("⚠️ Ошибка AI. Попробуй ещё раз через несколько секунд.");
      return;
    }

    await saveSession(userId, text, JSON.stringify(questions), "questions", category, 0, "[]");
    await sendQuestion(ctx, questions[0], 0, questions.length, userId);

    console.log(`🔍 [stage=questions, category=${category}] Сессия создана для ${ctx.from.username ?? userId}: "${text}"`);

  } else if (session.stage === "questions") {
    // ─ Текстовый ответ (для OTHER/ELECTRONICS без кнопок) ─

    const questions = JSON.parse(session.bot_questions) as Question[];
    const answers = JSON.parse(session.collected_answers ?? "[]") as string[];
    answers.push(text);

    const nextStep = session.step_index + 1;

    if (nextStep < questions.length) {
      await updateSessionStep(userId, nextStep, JSON.stringify(answers));
      await sendQuestion(ctx, questions[nextStep], nextStep, questions.length, userId);
    } else {
      await runFinalCalculation(ctx, session, answers);
    }
  }
});

// ─── Startup: HTTP first, then bot ───────────────────────────────────────────

const PORT = process.env.PORT || 3000;

http.createServer((_req, res) => {
  res.writeHead(200);
  res.end("OK");
}).listen(PORT, () => {
  console.log(`Health check listening on port ${PORT}`);

  bot.launch().then(() => {
    console.log("🤖 Jarvis VED bot запущен");
  });
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
