/**
 * deep-dive-dentistry.ts — Глубокое погружение: ИИ-бот для премиум
 * стоматологии (имплантация, виниры) в РФ 2026.
 *
 * Контекст (февраль 2026):
 * - 26 000+ стоматологических клиник в РФ
 * - Маржа на имплантацию 40-60%, виниры 50-70%
 * - Средний чек 150-500K руб (имплантация All-on-4: до 1M руб)
 * - Простая база знаний: ~50 услуг
 * - Мессенджер Max — основной канал (WhatsApp заблокирован)
 *
 * 7 целевых запросов:
 * - Рынок стоматологии РФ (объём, рост)
 * - Маржа и юнит-экономика клиник
 * - CRM/боты для стоматологий (YCLIENTS Dental, Archimed+)
 * - Боли владельцев клиник (форумы)
 * - Стоимость привлечения пациента
 * - Мессенджер Max в медицине
 * - No-show и потери клиник
 *
 * Использование: npx tsx deep-dive-dentistry.ts
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
  "ИИ-бот для премиум стоматологических клиник (имплантация, виниры, ортодонтия) — автоматизация консультаций, квалификация пациентов и запись через мессенджер Max в РФ";

const DEEP_DIVE_QUERIES = [
  // 1. Рынок стоматологии РФ
  "рынок стоматологии Россия 2024 2025 объём количество клиник рост частная стоматология",
  // 2. Маржинальность и экономика клиник
  "маржинальность стоматология имплантация виниры рентабельность клиника чистая прибыль 2024 2025",
  // 3. CRM и боты для стоматологий
  "CRM стоматология YCLIENTS Archimed DentalPRO бот запись автоматизация мессенджер 2025 2026",
  // 4. Боли владельцев клиник — форумы
  "владелец стоматологии жалобы проблемы администратор не перезванивает потеря пациентов site:vc.ru OR site:habr.com OR site:pikabu.ru OR site:stomatologclub.ru",
  // 5. Стоимость привлечения пациента
  "стоимость привлечения пациента стоматология имплантация CPL CAC контекстная реклама Яндекс 2024 2025",
  // 6. Мессенджеры в медицине / Max
  "Max мессенджер медицина стоматология бот запись клиника пациент 2025 2026 чат-бот",
  // 7. No-show и потеря пациентов
  "стоматология процент неявок no-show потеря пациентов напоминания автоматизация запись 2024 2025",
];

const DEEP_ANALYSIS_PROMPT = `Ты — эксперт по маркетингу и автоматизации в стоматологическом бизнесе России.

НИША: {{NICHE}}

КОНТЕКСТ (февраль 2026):
- WhatsApp заблокирован в РФ. Telegram замедлён Роскомнадзором.
- Мессенджер Max (от VK) — национальный мессенджер РФ, предустановлен на все смартфоны с сентября 2025, 50+ млн пользователей.
- Max Bot API бесплатный до 2027.
- В России ~26 000 частных стоматологических клиник.
- Средний чек имплантации одного зуба: 40-80 тыс руб. All-on-4: 300-600 тыс руб. Виниры: 20-40 тыс за единицу.

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ ниши. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: рынок частной стоматологии РФ 2024-2026. Объём в рублях, количество клиник, динамика роста, тренд на импланты/виниры.",
  "existingSolutions": [
    {
      "name": "название CRM/решения",
      "type": "CRM | МИС | чат-бот | агрегатор | виджет",
      "description": "что делает, для кого",
      "pricing": "цена в рублях",
      "weaknesses": "слабые места — нет AI-консультаций, нет интеграции с Max, шаблонные ответы и т.д.",
      "marketShare": "доля рынка или популярность"
    }
  ],
  "painPoints": [
    { "pain": "конкретная боль владельца/администратора клиники — цитата с форума если есть", "source": "источник", "severity": 1-10, "category": "запись|консультация|no-show|стоимость_лида|коммуникация|конверсия|время_ответа" }
  ],
  "competitors": ["все найденные конкуренты и решения"],
  "estimatedMarketSize": "оценка рынка: количество клиник, доля премиум-сегмента, объём в рублях.",
  "clinicEconomics": {
    "averageCheckImplant": "средний чек на имплантацию (1 зуб, All-on-4)",
    "averageCheckVeneers": "средний чек на виниры (за единицу, за улыбку 8-10 штук)",
    "clinicMargin": "маржинальность клиники на импланты/виниры в процентах",
    "patientsPerMonth": "сколько первичных обращений получает средняя премиум-клиника в месяц",
    "conversionRate": "конверсия из обращения в лечение для премиум-услуг",
    "lostPatientCost": "сколько стоит потерянный пациент (упущенная маржа)",
    "noShowRate": "процент неявок на первичную консультацию"
  },
  "maxMessengerFit": {
    "currentAdoption": "насколько пациенты и клиники уже используют Max",
    "botCapabilities": "что может бот в Max для стоматологии (запись, напоминания, каталог услуг, фото-консультация)",
    "competitiveAdvantage": "почему Max лучше Telegram/WhatsApp для стоматологий прямо сейчас",
    "risks": "риски привязки к одной платформе"
  },
  "aiBotCapabilities": {
    "consultationAutomation": "какие вопросы пациентов AI может закрывать автоматически (70% типовых: цены, сроки, больно ли, какой имплант лучше)",
    "patientQualification": "как AI квалифицирует: бюджет, срочность, тип услуги, страхи/возражения",
    "knowledgeBaseComplexity": "сложность базы знаний: ~50 услуг, ценовые категории, противопоказания — насколько просто обучить AI",
    "technicalBarriers": "барьеры: HIPAA-подобные требования в РФ (152-ФЗ), интеграция с МИС, точность медицинских ответов"
  },
  "unitEconomics": {
    "subscriptionPrice": "предлагаемая цена подписки для клиники (в рублях/мес) — value-based",
    "estimatedCAC": "стоимость привлечения одной клиники-клиента",
    "estimatedLTV": "пожизненная ценность клиента при данной подписке",
    "estimatedChurn": "ожидаемый месячный отток",
    "roiForClinic": "ROI для клиники: сколько дополнительных пациентов/рублей принесёт бот в месяц",
    "verdict": "сходится ли юнит-экономика? При какой цене подписки?"
  },
  "forumComplaints": [
    { "complaint": "пересказ жалобы владельца клиники", "platform": "источник", "context": "кто сказал и почему" }
  ],
  "coreHypothesis": "Главная ценность AI-бота для стоматологии. Конкретно: какую проблему решает, сколько денег экономит/зарабатывает.",
  "whyNow": "Почему именно сейчас (февраль 2026) — Max как основной канал, рост спроса на импланты, конкуренция клиник за пациентов."
}

КРИТИЧЕСКИ ВАЖНО — ты ОБЯЗАН заполнить ВСЕ поля JSON:
- "clinicEconomics": рассчитай маржу. Типичная маржа на имплантацию 40-60%, на виниры 50-70%. Средний чек имплант 1 зуб: 40-80 тыс руб. All-on-4: 300-600 тыс.
- "unitEconomics.subscriptionPrice": предложи цену. Если бот приносит клинике 3-5 дополнительных пациентов на импланты (маржа 20-40 тыс руб каждый), подписка 15-30 тыс руб/мес.
- "maxMessengerFit": оцени реальный потенциал Max для записи в клинику.
- "aiBotCapabilities": оцени, какой процент вопросов AI может закрыть автономно.
- "forumComplaints": найди минимум 3 жалобы владельцев клиник.
- Найди минимум 5 существующих решений (YCLIENTS, Archimed+, DentalPRO, 1С:Медицина и т.д.)
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
  clinicEconomics: {
    averageCheckImplant: string;
    averageCheckVeneers: string;
    clinicMargin: string;
    patientsPerMonth: string;
    conversionRate: string;
    lostPatientCost: string;
    noShowRate: string;
  };
  maxMessengerFit: {
    currentAdoption: string;
    botCapabilities: string;
    competitiveAdvantage: string;
    risks: string;
  };
  aiBotCapabilities: {
    consultationAutomation: string;
    patientQualification: string;
    knowledgeBaseComplexity: string;
    technicalBarriers: string;
  };
  unitEconomics: {
    subscriptionPrice: string;
    estimatedCAC: string;
    estimatedLTV: string;
    estimatedChurn: string;
    roiForClinic: string;
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
  da.clinicEconomics = da.clinicEconomics ?? {
    averageCheckImplant: "Нет данных",
    averageCheckVeneers: "Нет данных",
    clinicMargin: "Нет данных",
    patientsPerMonth: "Нет данных",
    conversionRate: "Нет данных",
    lostPatientCost: "Нет данных",
    noShowRate: "Нет данных",
  };
  da.maxMessengerFit = da.maxMessengerFit ?? {
    currentAdoption: "Нет данных",
    botCapabilities: "Нет данных",
    competitiveAdvantage: "Нет данных",
    risks: "Нет данных",
  };
  da.aiBotCapabilities = da.aiBotCapabilities ?? {
    consultationAutomation: "Нет данных",
    patientQualification: "Нет данных",
    knowledgeBaseComplexity: "Нет данных",
    technicalBarriers: "Нет данных",
  };
  da.unitEconomics = da.unitEconomics ?? {
    subscriptionPrice: "Нет данных",
    estimatedCAC: "Нет данных",
    estimatedLTV: "Нет данных",
    estimatedChurn: "Нет данных",
    roiForClinic: "Нет данных",
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

  log("ANALYSIS", "Отправляю в Claude для глубокого анализа стоматологии...");

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
  log("ANALYSIS", `  Маржа клиники: ${deepAnalysis.clinicEconomics.clinicMargin}`);
  log("ANALYSIS", `  Средний чек имплант: ${deepAnalysis.clinicEconomics.averageCheckImplant}`);
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

## ${new Date().toISOString().slice(0, 10)} (Deep Dive) | Ниша: "Премиум стоматология (имплантация/виниры)"

> Глубокое погружение: ИИ-бот для премиум стоматологий через мессенджер Max (РФ).

- **Вердикт:** ${criticalReport.verdict}
- **Оценка:** ${criticalReport.overallScore}/100
- **Размер рынка:** ${deepAnalysis.estimatedMarketSize}
- **Конкуренты:** ${deepAnalysis.competitors.join(", ")}

### Экономика клиники:
- **Средний чек имплант:** ${deepAnalysis.clinicEconomics.averageCheckImplant}
- **Средний чек виниры:** ${deepAnalysis.clinicEconomics.averageCheckVeneers}
- **Маржинальность:** ${deepAnalysis.clinicEconomics.clinicMargin}
- **Первичных обращений/мес:** ${deepAnalysis.clinicEconomics.patientsPerMonth}
- **Конверсия обращение→лечение:** ${deepAnalysis.clinicEconomics.conversionRate}
- **Стоимость потерянного пациента:** ${deepAnalysis.clinicEconomics.lostPatientCost}
- **Неявки (no-show):** ${deepAnalysis.clinicEconomics.noShowRate}

### Мессенджер Max — пригодность:
- **Текущее проникновение:** ${deepAnalysis.maxMessengerFit.currentAdoption}
- **Возможности бота:** ${deepAnalysis.maxMessengerFit.botCapabilities}
- **Конкурентное преимущество:** ${deepAnalysis.maxMessengerFit.competitiveAdvantage}
- **Риски:** ${deepAnalysis.maxMessengerFit.risks}

### AI-бот — возможности:
- **Автоматизация консультаций:** ${deepAnalysis.aiBotCapabilities.consultationAutomation}
- **Квалификация пациентов:** ${deepAnalysis.aiBotCapabilities.patientQualification}
- **Сложность базы знаний:** ${deepAnalysis.aiBotCapabilities.knowledgeBaseComplexity}
- **Технические барьеры:** ${deepAnalysis.aiBotCapabilities.technicalBarriers}

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
- **ROI для клиники:** ${deepAnalysis.unitEconomics.roiForClinic}
- **Вердикт:** ${deepAnalysis.unitEconomics.verdict}

### Жалобы владельцев клиник (форумы):
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
      keyword: `Deep Dive: Премиум стоматология (${NICHE})`,
      status,
      score: criticalReport.overallScore,
    },
  });

  log("DB", `Idea создана: id=${idea.id}, status=${status}, score=${criticalReport.overallScore}`);

  // Сохраняем JSON-отчёт
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

  const filepath = path.join(dataDir, "dental-prime.json");
  fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2), "utf-8");

  log("DB", `JSON-отчёт: ${filepath}`);

  await prisma.idea.update({
    where: { id: idea.id },
    data: { reportPath: filepath },
  });

  // ─── Финальный вывод ───

  console.log("\n" + "=".repeat(70));
  console.log("ОТЧЁТ ГОТОВ — ПРЕМИУМ СТОМАТОЛОГИЯ");
  console.log("=".repeat(70));
  console.log(`\nНиша: ${NICHE}`);
  console.log(`Вердикт: ${criticalReport.verdict} | Оценка: ${criticalReport.overallScore}/100`);
  console.log(`Статус в БД: ${status}`);
  console.log(`JSON-отчёт: ${filepath}`);
  console.log(`\n--- ЭКОНОМИКА КЛИНИКИ ---`);
  console.log(`Средний чек имплант: ${deepAnalysis.clinicEconomics.averageCheckImplant}`);
  console.log(`Средний чек виниры: ${deepAnalysis.clinicEconomics.averageCheckVeneers}`);
  console.log(`Маржа: ${deepAnalysis.clinicEconomics.clinicMargin}`);
  console.log(`Конверсия: ${deepAnalysis.clinicEconomics.conversionRate}`);
  console.log(`No-show: ${deepAnalysis.clinicEconomics.noShowRate}`);
  console.log(`Стоимость потерянного пациента: ${deepAnalysis.clinicEconomics.lostPatientCost}`);
  console.log(`\n--- MAX MESSENGER ---`);
  console.log(`Проникновение: ${deepAnalysis.maxMessengerFit.currentAdoption}`);
  console.log(`Преимущество: ${deepAnalysis.maxMessengerFit.competitiveAdvantage}`);
  console.log(`\n--- AI-БОТ ---`);
  console.log(`Автоматизация: ${deepAnalysis.aiBotCapabilities.consultationAutomation}`);
  console.log(`База знаний: ${deepAnalysis.aiBotCapabilities.knowledgeBaseComplexity}`);
  console.log(`Барьеры: ${deepAnalysis.aiBotCapabilities.technicalBarriers}`);
  console.log(`\n--- ЮНИТ-ЭКОНОМИКА ---`);
  console.log(`Подписка: ${deepAnalysis.unitEconomics.subscriptionPrice}`);
  console.log(`CAC: ${deepAnalysis.unitEconomics.estimatedCAC}`);
  console.log(`LTV: ${deepAnalysis.unitEconomics.estimatedLTV}`);
  console.log(`ROI для клиники: ${deepAnalysis.unitEconomics.roiForClinic}`);
  console.log(`Вердикт: ${deepAnalysis.unitEconomics.verdict}`);
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
