/**
 * deep-dive-datacenter.ts — Глубокое погружение: ИИ-бот для продажи
 * инженерных систем для центров обработки данных (ЦОД) в РФ 2026.
 *
 * Контекст (февраль 2026):
 * - Бум строительства ЦОД в РФ: суверенный интернет, локализация данных
 * - Средний чек проекта инженерных систем: 50-500 млн руб
 * - B2B с длинным циклом сделки (6-18 месяцев)
 * - Критическая инфраструктура: охлаждение, ИБП, серверные стойки
 *
 * Использование: npx tsx deep-dive-datacenter.ts
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
  "ИИ-бот для поставщиков инженерных систем ЦОД (охлаждение, ИБП, кабельные системы, серверные стойки) — квалификация B2B-лидов и техническое консультирование через мессенджер Max в РФ";

const DEEP_DIVE_QUERIES = [
  // 1. Рынок ЦОД в России
  "рынок ЦОД центр обработки данных Россия 2024 2025 2026 рост объём строительство инвестиции",
  // 2. Инженерные системы ЦОД — поставщики и маржа
  "инженерные системы ЦОД охлаждение ИБП серверные стойки поставщик маржа прибыль Россия 2024 2025",
  // 3. CRM и автоматизация продаж в B2B инженерии
  "CRM автоматизация продаж инженерное оборудование B2B Россия AI чат-бот 2025 2026",
  // 4. Боли поставщиков — форумы
  "поставщик инженерное оборудование ЦОД проблемы продажи тендер менеджер site:vc.ru OR site:habr.com OR site:pikabu.ru",
  // 5. Стоимость привлечения B2B-клиента в инженерии
  "стоимость привлечения клиента B2B инженерное оборудование ЦОД CPL CAC тендер 2024 2025",
  // 6. Max мессенджер в B2B
  "Max мессенджер B2B корпоративный бот интеграция CRM промышленный 2025 2026",
  // 7. Тренды строительства ЦОД
  "строительство ЦОД Россия 2025 2026 локализация данных суверенный облако Яндекс VK МТС Ростелеком",
];

const DEEP_ANALYSIS_PROMPT = `Ты — эксперт по B2B-продажам инженерного оборудования и инфраструктуры ЦОД в России.

НИША: {{NICHE}}

КОНТЕКСТ (февраль 2026):
- Бум строительства ЦОД в РФ: закон о локализации данных, суверенный интернет, импортозамещение.
- Крупные игроки (Яндекс, VK, МТС, Ростелеком, Сбер) строят новые ЦОД.
- WhatsApp заблокирован, Telegram замедлён. Max (VK) — национальный мессенджер, 50+ млн пользователей.
- Max Bot API бесплатный до 2027.

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ B2B-ниши. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: рынок инженерных систем для ЦОД в РФ 2024-2026. Объёмы, рост, ключевые заказчики.",
  "existingSolutions": [
    {
      "name": "название CRM/решения",
      "type": "CRM | AI-бот | маркетплейс | ERP | конфигуратор",
      "description": "что делает, для кого",
      "pricing": "цена в рублях",
      "weaknesses": "слабые места",
      "marketShare": "доля рынка"
    }
  ],
  "painPoints": [
    { "pain": "конкретная боль поставщика/интегратора", "source": "источник", "severity": 1-10, "category": "лиды|квалификация|тендер|каталог|коммуникация|цикл_сделки|техподдержка" }
  ],
  "competitors": ["все найденные конкуренты"],
  "estimatedMarketSize": "оценка рынка: количество поставщиков, объём в рублях, количество строящихся ЦОД.",
  "supplierEconomics": {
    "averageProjectSize": "средний чек проекта инженерных систем для ЦОД (в рублях)",
    "supplierMargin": "маржа поставщика/интегратора в процентах",
    "salesCycleLength": "средний цикл сделки",
    "leadsPerMonth": "входящие запросы в месяц",
    "conversionRate": "конверсия из запроса в контракт",
    "lostDealCost": "стоимость потерянной сделки"
  },
  "maxMessengerFit": {
    "currentAdoption": "используется ли Max в корпоративном B2B",
    "botCapabilities": "что может бот для инженерных продаж",
    "competitiveAdvantage": "преимущества Max",
    "risks": "риски"
  },
  "aiBotCapabilities": {
    "technicalConsulting": "может ли AI консультировать по техническим характеристикам (мощность ИБП, BTU охлаждения, нагрузка на стойку)",
    "projectQualification": "как AI квалифицирует: бюджет, сроки, масштаб ЦОД, tier-уровень, требования к SLA",
    "knowledgeBaseComplexity": "сложность базы знаний: количество позиций, технические параметры, совместимость оборудования",
    "technicalBarriers": "барьеры: точность технических рекомендаций, интеграция с ERP, сертификация"
  },
  "unitEconomics": {
    "subscriptionPrice": "цена подписки для поставщика (руб/мес)",
    "estimatedCAC": "стоимость привлечения клиента-поставщика",
    "estimatedLTV": "пожизненная ценность",
    "estimatedChurn": "месячный отток",
    "roiForSupplier": "ROI для поставщика",
    "verdict": "сходится ли юнит-экономика?"
  },
  "forumComplaints": [
    { "complaint": "жалоба поставщика/интегратора", "platform": "источник", "context": "контекст" }
  ],
  "coreHypothesis": "Главная ценность AI-бота для поставщиков инженерных систем ЦОД.",
  "whyNow": "Почему именно сейчас — бум ЦОД, Max, импортозамещение."
}

КРИТИЧЕСКИ ВАЖНО:
- Найди минимум 5 существующих решений
- Найди минимум 7 болей
- Все цены в РУБЛЯХ
- Ответь СТРОГО на русском языке
- НЕ оборачивай ответ в markdown. Верни ТОЛЬКО чистый JSON`;

// ─── Types ───

interface DeepAnalysis {
  marketOverview: string;
  existingSolutions: Array<{
    name: string; type: string; description: string;
    pricing: string; weaknesses: string; marketShare: string;
  }>;
  painPoints: Array<{
    pain: string; source: string; severity: number; category: string;
  }>;
  competitors: string[];
  estimatedMarketSize: string;
  supplierEconomics: {
    averageProjectSize: string; supplierMargin: string;
    salesCycleLength: string; leadsPerMonth: string;
    conversionRate: string; lostDealCost: string;
  };
  maxMessengerFit: {
    currentAdoption: string; botCapabilities: string;
    competitiveAdvantage: string; risks: string;
  };
  aiBotCapabilities: {
    technicalConsulting: string; projectQualification: string;
    knowledgeBaseComplexity: string; technicalBarriers: string;
  };
  unitEconomics: {
    subscriptionPrice: string; estimatedCAC: string;
    estimatedLTV: string; estimatedChurn: string;
    roiForSupplier: string; verdict: string;
  };
  forumComplaints: Array<{
    complaint: string; platform: string; context: string;
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
  da.supplierEconomics = da.supplierEconomics ?? {
    averageProjectSize: "Нет данных", supplierMargin: "Нет данных",
    salesCycleLength: "Нет данных", leadsPerMonth: "Нет данных",
    conversionRate: "Нет данных", lostDealCost: "Нет данных",
  };
  da.maxMessengerFit = da.maxMessengerFit ?? {
    currentAdoption: "Нет данных", botCapabilities: "Нет данных",
    competitiveAdvantage: "Нет данных", risks: "Нет данных",
  };
  da.aiBotCapabilities = da.aiBotCapabilities ?? {
    technicalConsulting: "Нет данных", projectQualification: "Нет данных",
    knowledgeBaseComplexity: "Нет данных", technicalBarriers: "Нет данных",
  };
  da.unitEconomics = da.unitEconomics ?? {
    subscriptionPrice: "Нет данных", estimatedCAC: "Нет данных",
    estimatedLTV: "Нет данных", estimatedChurn: "Нет данных",
    roiForSupplier: "Нет данных", verdict: "Нет данных",
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

  log("ANALYSIS", "Отправляю в Claude для анализа ЦОД...");

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

## ${new Date().toISOString().slice(0, 10)} (Deep Dive Night) | Ниша: "Инженерные системы для ЦОД"

> Ночное исследование: ИИ-бот для поставщиков инженерных систем ЦОД через Max.

- **Вердикт:** ${criticalReport.verdict}
- **Оценка:** ${criticalReport.overallScore}/100
- **Размер рынка:** ${deepAnalysis.estimatedMarketSize}

### Экономика поставщика:
- **Средний проект:** ${deepAnalysis.supplierEconomics.averageProjectSize}
- **Маржа:** ${deepAnalysis.supplierEconomics.supplierMargin}
- **Цикл сделки:** ${deepAnalysis.supplierEconomics.salesCycleLength}
- **Лидов/мес:** ${deepAnalysis.supplierEconomics.leadsPerMonth}
- **Конверсия:** ${deepAnalysis.supplierEconomics.conversionRate}
- **Потерянная сделка:** ${deepAnalysis.supplierEconomics.lostDealCost}

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
      keyword: `Deep Dive Night: Инженерные системы ЦОД (${NICHE})`,
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

  const filepath = path.join(nightDir, "datacenter-engineering.json");
  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2), "utf-8");

  await prisma.idea.update({
    where: { id: idea.id },
    data: { reportPath: filepath },
  });

  console.log("\n" + "=".repeat(70));
  console.log("ОТЧЁТ ГОТОВ — ИНЖЕНЕРНЫЕ СИСТЕМЫ ЦОД");
  console.log("=".repeat(70));
  console.log(`Ниша: ${NICHE}`);
  console.log(`Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`);
  console.log(`JSON: ${filepath}`);
  console.log(`\nЭкономика: проект ${deepAnalysis.supplierEconomics.averageProjectSize}, маржа ${deepAnalysis.supplierEconomics.supplierMargin}`);
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
