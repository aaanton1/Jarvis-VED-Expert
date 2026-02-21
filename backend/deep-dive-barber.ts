/**
 * deep-dive-barber.ts — Глубокое погружение: AI-бот для барбершопов/салонов красоты.
 *
 * 7 целевых запросов (РФ + глобальные):
 * - YCLIENTS, Dikidi, конкуренты
 * - WhatsApp/Telegram API стоимость
 * - Зарплата администратора vs бот
 * - Жалобы владельцев салонов
 * - Юнит-экономика при 3000 руб/мес
 *
 * Использование: npx tsx deep-dive-barber.ts
 */

import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import Anthropic from "@anthropic-ai/sdk";
import { createSearchProvider, SearchResult } from "./src/providers/search";
import { DevilAdvocate, CriticalReport } from "./src/agents/devil-advocate";
import { TrendReport } from "./src/agents/trend-scout";
import { parseJSON } from "./src/utils/parse-json";
import { saveReport, FullReport } from "./src/utils/report";
import prisma from "./src/utils/db";
import { randomUUID } from "crypto";

// ─── Config ───

const NICHE =
  "AI-бот для автоматизации записи и дожима клиентов в WhatsApp/Telegram для барбершопов и салонов красоты в РФ и СНГ";

const DEEP_DIVE_QUERIES = [
  // 1. Конкуренты: есть ли AI-боты у YCLIENTS/Dikidi
  "YCLIENTS искусственный интеллект бот мессенджер WhatsApp Telegram 2024 2025",
  "Dikidi чат-бот автоматизация запись мессенджер интеграция 2025",
  // 2. Боли владельцев — форумы и отзывы
  "владелец салона красоты барбершоп жалобы проблемы администратор не отвечает клиенту site:vc.ru OR site:pikabu.ru OR site:habr.com",
  "салон красоты потеря клиентов не отвечает WhatsApp отзывы жалобы форум",
  // 3. Зарплата администратора 2025
  "зарплата администратор салон красоты 2025 Россия Москва hh.ru средняя",
  // 4. WABA стоимость через российских провайдеров
  "Wazzup Radist.online ChatApp WhatsApp Business API тариф стоимость подключение 2025 рубли",
  // 5. Дожим клиентов — реальная экономика no-show
  "салон красоты процент неявок no-show потери выручка напоминания автоматизация 2024 2025",
];

const DEEP_ANALYSIS_PROMPT = `Ты — эксперт по анализу рынка SaaS и малого бизнеса в России и СНГ.

НИША: {{NICHE}}

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: обзор рынка автоматизации салонов красоты и барбершопов в России. Динамика роста, основные тренды 2024-2025.",
  "existingSolutions": [
    {
      "name": "название продукта",
      "type": "CRM | чат-бот | агрегатор | виджет",
      "description": "что делает, для кого",
      "pricing": "цена в рублях если есть",
      "weaknesses": "слабые места, чего не хватает",
      "marketShare": "доля рынка или популярность если известно"
    }
  ],
  "painPoints": [
    { "pain": "конкретная боль владельца салона — цитата с форума если есть", "source": "источник", "severity": 1-10, "category": "запись|коммуникация|стоимость|время|лояльность|no-show" }
  ],
  "competitors": ["все найденные конкуренты и решения"],
  "estimatedMarketSize": "оценка рынка в рублях/долларах с источником. Количество салонов и барбершопов в РФ.",
  "messengerApiCosts": {
    "whatsappWABA": "стоимость подключения и ежемесячные расходы на WhatsApp Business API (WABA) в России",
    "telegram": "стоимость бота в Telegram (разработка + поддержка)",
    "legalNuances": "юридические нюансы подключения мессенджеров для малого бизнеса в РФ"
  },
  "adminVsBotEconomics": {
    "adminSalary": "средняя зарплата администратора салона красоты/барбершопа в РФ (2024-2025) в рублях",
    "botSubscription": "сколько стоит подписка на бота (наш ценник: 3000 руб/мес)",
    "verdict": "Конкретный расчёт: бот заменяет администратора? Частично? На сколько процентов? Экономия в рублях."
  },
  "unitEconomics": {
    "subscriptionPrice": 3000,
    "estimatedCAC": "стоимость привлечения одного клиента в рублях",
    "estimatedChurn": "ожидаемый месячный отток в процентах",
    "breakEvenClients": "сколько клиентов нужно для окупаемости разработки (примерный бюджет разработки: 500K-1M руб)",
    "verdict": "Сходится ли юнит-экономика при 3000 руб/мес?"
  },
  "forumComplaints": [
    { "complaint": "пересказ жалобы владельца салона", "platform": "источник", "context": "кто сказал и почему" }
  ],
  "coreHypothesis": "Главная техническая проблема, которую должен решить наш бот. Будь конкретен.",
  "botVsCrmVerdict": "Наш бот — это надстройка поверх YCLIENTS/Dikidi или замена? Аргументируй."
}

КРИТИЧЕСКИ ВАЖНО — ты ОБЯЗАН заполнить ВСЕ поля JSON:
- "forumComplaints": найди минимум 3 жалобы владельцев салонов с форумов (vc.ru, pikabu, отзывы). Если точных цитат нет — перескажи суть проблем, которые описаны в результатах поиска.
- "adminVsBotEconomics.adminSalary": ОБЯЗАТЕЛЬНО укажи среднюю зарплату администратора. Если данные есть в результатах поиска — используй их. Если нет — укажи типичный диапазон для РФ (30000-45000 руб/мес) и напиши "оценка".
- "adminVsBotEconomics.verdict": рассчитай конкретно, сколько рублей экономит бот в месяц.
- "unitEconomics": рассчитай все поля. CAC для малого B2B SaaS в РФ типично 10000-30000 руб. Churn 5-10% в месяц.
- "botVsCrmVerdict": ответь конкретно — надстройка или замена YCLIENTS/Dikidi.
- "coreHypothesis": что конкретно должен делать бот, чего не делают YCLIENTS/Dikidi.
- Найди минимум 5 существующих решений
- Найди минимум 7 болей с реальными источниками
- Все цены в РУБЛЯХ
- Ответь СТРОГО на русском языке
- НЕ оборачивай ответ в markdown. Верни ТОЛЬКО чистый JSON`;

// ─── Helpers ───

function log(stage: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${stage}] ${msg}`);
}

// ─── Main ───

async function main() {
  const id = randomUUID();
  log("START", `Глубокое погружение: "${NICHE}"`);
  log("START", `ID: ${id}`);

  // ─── Этап 1: Data Mining (7 запросов через Serper) ───

  log(
    "SEARCH",
    `Запускаю ${DEEP_DIVE_QUERIES.length} целевых запросов через Serper API...`
  );

  const searchProvider = createSearchProvider();
  const allResults: SearchResult[] = [];

  for (const query of DEEP_DIVE_QUERIES) {
    log("SEARCH", `→ "${query}"`);
    try {
      const results = await searchProvider.search(query, 8);
      log("SEARCH", `  ← ${results.length} результатов`);
      allResults.push(...results);
    } catch (err) {
      log(
        "ERROR",
        `  Ошибка поиска: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  log("SEARCH", `Всего собрано: ${allResults.length} результатов`);

  // ─── Этап 1b: Расширенный анализ через Claude ───

  log("ANALYSIS", "Отправляю в Claude для глубокого анализа...");

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const resultsText = allResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join("\n\n");

  const prompt = DEEP_ANALYSIS_PROMPT.replace("{{NICHE}}", NICHE).replace(
    "{{RESULTS}}",
    resultsText
  );

  const analysisMsg = await llm.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const analysisText =
    analysisMsg.content[0].type === "text" ? analysisMsg.content[0].text : "";

  const deepAnalysis = parseJSON<{
    marketOverview: string;
    existingSolutions: Array<{
      name: string;
      type: string;
      description: string;
      pricing: string;
      weaknesses: string;
      marketShare: string;
    }>;
    painPoints: Array<{
      pain: string;
      source: string;
      severity: number;
      category: string;
    }>;
    competitors: string[];
    estimatedMarketSize: string;
    messengerApiCosts: {
      whatsappWABA: string;
      telegram: string;
      legalNuances: string;
    };
    adminVsBotEconomics: {
      adminSalary: string;
      botSubscription: string;
      verdict: string;
    };
    unitEconomics: {
      subscriptionPrice: number;
      estimatedCAC: string;
      estimatedChurn: string;
      breakEvenClients: string;
      verdict: string;
    };
    forumComplaints: Array<{
      complaint: string;
      platform: string;
      context: string;
    }>;
    coreHypothesis: string;
    botVsCrmVerdict: string;
  }>(analysisText);

  log("ANALYSIS", "Claude анализ завершён.");
  log(
    "ANALYSIS",
    `  Решений найдено: ${deepAnalysis.existingSolutions.length}`
  );
  log("ANALYSIS", `  Болей найдено: ${deepAnalysis.painPoints?.length ?? 0}`);
  // Default missing fields
  deepAnalysis.forumComplaints = deepAnalysis.forumComplaints ?? [];
  deepAnalysis.adminVsBotEconomics = deepAnalysis.adminVsBotEconomics ?? { adminSalary: "Нет данных", botSubscription: "3000 руб/мес", verdict: "Нет данных" };
  deepAnalysis.unitEconomics = deepAnalysis.unitEconomics ?? { subscriptionPrice: 3000, estimatedCAC: "Нет данных", estimatedChurn: "Нет данных", breakEvenClients: "Нет данных", verdict: "Нет данных" };
  deepAnalysis.messengerApiCosts = deepAnalysis.messengerApiCosts ?? { whatsappWABA: "Нет данных", telegram: "Нет данных", legalNuances: "Нет данных" };
  deepAnalysis.botVsCrmVerdict = deepAnalysis.botVsCrmVerdict ?? "Нет данных";
  deepAnalysis.coreHypothesis = deepAnalysis.coreHypothesis ?? "Нет данных";
  log(
    "ANALYSIS",
    `  Жалоб с форумов: ${deepAnalysis.forumComplaints.length}`
  );
  log(
    "ANALYSIS",
    `  Зарплата админа: ${deepAnalysis.adminVsBotEconomics.adminSalary}`
  );

  // Преобразуем в TrendReport для Devil's Advocate
  const trendReport: TrendReport = {
    niche: NICHE,
    marketOverview: deepAnalysis.marketOverview,
    painPoints: deepAnalysis.painPoints.map((p) => ({
      pain: p.pain,
      source: p.source,
      severity: p.severity,
    })),
    competitors: deepAnalysis.competitors,
    estimatedMarketSize: deepAnalysis.estimatedMarketSize,
    rawSearchResults: allResults,
  };

  // ─── Этап 2: Devil's Advocate (Критика) ───

  log("CRITIQUE", "Запускаю Devil's Advocate...");

  const devilAdvocate = new DevilAdvocate(llm);
  const criticalReport: CriticalReport = await devilAdvocate.critique(
    trendReport,
    (msg) => log("CRITIQUE", msg)
  );

  log(
    "CRITIQUE",
    `Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`
  );

  // ─── Этап 2b: Запись analysis_critique.md ───

  log("CRITIQUE", "Записываю критический отчёт в /docs/analysis_critique.md...");

  const critiquePath = path.resolve(__dirname, "../docs/analysis_critique.md");
  const existingCritique = fs.readFileSync(critiquePath, "utf-8");

  const newEntry = `

---

## ${new Date().toISOString().slice(0, 10)} (Deep Dive) | Ниша: "${NICHE}"

> Боевой Промт №6 — Глубокое погружение v2: дожим клиентов, WABA, зарплата админа (РФ + СНГ).

- **Вердикт:** ${criticalReport.verdict}
- **Оценка:** ${criticalReport.overallScore}/100
- **Размер рынка:** ${deepAnalysis.estimatedMarketSize}
- **Конкуренты:** ${deepAnalysis.competitors.join(", ")}

### Существующие решения:
${deepAnalysis.existingSolutions
  .map(
    (s, i) =>
      `${i + 1}. **${s.name}** (${s.type}) — ${s.description}\n   - Цена: ${s.pricing}\n   - Слабости: ${s.weaknesses}\n   - Доля рынка: ${s.marketShare}`
  )
  .join("\n")}

### Стоимость мессенджер-API:
- **WhatsApp WABA:** ${deepAnalysis.messengerApiCosts.whatsappWABA}
- **Telegram:** ${deepAnalysis.messengerApiCosts.telegram}
- **Юридические нюансы:** ${deepAnalysis.messengerApiCosts.legalNuances}

### Администратор vs Бот (экономика):
- **Зарплата администратора:** ${deepAnalysis.adminVsBotEconomics.adminSalary}
- **Подписка на бота:** ${deepAnalysis.adminVsBotEconomics.botSubscription}
- **Вердикт:** ${deepAnalysis.adminVsBotEconomics.verdict}

### Юнит-экономика (подписка 3000 руб/мес):
- **CAC:** ${deepAnalysis.unitEconomics.estimatedCAC}
- **Churn:** ${deepAnalysis.unitEconomics.estimatedChurn}
- **Точка безубыточности:** ${deepAnalysis.unitEconomics.breakEvenClients}
- **Вердикт:** ${deepAnalysis.unitEconomics.verdict}

### Жалобы владельцев салонов (форумы):
${deepAnalysis.forumComplaints
  .map(
    (c, i) =>
      `${i + 1}. **[${c.platform}]** "${c.complaint}"\n   — Контекст: ${c.context}`
  )
  .join("\n")}

### Главная техническая проблема (гипотеза):
> ${deepAnalysis.coreHypothesis}

### Бот vs CRM (надстройка или замена?):
> ${deepAnalysis.botVsCrmVerdict}

### Боли клиентов (${deepAnalysis.painPoints.length} найдено):
${deepAnalysis.painPoints
  .map(
    (p, i) =>
      `${i + 1}. ${p.pain} (${p.severity}/10, ${p.category}) — ${p.source}`
  )
  .join("\n")}

### Причины провала:
${criticalReport.deathReasons
  .map(
    (r, i) =>
      `${i + 1}. **${r.reason} (${r.severity}/10)** — ${r.description}\n   - Доказательства: ${r.evidence}`
  )
  .join("\n")}

### Резюме Devil's Advocate:
> ${criticalReport.summary}

- **Отчёт:** (см. JSON ниже)
`;

  fs.writeFileSync(critiquePath, existingCritique + newEntry, "utf-8");
  log("CRITIQUE", "analysis_critique.md обновлён.");

  // ─── Этап 3: Сохранение в SQLite + JSON ───

  log("DB", "Сохраняю в SQLite через Prisma...");

  const status =
    criticalReport.verdict === "HIGH_RISK" ? "Rejected" : "Validated";

  const idea = await prisma.idea.create({
    data: {
      keyword: `Deep Dive: ${NICHE}`,
      status,
      score: criticalReport.overallScore,
    },
  });

  log(
    "DB",
    `Idea создана: id=${idea.id}, status=${status}, score=${criticalReport.overallScore}`
  );

  const fullReport: FullReport = {
    id,
    niche: NICHE,
    createdAt: new Date().toISOString(),
    trendReport,
    criticalReport,
  };

  const filepath = saveReport(fullReport);
  log("DB", `JSON-отчёт: ${filepath}`);

  await prisma.idea.update({
    where: { id: idea.id },
    data: { reportPath: filepath },
  });

  // ─── Финальный вывод ───

  console.log("\n" + "=".repeat(70));
  console.log("ОТЧЁТ ГОТОВ");
  console.log("=".repeat(70));
  console.log(`\nНиша: ${NICHE}`);
  console.log(
    `Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`
  );
  console.log(`Статус в БД: ${status}`);
  console.log(`JSON-отчёт: ${filepath}`);
  console.log(`\nАдминистратор: ${deepAnalysis.adminVsBotEconomics.adminSalary}`);
  console.log(`Бот vs Админ: ${deepAnalysis.adminVsBotEconomics.verdict}`);
  console.log(`Юнит-экономика: ${deepAnalysis.unitEconomics.verdict}`);
  console.log(
    `WhatsApp WABA: ${deepAnalysis.messengerApiCosts.whatsappWABA}`
  );
  console.log(`Бот vs CRM: ${deepAnalysis.botVsCrmVerdict}`);
  console.log(`\nПричины провала:`);
  criticalReport.deathReasons.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.reason} (${r.severity}/10)`);
  });
  console.log("\n" + "=".repeat(70));

  // Обновляем путь к отчёту в critique
  const currentCritique = fs.readFileSync(critiquePath, "utf-8");
  fs.writeFileSync(
    critiquePath,
    currentCritique.replace(
      "- **Отчёт:** (см. JSON ниже)",
      `- **Отчёт:** \`${filepath}\``
    ),
    "utf-8"
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
