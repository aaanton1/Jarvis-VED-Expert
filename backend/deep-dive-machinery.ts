/**
 * deep-dive-machinery.ts — Глубокое погружение: ИИ-агент для продажи
 * тяжёлой спецтехники (B2B, РФ) с интеграцией в мессенджер Max.
 *
 * Контекст (февраль 2026):
 * - WhatsApp заблокирован в РФ, Telegram замедлён
 * - Мессенджер Max (VK) — национальный мессенджер, 50M+ пользователей
 * - Max Bot API бесплатный до 2027
 * - Целевой сегмент: дилеры техники с чеком от 10 млн руб
 *
 * 7 целевых запросов:
 * - Маржинальность дилеров (Sany, Zoomlion, XCMG)
 * - Цикл продаж B2B спецтехники
 * - AI/CRM решения для промышленного сектора РФ
 * - Max Bot API для бизнеса
 * - Стоимость лида в спецтехнике
 * - Каталоги запчастей и техническая сложность
 * - Проблемы дилеров на форумах
 *
 * Использование: npx tsx deep-dive-machinery.ts
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
import prisma from "./src/utils/db";
import { randomUUID } from "crypto";

// ─── Config ───

const NICHE =
  "ИИ-агент для автоматизации первичных продаж и квалификации лидов в сфере тяжёлой спецтехники и промышленного оборудования (B2B, РФ) через мессенджер Max";

const DEEP_DIVE_QUERIES = [
  // 1. Маржинальность дилеров
  "дилер спецтехника Sany Zoomlion XCMG маржа прибыль наценка продажа РФ 2024 2025",
  // 2. Цикл продаж B2B
  "цикл продажи тяжёлая спецтехника экскаватор погрузчик B2B Россия сроки сделка квалификация лид",
  // 3. AI/CRM для промышленности
  "CRM автоматизация продаж промышленное оборудование спецтехника AI чат-бот Россия 2025 2026",
  // 4. Max мессенджер бот API для бизнеса
  "Max мессенджер бот API бизнес интеграция CRM продажи B2B 2025 2026",
  // 5. Стоимость лида в спецтехнике
  "стоимость привлечения лида спецтехника промышленное оборудование B2B Россия CAC контекстная реклама",
  // 6. Каталоги запчастей — техническая сложность
  "каталог запчастей спецтехника база данных номенклатура автоматизация подбор AI 2024 2025",
  // 7. Проблемы дилеров — форумы
  "дилер спецтехника проблемы продажи менеджер не перезванивает потеря клиентов site:vc.ru OR site:habr.com OR site:pikabu.ru",
];

const DEEP_ANALYSIS_PROMPT = `Ты — эксперт по B2B-продажам тяжёлой техники и промышленного оборудования в России.

НИША: {{NICHE}}

КОНТЕКСТ (февраль 2026):
- WhatsApp заблокирован в РФ. Telegram замедлён Роскомнадзором.
- Мессенджер Max (от VK) — национальный мессенджер РФ, предустановлен на все смартфоны с сентября 2025, 50+ млн пользователей.
- Max Bot API бесплатный до 2027.
- Публикация ботов только через верифицированные юрлица РФ.

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ B2B-ниши. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: рынок продаж тяжёлой спецтехники в РФ 2024-2026. Объёмы, динамика, ключевые бренды (Sany, Zoomlion, XCMG, LiuGong, SDLG). Импортозамещение после ухода Caterpillar/Komatsu.",
  "existingSolutions": [
    {
      "name": "название CRM/решения",
      "type": "CRM | AI-бот | маркетплейс | ERP",
      "description": "что делает, для кого",
      "pricing": "цена в рублях если есть",
      "weaknesses": "слабые места — нет интеграции с Max, нет AI-квалификации лидов, и т.д.",
      "marketShare": "доля рынка или популярность"
    }
  ],
  "painPoints": [
    { "pain": "конкретная боль дилера/менеджера — цитата с форума если есть", "source": "источник", "severity": 1-10, "category": "лиды|квалификация|каталог|коммуникация|скорость|цикл_продаж" }
  ],
  "competitors": ["все найденные конкуренты и решения"],
  "estimatedMarketSize": "оценка рынка: количество дилеров спецтехники в РФ, объём продаж в рублях, средний чек сделки.",
  "dealerEconomics": {
    "averageDealSize": "средний чек сделки на спецтехнику в РФ (в рублях)",
    "dealerMargin": "маржа дилера в процентах и рублях — для Sany, Zoomlion, XCMG",
    "salesCycleLength": "средняя длина цикла продажи (от первого контакта до оплаты)",
    "leadsPerMonth": "сколько входящих лидов получает средний дилер в месяц",
    "conversionRate": "конверсия из лида в сделку — типичная для B2B спецтехники",
    "lostLeadCost": "сколько стоит потерянный лид (упущенная маржа)"
  },
  "maxMessengerFit": {
    "currentAdoption": "насколько дилеры и их клиенты уже используют Max",
    "botApiCapabilities": "что может Max Bot API для B2B продаж (каталоги, формы, оплата, CRM-интеграция)",
    "competitiveAdvantage": "почему Max лучше Telegram/WhatsApp для этой ниши прямо сейчас",
    "risks": "риски привязки к одной платформе"
  },
  "aiAgentCapabilities": {
    "leadQualification": "как AI может квалифицировать лиды: BANT, бюджет, сроки, тип техники",
    "catalogNavigation": "сложность навигации по каталогу 5000+ позиций — может ли AI подбирать технику по описанию задачи",
    "responseSpeed": "среднее время ответа менеджера vs AI-бота (сейчас vs с ботом)",
    "technicalBarriers": "барьеры: обучение на каталогах, интеграция с 1С/ERP, точность подбора"
  },
  "unitEconomics": {
    "subscriptionPrice": "предлагаемая цена подписки для дилера (в рублях/мес)",
    "estimatedCAC": "стоимость привлечения одного дилера-клиента",
    "estimatedLTV": "пожизненная ценность клиента при данной подписке",
    "estimatedChurn": "ожидаемый месячный отток",
    "roiForDealer": "ROI для дилера: сколько дополнительных сделок/рублей принесёт бот в месяц",
    "verdict": "сходится ли юнит-экономика? При какой цене подписки?"
  },
  "forumComplaints": [
    { "complaint": "пересказ жалобы дилера/менеджера", "platform": "источник", "context": "кто сказал и почему" }
  ],
  "coreHypothesis": "Главная ценность AI-агента для дилера спецтехники. Конкретно: какую проблему решает, сколько денег экономит/зарабатывает.",
  "whyNow": "Почему именно сейчас (февраль 2026) — блокировка WhatsApp, Max как единственный канал, импортозамещение техники."
}

КРИТИЧЕСКИ ВАЖНО — ты ОБЯЗАН заполнить ВСЕ поля JSON:
- "dealerEconomics": рассчитай маржу дилера. Типичная наценка на китайскую спецтехнику 15-25%. Средний экскаватор 8-15 млн руб. Средний погрузчик 4-8 млн руб.
- "unitEconomics.subscriptionPrice": предложи цену, основываясь на value-based pricing. Если бот приносит дилеру 1 дополнительную сделку в месяц (маржа 1-3 млн руб), подписка может стоить 50K-150K руб/мес.
- "maxMessengerFit": обязательно оцени, насколько Max подходит для B2B коммуникаций.
- "aiAgentCapabilities": оцени реальную сложность AI для этой ниши.
- "forumComplaints": найди минимум 3 жалобы дилеров на текущие процессы продаж.
- Все цены в РУБЛЯХ
- Ответь СТРОГО на русском языке
- НЕ оборачивай ответ в markdown. Верни ТОЛЬКО чистый JSON`;

// ─── Types ───

interface DeepAnalysis {
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
  dealerEconomics: {
    averageDealSize: string;
    dealerMargin: string;
    salesCycleLength: string;
    leadsPerMonth: string;
    conversionRate: string;
    lostLeadCost: string;
  };
  maxMessengerFit: {
    currentAdoption: string;
    botApiCapabilities: string;
    competitiveAdvantage: string;
    risks: string;
  };
  aiAgentCapabilities: {
    leadQualification: string;
    catalogNavigation: string;
    responseSpeed: string;
    technicalBarriers: string;
  };
  unitEconomics: {
    subscriptionPrice: string;
    estimatedCAC: string;
    estimatedLTV: string;
    estimatedChurn: string;
    roiForDealer: string;
    verdict: string;
  };
  forumComplaints: Array<{
    complaint: string;
    platform: string;
    context: string;
  }>;
  coreHypothesis: string;
  whyNow: string;
}

// ─── Helpers ───

function log(stage: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${stage}] ${msg}`);
}

function defaults(da: DeepAnalysis): DeepAnalysis {
  da.forumComplaints = da.forumComplaints ?? [];
  da.dealerEconomics = da.dealerEconomics ?? {
    averageDealSize: "Нет данных",
    dealerMargin: "Нет данных",
    salesCycleLength: "Нет данных",
    leadsPerMonth: "Нет данных",
    conversionRate: "Нет данных",
    lostLeadCost: "Нет данных",
  };
  da.maxMessengerFit = da.maxMessengerFit ?? {
    currentAdoption: "Нет данных",
    botApiCapabilities: "Нет данных",
    competitiveAdvantage: "Нет данных",
    risks: "Нет данных",
  };
  da.aiAgentCapabilities = da.aiAgentCapabilities ?? {
    leadQualification: "Нет данных",
    catalogNavigation: "Нет данных",
    responseSpeed: "Нет данных",
    technicalBarriers: "Нет данных",
  };
  da.unitEconomics = da.unitEconomics ?? {
    subscriptionPrice: "Нет данных",
    estimatedCAC: "Нет данных",
    estimatedLTV: "Нет данных",
    estimatedChurn: "Нет данных",
    roiForDealer: "Нет данных",
    verdict: "Нет данных",
  };
  da.coreHypothesis = da.coreHypothesis ?? "Нет данных";
  da.whyNow = da.whyNow ?? "Нет данных";
  return da;
}

// ─── Main ───

async function main() {
  const id = randomUUID();
  log("START", `Глубокое погружение: "${NICHE}"`);
  log("START", `ID: ${id}`);

  // ─── Этап 1: Data Mining (7 запросов через Serper) ───

  log("SEARCH", `Запускаю ${DEEP_DIVE_QUERIES.length} целевых запросов через Serper API...`);

  const searchProvider = createSearchProvider();
  const allResults: SearchResult[] = [];

  for (const query of DEEP_DIVE_QUERIES) {
    log("SEARCH", `→ "${query}"`);
    try {
      const results = await searchProvider.search(query, 8);
      log("SEARCH", `  ← ${results.length} результатов`);
      allResults.push(...results);
    } catch (err) {
      log("ERROR", `  Ошибка поиска: ${err instanceof Error ? err.message : err}`);
    }
  }

  log("SEARCH", `Всего собрано: ${allResults.length} результатов`);

  // ─── Этап 1b: Расширенный анализ через Claude ───

  log("ANALYSIS", "Отправляю в Claude для глубокого B2B-анализа...");

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
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const analysisText =
    analysisMsg.content[0].type === "text" ? analysisMsg.content[0].text : "";

  const deepAnalysis = defaults(parseJSON<DeepAnalysis>(analysisText));

  log("ANALYSIS", "Claude анализ завершён.");
  log("ANALYSIS", `  Решений найдено: ${deepAnalysis.existingSolutions.length}`);
  log("ANALYSIS", `  Болей найдено: ${deepAnalysis.painPoints?.length ?? 0}`);
  log("ANALYSIS", `  Жалоб с форумов: ${deepAnalysis.forumComplaints.length}`);
  log("ANALYSIS", `  Маржа дилера: ${deepAnalysis.dealerEconomics.dealerMargin}`);
  log("ANALYSIS", `  Средний чек: ${deepAnalysis.dealerEconomics.averageDealSize}`);
  log("ANALYSIS", `  Цена подписки: ${deepAnalysis.unitEconomics.subscriptionPrice}`);

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

  log("CRITIQUE", `Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`);

  // ─── Этап 2b: Запись analysis_critique.md ───

  log("CRITIQUE", "Записываю критический отчёт в /docs/analysis_critique.md...");

  const critiquePath = path.resolve(__dirname, "../docs/analysis_critique.md");
  const existingCritique = fs.readFileSync(critiquePath, "utf-8");

  const newEntry = `

---

## ${new Date().toISOString().slice(0, 10)} (Deep Dive B2B) | Ниша: "${NICHE}"

> Глубокое погружение: ИИ-агент для продажи спецтехники через мессенджер Max (B2B, РФ).

- **Вердикт:** ${criticalReport.verdict}
- **Оценка:** ${criticalReport.overallScore}/100
- **Размер рынка:** ${deepAnalysis.estimatedMarketSize}
- **Конкуренты:** ${deepAnalysis.competitors.join(", ")}

### Экономика дилера:
- **Средний чек сделки:** ${deepAnalysis.dealerEconomics.averageDealSize}
- **Маржа дилера:** ${deepAnalysis.dealerEconomics.dealerMargin}
- **Цикл продажи:** ${deepAnalysis.dealerEconomics.salesCycleLength}
- **Лидов в месяц:** ${deepAnalysis.dealerEconomics.leadsPerMonth}
- **Конверсия лид→сделка:** ${deepAnalysis.dealerEconomics.conversionRate}
- **Стоимость потерянного лида:** ${deepAnalysis.dealerEconomics.lostLeadCost}

### Мессенджер Max — пригодность для B2B:
- **Текущее проникновение:** ${deepAnalysis.maxMessengerFit.currentAdoption}
- **Возможности Bot API:** ${deepAnalysis.maxMessengerFit.botApiCapabilities}
- **Конкурентное преимущество:** ${deepAnalysis.maxMessengerFit.competitiveAdvantage}
- **Риски:** ${deepAnalysis.maxMessengerFit.risks}

### AI-агент — возможности и барьеры:
- **Квалификация лидов:** ${deepAnalysis.aiAgentCapabilities.leadQualification}
- **Навигация по каталогу:** ${deepAnalysis.aiAgentCapabilities.catalogNavigation}
- **Скорость ответа:** ${deepAnalysis.aiAgentCapabilities.responseSpeed}
- **Технические барьеры:** ${deepAnalysis.aiAgentCapabilities.technicalBarriers}

### Существующие решения:
${deepAnalysis.existingSolutions
  .map(
    (s, i) =>
      `${i + 1}. **${s.name}** (${s.type}) — ${s.description}\n   - Цена: ${s.pricing}\n   - Слабости: ${s.weaknesses}\n   - Доля рынка: ${s.marketShare}`
  )
  .join("\n")}

### Юнит-экономика:
- **Цена подписки:** ${deepAnalysis.unitEconomics.subscriptionPrice}
- **CAC:** ${deepAnalysis.unitEconomics.estimatedCAC}
- **LTV:** ${deepAnalysis.unitEconomics.estimatedLTV}
- **Churn:** ${deepAnalysis.unitEconomics.estimatedChurn}
- **ROI для дилера:** ${deepAnalysis.unitEconomics.roiForDealer}
- **Вердикт:** ${deepAnalysis.unitEconomics.verdict}

### Жалобы дилеров (форумы):
${deepAnalysis.forumComplaints
  .map(
    (c, i) =>
      `${i + 1}. **[${c.platform}]** "${c.complaint}"\n   — Контекст: ${c.context}`
  )
  .join("\n")}

### Главная гипотеза:
> ${deepAnalysis.coreHypothesis}

### Почему именно сейчас (февраль 2026):
> ${deepAnalysis.whyNow}

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
`;

  fs.writeFileSync(critiquePath, existingCritique + newEntry, "utf-8");
  log("CRITIQUE", "analysis_critique.md обновлён.");

  // ─── Этап 3: Сохранение в SQLite + JSON ───

  log("DB", "Сохраняю в SQLite через Prisma...");

  const status =
    criticalReport.verdict === "HIGH_RISK" ? "Rejected" : "Validated";

  const idea = await prisma.idea.create({
    data: {
      keyword: `Deep Dive B2B: ${NICHE}`,
      status,
      score: criticalReport.overallScore,
    },
  });

  log("DB", `Idea создана: id=${idea.id}, status=${status}, score=${criticalReport.overallScore}`);

  // Сохраняем JSON-отчёт с фиксированным именем heavy-machinery
  const dataDir = path.resolve(__dirname, "../data/research");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const fullReport = {
    id,
    niche: NICHE,
    createdAt: new Date().toISOString(),
    deepAnalysis,
    trendReport,
    criticalReport,
  };

  const filepath = path.join(dataDir, "heavy-machinery.json");
  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2), "utf-8");

  log("DB", `JSON-отчёт: ${filepath}`);

  await prisma.idea.update({
    where: { id: idea.id },
    data: { reportPath: filepath },
  });

  // ─── Финальный вывод ───

  console.log("\n" + "=".repeat(70));
  console.log("ОТЧЁТ ГОТОВ — B2B СПЕЦТЕХНИКА + MAX MESSENGER");
  console.log("=".repeat(70));
  console.log(`\nНиша: ${NICHE}`);
  console.log(`Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`);
  console.log(`Статус в БД: ${status}`);
  console.log(`JSON-отчёт: ${filepath}`);
  console.log(`\n--- ЭКОНОМИКА ДИЛЕРА ---`);
  console.log(`Средний чек: ${deepAnalysis.dealerEconomics.averageDealSize}`);
  console.log(`Маржа: ${deepAnalysis.dealerEconomics.dealerMargin}`);
  console.log(`Цикл продажи: ${deepAnalysis.dealerEconomics.salesCycleLength}`);
  console.log(`Стоимость потерянного лида: ${deepAnalysis.dealerEconomics.lostLeadCost}`);
  console.log(`\n--- MAX MESSENGER ---`);
  console.log(`Проникновение: ${deepAnalysis.maxMessengerFit.currentAdoption}`);
  console.log(`Преимущество: ${deepAnalysis.maxMessengerFit.competitiveAdvantage}`);
  console.log(`\n--- ЮНИТ-ЭКОНОМИКА ---`);
  console.log(`Подписка: ${deepAnalysis.unitEconomics.subscriptionPrice}`);
  console.log(`CAC: ${deepAnalysis.unitEconomics.estimatedCAC}`);
  console.log(`LTV: ${deepAnalysis.unitEconomics.estimatedLTV}`);
  console.log(`ROI для дилера: ${deepAnalysis.unitEconomics.roiForDealer}`);
  console.log(`Вердикт: ${deepAnalysis.unitEconomics.verdict}`);
  console.log(`\n--- AI-АГЕНТ ---`);
  console.log(`Квалификация лидов: ${deepAnalysis.aiAgentCapabilities.leadQualification}`);
  console.log(`Каталог 5000+: ${deepAnalysis.aiAgentCapabilities.catalogNavigation}`);
  console.log(`Барьеры: ${deepAnalysis.aiAgentCapabilities.technicalBarriers}`);
  console.log(`\n--- ГИПОТЕЗА ---`);
  console.log(deepAnalysis.coreHypothesis);
  console.log(`\n--- ПОЧЕМУ СЕЙЧАС ---`);
  console.log(deepAnalysis.whyNow);
  console.log(`\nПричины провала:`);
  criticalReport.deathReasons.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.reason} (${r.severity}/10)`);
  });
  console.log("\n" + "=".repeat(70));

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
