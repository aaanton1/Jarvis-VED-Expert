/**
 * deep-dive-suburban.ts — Глубокое погружение: ИИ-бот для продажи
 * загородной недвижимости (10-30М руб) в РФ 2026.
 *
 * Контекст (февраль 2026):
 * - Средний чек загородного дома 10-30 млн руб
 * - Маржа застройщика/агентства 30-40%
 * - Цикл сделки 2-6 месяцев
 * - Мессенджер Max — основной канал
 *
 * Использование: npx tsx deep-dive-suburban.ts
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
  "ИИ-бот для застройщиков и агентств загородной недвижимости (дома 10-30 млн руб) — квалификация покупателей, виртуальные туры и консультации через мессенджер Max в РФ";

const DEEP_DIVE_QUERIES = [
  // 1. Рынок загородной недвижимости
  "рынок загородной недвижимости Россия 2024 2025 2026 объём продаж коттеджный посёлок ИЖС рост",
  // 2. Маржинальность застройщиков
  "маржинальность застройщик загородный дом коттедж рентабельность прибыль ИЖС 2024 2025",
  // 3. CRM и боты для недвижимости
  "CRM недвижимость загородная чат-бот автоматизация продаж риэлтор застройщик 2025 2026 AI",
  // 4. Боли застройщиков — форумы
  "застройщик загородный дом проблемы продажи менеджер не перезванивает потеря клиентов site:vc.ru OR site:habr.com OR site:pikabu.ru",
  // 5. Стоимость привлечения покупателя
  "стоимость привлечения клиента загородная недвижимость ИЖС CPL CAC контекстная реклама Яндекс 2024 2025",
  // 6. Мессенджеры в недвижимости / Max
  "мессенджер бот недвижимость продажа дом квартира Max Telegram WhatsApp риэлтор 2025 2026",
  // 7. Цикл сделки и конверсия
  "цикл сделки загородная недвижимость конверсия лид покупатель сроки этапы воронка продаж 2024 2025",
];

const DEEP_ANALYSIS_PROMPT = `Ты — эксперт по рынку загородной недвижимости и PropTech в России.

НИША: {{NICHE}}

КОНТЕКСТ (февраль 2026):
- WhatsApp заблокирован в РФ. Telegram замедлён Роскомнадзором.
- Мессенджер Max (от VK) — национальный мессенджер РФ, предустановлен на все смартфоны с сентября 2025, 50+ млн пользователей.
- Max Bot API бесплатный до 2027.
- Рынок загородной недвижимости растёт: тренд на ИЖС, семейная ипотека, удалённая работа.

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ ниши. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: рынок загородной недвижимости РФ 2024-2026. Объём в рублях, количество сделок, тренды (ИЖС, семейная ипотека, удалёнка).",
  "existingSolutions": [
    {
      "name": "название CRM/решения",
      "type": "CRM | AI-бот | маркетплейс | виджет",
      "description": "что делает, для кого",
      "pricing": "цена в рублях",
      "weaknesses": "слабые места — нет AI-консультаций, нет интеграции с Max и т.д.",
      "marketShare": "доля рынка или популярность"
    }
  ],
  "painPoints": [
    { "pain": "конкретная боль застройщика/риэлтора — цитата с форума если есть", "source": "источник", "severity": 1-10, "category": "лиды|квалификация|коммуникация|конверсия|время_ответа|цикл_сделки|no-show" }
  ],
  "competitors": ["все найденные конкуренты и решения"],
  "estimatedMarketSize": "оценка рынка: количество застройщиков/агентств загородной недвижимости, объём продаж, средний чек.",
  "developerEconomics": {
    "averageDealSize": "средний чек дома/участка в сегменте 10-30 млн руб",
    "developerMargin": "маржа застройщика в процентах и рублях",
    "agencyCommission": "комиссия агентства недвижимости",
    "salesCycleLength": "средний цикл сделки от первого контакта до оплаты",
    "leadsPerMonth": "сколько лидов получает средний застройщик/агентство в месяц",
    "conversionRate": "конверсия из лида в сделку",
    "lostLeadCost": "стоимость потерянного лида (упущенная маржа)"
  },
  "maxMessengerFit": {
    "currentAdoption": "насколько застройщики и покупатели уже используют Max",
    "botCapabilities": "что может бот в Max для недвижимости (виртуальные туры, каталог домов, ипотечный калькулятор, запись на просмотр)",
    "competitiveAdvantage": "почему Max лучше других каналов для продажи загородки",
    "risks": "риски привязки к одной платформе"
  },
  "aiBotCapabilities": {
    "consultationAutomation": "какие вопросы покупателей AI может закрывать автоматически (цены, планировки, инфраструктура, ипотека)",
    "buyerQualification": "как AI квалифицирует: бюджет, сроки, количество комнат, район, тип дома, семейная ипотека",
    "knowledgeBaseComplexity": "сложность базы знаний: количество объектов, параметры, документация — насколько просто обучить AI",
    "technicalBarriers": "барьеры: интеграция с CRM застройщика, 3D-туры, ипотечные калькуляторы"
  },
  "unitEconomics": {
    "subscriptionPrice": "предлагаемая цена подписки для застройщика/агентства (в рублях/мес)",
    "estimatedCAC": "стоимость привлечения одного клиента-застройщика",
    "estimatedLTV": "пожизненная ценность клиента",
    "estimatedChurn": "ожидаемый месячный отток",
    "roiForDeveloper": "ROI для застройщика: сколько дополнительных продаж принесёт бот",
    "verdict": "сходится ли юнит-экономика?"
  },
  "forumComplaints": [
    { "complaint": "пересказ жалобы застройщика/риэлтора", "platform": "источник", "context": "кто сказал и почему" }
  ],
  "coreHypothesis": "Главная ценность AI-бота для загородной недвижимости.",
  "whyNow": "Почему именно сейчас (февраль 2026) — Max, рост ИЖС, семейная ипотека."
}

КРИТИЧЕСКИ ВАЖНО:
- Найди минимум 5 существующих решений
- Найди минимум 7 болей с реальными источниками
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
  developerEconomics: {
    averageDealSize: string;
    developerMargin: string;
    agencyCommission: string;
    salesCycleLength: string;
    leadsPerMonth: string;
    conversionRate: string;
    lostLeadCost: string;
  };
  maxMessengerFit: {
    currentAdoption: string;
    botCapabilities: string;
    competitiveAdvantage: string;
    risks: string;
  };
  aiBotCapabilities: {
    consultationAutomation: string;
    buyerQualification: string;
    knowledgeBaseComplexity: string;
    technicalBarriers: string;
  };
  unitEconomics: {
    subscriptionPrice: string;
    estimatedCAC: string;
    estimatedLTV: string;
    estimatedChurn: string;
    roiForDeveloper: string;
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
  da.developerEconomics = da.developerEconomics ?? {
    averageDealSize: "Нет данных", developerMargin: "Нет данных",
    agencyCommission: "Нет данных", salesCycleLength: "Нет данных",
    leadsPerMonth: "Нет данных", conversionRate: "Нет данных",
    lostLeadCost: "Нет данных",
  };
  da.maxMessengerFit = da.maxMessengerFit ?? {
    currentAdoption: "Нет данных", botCapabilities: "Нет данных",
    competitiveAdvantage: "Нет данных", risks: "Нет данных",
  };
  da.aiBotCapabilities = da.aiBotCapabilities ?? {
    consultationAutomation: "Нет данных", buyerQualification: "Нет данных",
    knowledgeBaseComplexity: "Нет данных", technicalBarriers: "Нет данных",
  };
  da.unitEconomics = da.unitEconomics ?? {
    subscriptionPrice: "Нет данных", estimatedCAC: "Нет данных",
    estimatedLTV: "Нет данных", estimatedChurn: "Нет данных",
    roiForDeveloper: "Нет данных", verdict: "Нет данных",
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

  // ─── Этап 1: Data Mining ───

  log("SEARCH", `Запускаю ${DEEP_DIVE_QUERIES.length} запросов через Serper API...`);

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

  // ─── Этап 1b: Анализ через Claude ───

  log("ANALYSIS", "Отправляю в Claude для анализа загородной недвижимости...");

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
  log("ANALYSIS", `  Решений: ${deepAnalysis.existingSolutions.length}`);
  log("ANALYSIS", `  Болей: ${deepAnalysis.painPoints?.length ?? 0}`);
  log("ANALYSIS", `  Жалоб: ${deepAnalysis.forumComplaints.length}`);

  // Преобразуем в TrendReport
  const trendReport: TrendReport = {
    niche: NICHE,
    marketOverview: deepAnalysis.marketOverview,
    painPoints: deepAnalysis.painPoints.map((p) => ({
      pain: p.pain, source: p.source, severity: p.severity,
    })),
    competitors: deepAnalysis.competitors,
    estimatedMarketSize: deepAnalysis.estimatedMarketSize,
    rawSearchResults: allResults,
  };

  // ─── Этап 2: Devil's Advocate ───

  log("CRITIQUE", "Запускаю Devil's Advocate...");

  const devilAdvocate = new DevilAdvocate(llm);
  const criticalReport: CriticalReport = await devilAdvocate.critique(
    trendReport,
    (msg) => log("CRITIQUE", msg)
  );

  log("CRITIQUE", `Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`);

  // ─── Этап 2b: analysis_critique.md ───

  const critiquePath = path.resolve(__dirname, "../docs/analysis_critique.md");
  const existingCritique = fs.readFileSync(critiquePath, "utf-8");

  const newEntry = `

---

## ${new Date().toISOString().slice(0, 10)} (Deep Dive Night) | Ниша: "Загородная недвижимость (10-30М)"

> Ночное исследование: ИИ-бот для продажи загородных домов через Max.

- **Вердикт:** ${criticalReport.verdict}
- **Оценка:** ${criticalReport.overallScore}/100
- **Размер рынка:** ${deepAnalysis.estimatedMarketSize}

### Экономика застройщика:
- **Средний чек:** ${deepAnalysis.developerEconomics.averageDealSize}
- **Маржа:** ${deepAnalysis.developerEconomics.developerMargin}
- **Комиссия агентства:** ${deepAnalysis.developerEconomics.agencyCommission}
- **Цикл сделки:** ${deepAnalysis.developerEconomics.salesCycleLength}
- **Лидов/мес:** ${deepAnalysis.developerEconomics.leadsPerMonth}
- **Конверсия:** ${deepAnalysis.developerEconomics.conversionRate}
- **Потерянный лид:** ${deepAnalysis.developerEconomics.lostLeadCost}

### Юнит-экономика:
- **Подписка:** ${deepAnalysis.unitEconomics.subscriptionPrice}
- **CAC:** ${deepAnalysis.unitEconomics.estimatedCAC}
- **LTV:** ${deepAnalysis.unitEconomics.estimatedLTV}
- **Вердикт:** ${deepAnalysis.unitEconomics.verdict}

### Причины провала:
${criticalReport.deathReasons.map((r, i) => `${i + 1}. **${r.reason} (${r.severity}/10)** — ${r.description}`).join("\n")}

### Резюме:
> ${criticalReport.summary}
`;

  fs.writeFileSync(critiquePath, existingCritique + newEntry, "utf-8");

  // ─── Этап 3: Сохранение ───

  const status = criticalReport.verdict === "HIGH_RISK" ? "Rejected" : "Validated";

  const idea = await prisma.idea.create({
    data: {
      keyword: `Deep Dive Night: Загородная недвижимость (${NICHE})`,
      status,
      score: criticalReport.overallScore,
    },
  });

  const fullReport = {
    id, niche: NICHE, createdAt: new Date().toISOString(),
    deepAnalysis, trendReport, criticalReport,
  };

  const nightDir = path.resolve(__dirname, "../data/research/night");
  if (!fs.existsSync(nightDir)) fs.mkdirSync(nightDir, { recursive: true });

  const filepath = path.join(nightDir, "suburban-realestate.json");
  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2), "utf-8");

  await prisma.idea.update({
    where: { id: idea.id },
    data: { reportPath: filepath },
  });

  console.log("\n" + "=".repeat(70));
  console.log("ОТЧЁТ ГОТОВ — ЗАГОРОДНАЯ НЕДВИЖИМОСТЬ");
  console.log("=".repeat(70));
  console.log(`Ниша: ${NICHE}`);
  console.log(`Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`);
  console.log(`JSON: ${filepath}`);
  console.log(`\nЭкономика: чек ${deepAnalysis.developerEconomics.averageDealSize}, маржа ${deepAnalysis.developerEconomics.developerMargin}`);
  console.log(`Юнит-экономика: ${deepAnalysis.unitEconomics.verdict}`);
  criticalReport.deathReasons.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.reason} (${r.severity}/10)`);
  });
  console.log("=".repeat(70));

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
