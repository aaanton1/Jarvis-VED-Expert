import "dotenv/config";
import path from "path";
import http from "http";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { createClient } from "@supabase/supabase-js";
import { TN_VED_DATABASE } from "./src/utils/ved-knowledge";
import { calculateDuty } from "./src/agents/ved-customs";
import type { TnVedCode } from "./src/types/ved";

// ─── Clients ──────────────────────────────────────────────────────────────────

const bot = new Telegraf(process.env.TELEGRAM_TOKEN!);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

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

// ─── /start ───────────────────────────────────────────────────────────────────

bot.start((ctx) => {
  ctx.reply(
    `👋 *Привет! Я Jarvis VED Expert.*\n\n` +
    `Рассчитаю таможенные пошлины для любого товара из Китая.\n\n` +
    `📌 *Как использовать:*\n` +
    `Просто напиши что везёшь, например:\n` +
    `• _100 ноутбуков по $500_\n` +
    `• _200 кроссовок по €15_\n` +
    `• _50 смартфонов по 200 долларов_\n\n` +
    `⚡️ Считаю мгновенно по ставкам ФТС 2026.`,
    { parse_mode: "Markdown" }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────

bot.command("help", (ctx) => {
  ctx.reply(
    `🛠 *Справка — Jarvis VED Expert*\n\n` +
    `Я умею:\n` +
    `• Находить код ТН ВЭД по названию товара\n` +
    `• Рассчитывать пошлину + НДС\n` +
    `• Предупреждать об обязательной маркировке (Честный ЗНАК)\n\n` +
    `📦 *База:* 44 кода ТН ВЭД, ставки февраль 2026\n` +
    `💱 *Валюты:* USD ($), EUR (€), RUB (₽)\n\n` +
    `⚖️ _Данные справочные. Точный расчёт — у брокера._`,
    { parse_mode: "Markdown" }
  );
});

// ─── Main handler ─────────────────────────────────────────────────────────────

bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text;

  const product = findProduct(text);
  const amount = parseAmount(text);
  const qty = parseQty(text);

  let reply = "";
  let duty_info: object | null = null;

  if (!product) {
    reply =
      `🤔 *Не нашёл товар в базе.*\n\n` +
      `Попробуй написать иначе, например:\n` +
      `_"100 кроссовок по $15"_, _"ноутбуки 50 шт"_, _"смартфоны"_\n\n` +
      `📞 Для сложных случаев: @JarvisVED_support`;
  } else if (!amount) {
    reply =
      `📦 *Нашёл товар:*\n` +
      `*${product.description}*\n` +
      `Код ТН ВЭД: \`${product.code}\`\n\n` +
      `💡 Укажи цену, чтобы я рассчитал пошлину.\n` +
      `Например: _"${qty} шт по $50"_`;
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

    const markingNote = product.requiresMarking
      ? `\n\n⚠️ *Честный ЗНАК:* категория требует маркировки.\nШтраф за нарушение — до 300 000 ₽.`
      : "";

    const certNote = product.requiresCertification && product.certTypes?.length
      ? `\n📋 *Документы:* ${product.certTypes.slice(0, 2).join(", ")}`
      : "";

    reply =
      `✅ *Расчёт таможенных платежей*\n\n` +
      `📦 *Товар:* ${product.description}\n` +
      `🔢 *Код ТН ВЭД:* \`${product.code}\`\n` +
      `🧮 *${qty} шт × ${amount.value} ${amount.currency}* = ${totalValue.toLocaleString()} ${amount.currency}\n\n` +
      `💸 Пошлина (${product.dutyRate}%): *${calc.dutyAmount.toLocaleString()} ₽*\n` +
      `🏛 НДС (${product.vatRate}%): *${calc.vatAmount.toLocaleString()} ₽*\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `💰 *ИТОГО к уплате: ${calc.totalPayments.toLocaleString()} ₽*` +
      certNote +
      markingNote +
      `\n\n⚖️ _Справочный расчёт. Точные цифры уточняйте у брокера._`;
  }

  // Save to Supabase (fire-and-forget, strict column match)
  (async () => {
    try {
      const { error } = await supabase.from("leads").insert([{
        user_id: ctx.from.id,
        username: ctx.from.username ?? null,
        product_query: text,
        hs_code: product?.code ?? null, // ТН ВЭД
        duty_info,
      }]);
      if (error) throw error;
      console.log(`✅ Лид по ТН ВЭД ${product?.code ?? "—"} успешно сохранен для ${ctx.from.username ?? ctx.from.id}`);
    } catch (error) {
      console.error("Ошибка Supabase:", error);
    }
  })();

  await ctx.reply(reply, { parse_mode: "Markdown" });
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
