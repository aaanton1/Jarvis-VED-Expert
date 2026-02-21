/**
 * global-audit.ts — Глобальный ре-аудит 5 ниш через Balanced Critic v2.
 *
 * 1. AI-ВЭД Консьерж (Белый Китай) — NEW: Serper research + Claude analysis
 * 2. Юридическое сопровождение ВЭД — NEW: Serper research + Claude analysis
 * 3. Премиум стоматология — EXISTING: load trendReport from JSON
 * 4. Загородная недвижимость — EXISTING: load trendReport from JSON
 * 5. Инженерные системы ЦОД — EXISTING: load trendReport from JSON
 *
 * Все 5 проходят через Balanced Critic v2.
 * Результаты → data/research/global_audit/
 *
 * Использование: npx tsx global-audit.ts
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
import { randomUUID } from "crypto";

// ─── Config ───

const OUTPUT_DIR = path.resolve(__dirname, "../data/research/global_audit");

interface NicheConfig {
  id: string;
  label: string;
  niche: string;
  queries: string[];
  analysisPrompt: string;
  existingPath?: string; // If set, skip Serper and load from JSON
}

// ─── Niche 1: AI-ВЭД Консьерж (Белый Китай) ───

const VED_NICHE = "AI-агент для обеления ВЭД: помощь селлерам маркетплейсов перейти с серого импорта (карго) на белый Китай — маркировка, сертификация, таможенное оформление через мессенджер Max в РФ";

const VED_QUERIES = [
  // 1. Законы и штрафы 2025-2026
  "закон серый импорт Россия 2025 2026 штрафы карго запрет параллельный импорт маркетплейс",
  // 2. Боли селлеров
  "селлер маркетплейс Wildberries Ozon серый импорт карго проблемы штрафы блокировка 2025 2026 site:vc.ru OR site:ozon.ru OR site:mpseller.ru",
  // 3. Белый Китай — услуги и цены
  "белый Китай импорт таможенное оформление ВЭД услуги цены стоимость растаможка 2025 2026",
  // 4. Маркировка Честный знак обязательная
  "маркировка Честный знак обязательная 2025 2026 категории штрафы селлер маркетплейс товары",
  // 5. Сертификация товаров из Китая
  "сертификация товаров Китай Россия декларация соответствия стоимость сроки 2025 2026 маркетплейс",
  // 6. ВЭД-агенты и конкуренты
  "ВЭД агент брокер таможенный представитель Китай маркетплейс автоматизация CRM бот 2025 2026",
  // 7. Рынок — количество селлеров
  "количество селлеров Wildberries Ozon 2025 2026 рынок маркетплейсов Россия объём импорт Китай",
];

const VED_ANALYSIS_PROMPT = `Ты — эксперт по внешнеэкономической деятельности (ВЭД) и маркетплейсам в России.

НИША: {{NICHE}}

КОНТЕКСТ (февраль 2026):
- В октябре 2025 вступили в силу ужесточённые законы против серого импорта (карго).
- Штрафы за отсутствие маркировки/сертификации выросли в 5-10 раз.
- Wildberries и Ozon блокируют карточки без документов.
- Сотни тысяч селлеров в панике ищут способы "обелиться".
- Мессенджер Max (от VK) — основной мессенджер РФ, 50+ млн пользователей, Bot API бесплатный до 2027.
- WhatsApp заблокирован, Telegram замедлён.

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ ниши. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: рынок ВЭД для маркетплейсов в РФ 2025-2026. Количество селлеров, объём импорта из Китая, доля серого импорта, тренд на обеление.",
  "existingSolutions": [
    {
      "name": "название сервиса/компании",
      "type": "брокер | платформа | консалтинг | SaaS | агент",
      "description": "что делает, для кого",
      "pricing": "цена в рублях",
      "weaknesses": "слабые места — нет AI, долгие сроки, нет интеграции с Max, ручная работа",
      "marketShare": "доля рынка или популярность"
    }
  ],
  "painPoints": [
    { "pain": "конкретная боль селлера — цитата с форума если есть", "source": "источник", "severity": 1-10, "category": "штрафы|маркировка|сертификация|таможня|логистика|документы|стоимость|сроки" }
  ],
  "competitors": ["все найденные конкуренты и решения"],
  "estimatedMarketSize": "оценка рынка: количество селлеров, которым нужно обеление, средний чек на обеление одной поставки, объём в рублях.",
  "vedEconomics": {
    "averageCostWhiteImport": "средняя стоимость белого оформления одной поставки (таможня + маркировка + сертификация)",
    "averageCostCargoGray": "средняя стоимость серой поставки через карго",
    "priceDifference": "разница в стоимости белый vs серый",
    "penaltiesForGray": "штрафы за серый импорт в 2026 (конкретные суммы)",
    "sellerMarginOnGoods": "типичная маржа селлера на товарах из Китая",
    "averageShipmentValue": "средняя стоимость одной поставки в рублях",
    "shipmentsPerMonth": "сколько поставок делает средний селлер в месяц"
  },
  "maxMessengerFit": {
    "currentAdoption": "используют ли селлеры Max для бизнес-коммуникаций",
    "botCapabilities": "что может AI-бот в Max для ВЭД (калькулятор пошлин, трекинг документов, чат с экспертом, уведомления)",
    "competitiveAdvantage": "почему Max лучше Telegram/WhatsApp для ВЭД-консьержа",
    "risks": "риски привязки к одной платформе"
  },
  "aiBotCapabilities": {
    "automationScope": "какие вопросы AI может закрывать: расчёт пошлин, подбор кодов ТН ВЭД, чек-листы документов, статус поставки, требования маркировки",
    "sellerQualification": "как AI квалифицирует селлера: объём, категория товара, текущий способ импорта, бюджет",
    "knowledgeBaseComplexity": "сложность базы знаний: коды ТН ВЭД, ставки пошлин, требования маркировки по категориям, сертификация",
    "technicalBarriers": "барьеры: интеграция с таможенными системами, актуальность ставок, юридическая ответственность за советы"
  },
  "unitEconomics": {
    "subscriptionPrice": "предлагаемая цена подписки для селлера (в рублях/мес)",
    "estimatedCAC": "стоимость привлечения одного селлера",
    "estimatedLTV": "пожизненная ценность клиента",
    "estimatedChurn": "ожидаемый месячный отток",
    "roiForSeller": "ROI для селлера: сколько экономит на штрафах и упрощении процесса",
    "verdict": "сходится ли юнит-экономика?"
  },
  "forumComplaints": [
    { "complaint": "пересказ жалобы селлера", "platform": "источник", "context": "контекст" }
  ],
  "regulatoryLandscape": {
    "currentLaws": "какие законы вступили в силу в 2025-2026 (конкретные номера ФЗ, постановления)",
    "penalties": "конкретные штрафы за нарушения (суммы в рублях)",
    "mandatoryMarking": "какие категории товаров подлежат обязательной маркировке в 2026",
    "certificationRequirements": "требования к сертификации/декларированию",
    "timeline": "дедлайны — когда серый импорт станет полностью невозможен"
  },
  "coreHypothesis": "Главная ценность AI-ВЭД консьержа: какую проблему решает, сколько экономит.",
  "whyNow": "Почему именно сейчас (февраль 2026) — законодательное давление, массовый переход на белый импорт."
}

КРИТИЧЕСКИ ВАЖНО:
- Заполни ВСЕ поля JSON
- vedEconomics: рассчитай разницу белый vs серый. Типичная поставка из Китая: 500K-5M руб.
- regulatoryLandscape: укажи КОНКРЕТНЫЕ законы и штрафы 2025-2026
- unitEconomics.subscriptionPrice: если AI экономит селлеру 50-200K руб/мес на штрафах и ошибках, подписка 10-30K руб/мес
- Найди минимум 5 существующих решений
- Найди минимум 7 болей с реальными источниками
- Все цены в РУБЛЯХ
- Ответь СТРОГО на русском языке
- НЕ оборачивай ответ в markdown. Верни ТОЛЬКО чистый JSON`;

// ─── Niche 2: Юридическое сопровождение ВЭД ───

const VED_LEGAL_NICHE = "AI-бот для юридического сопровождения ВЭД — консультации по таможенному праву, валютному контролю, санкционным рискам для импортёров и экспортёров через мессенджер Max в РФ";

const VED_LEGAL_QUERIES = [
  // 1. Рынок юридического ВЭД
  "юридическое сопровождение ВЭД Россия рынок стоимость 2025 2026 таможенный адвокат консалтинг",
  // 2. Боли импортёров
  "импортёр проблемы таможня валютный контроль штрафы ошибки ВЭД site:vc.ru OR site:habr.com OR site:klerk.ru",
  // 3. Цены на юридические услуги ВЭД
  "стоимость юридических услуг ВЭД таможенные споры консультация цена тариф 2025 2026",
  // 4. Конкуренты — юридические сервисы
  "юридический сервис ВЭД онлайн консультация бот автоматизация таможенное право 2025 2026",
  // 5. Валютный контроль и санкции
  "валютный контроль импортёр штрафы нарушения банк ВЭД 2025 2026 санкции параллельный импорт",
  // 6. Таможенные споры
  "таможенные споры арбитраж корректировка таможенной стоимости КТС обжалование 2025 2026",
  // 7. Объём рынка
  "рынок юридических услуг ВЭД Россия объём количество участников импортёров 2025 2026",
];

const VED_LEGAL_ANALYSIS_PROMPT = `Ты — эксперт по юридическому сопровождению внешнеэкономической деятельности (ВЭД) в России.

НИША: {{NICHE}}

КОНТЕКСТ (февраль 2026):
- Санкционное давление усиливается, параллельный импорт усложняется.
- Валютный контроль ужесточён, штрафы за нарушения выросли.
- Таможенные споры (КТС) — массовая проблема для импортёров.
- Мессенджер Max — основной мессенджер РФ, 50+ млн пользователей.

РЕЗУЛЬТАТЫ ПОИСКА:
{{RESULTS}}

Выполни ГЛУБОКИЙ анализ ниши. Верни ТОЛЬКО валидный JSON (без markdown-обёрток):

{
  "marketOverview": "3-4 предложения: рынок юридического ВЭД-консалтинга РФ 2025-2026.",
  "existingSolutions": [
    {
      "name": "название",
      "type": "юрфирма | платформа | SaaS | консалтинг",
      "description": "что делает",
      "pricing": "цена в рублях",
      "weaknesses": "слабые места",
      "marketShare": "популярность"
    }
  ],
  "painPoints": [
    { "pain": "боль импортёра/экспортёра", "source": "источник", "severity": 1-10, "category": "таможня|валютный_контроль|санкции|документы|штрафы|споры|сроки|стоимость" }
  ],
  "competitors": ["все конкуренты"],
  "estimatedMarketSize": "оценка рынка в рублях",
  "legalEconomics": {
    "averageConsultationCost": "стоимость юридической консультации по ВЭД",
    "averageCaseCost": "стоимость ведения таможенного спора",
    "averageRetainerCost": "стоимость абонентского юридического обслуживания ВЭД",
    "clientMargin": "сколько клиент экономит на юристе vs штрафы",
    "marketParticipants": "сколько компаний-участников ВЭД в России"
  },
  "maxMessengerFit": {
    "currentAdoption": "используют ли юристы/импортёры Max",
    "botCapabilities": "что может AI-бот: проверка кодов, калькулятор пошлин, чек-лист документов, анализ рисков",
    "competitiveAdvantage": "преимущество Max",
    "risks": "риски"
  },
  "aiBotCapabilities": {
    "automationScope": "какие юридические вопросы AI может закрывать автоматически",
    "clientQualification": "как AI квалифицирует клиента",
    "knowledgeBaseComplexity": "сложность правовой базы знаний",
    "technicalBarriers": "барьеры: юридическая ответственность, актуальность законов, точность"
  },
  "unitEconomics": {
    "subscriptionPrice": "цена подписки в рублях/мес",
    "estimatedCAC": "CAC",
    "estimatedLTV": "LTV",
    "estimatedChurn": "churn",
    "roiForClient": "ROI для клиента",
    "verdict": "сходится ли экономика?"
  },
  "forumComplaints": [
    { "complaint": "жалоба", "platform": "источник", "context": "контекст" }
  ],
  "coreHypothesis": "Главная ценность AI-юриста для ВЭД.",
  "whyNow": "Почему именно сейчас."
}

КРИТИЧЕСКИ ВАЖНО:
- Заполни ВСЕ поля JSON
- Найди минимум 5 решений, 7 болей
- Все цены в РУБЛЯХ
- Ответь СТРОГО на русском языке
- НЕ оборачивай в markdown`;

// ─── Existing niches (load from JSON) ───

const EXISTING_NICHES = [
  {
    id: "dental-prime",
    label: "Премиум стоматология",
    path: path.resolve(__dirname, "../data/research/dental-prime.json"),
  },
  {
    id: "suburban-realestate",
    label: "Загородная недвижимость",
    path: path.resolve(__dirname, "../data/research/night/suburban-realestate.json"),
  },
  {
    id: "datacenter-engineering",
    label: "Инженерные системы ЦОД",
    path: path.resolve(__dirname, "../data/research/night/datacenter-engineering.json"),
  },
];

// ─── Helpers ───

function log(stage: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${stage}] ${msg}`);
}

interface AuditResult {
  id: string;
  label: string;
  score: number;
  verdict: string;
  criticalReport: CriticalReport;
  trendReport: TrendReport;
  deepAnalysis?: any;
  searchResults?: number;
}

// ─── Research a new niche via Serper + Claude ───

async function researchNewNiche(
  llm: Anthropic,
  devilAdvocate: DevilAdvocate,
  config: {
    id: string;
    label: string;
    niche: string;
    queries: string[];
    analysisPrompt: string;
  }
): Promise<AuditResult> {
  log("NICHE", `━━━ ${config.label} (NEW RESEARCH) ━━━`);

  // Step 1: Serper search
  log("SEARCH", `Запускаю ${config.queries.length} запросов...`);
  const searchProvider = createSearchProvider();
  const allResults: SearchResult[] = [];

  for (const query of config.queries) {
    log("SEARCH", `→ "${query.slice(0, 80)}..."`);
    try {
      const results = await searchProvider.search(query, 8);
      log("SEARCH", `  ← ${results.length} результатов`);
      allResults.push(...results);
    } catch (err) {
      log("ERROR", `  Ошибка: ${err instanceof Error ? err.message : err}`);
    }
  }

  log("SEARCH", `Всего: ${allResults.length} результатов`);

  // Step 2: Claude analysis
  log("ANALYSIS", "Claude анализирует...");

  const resultsText = allResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join("\n\n");

  const prompt = config.analysisPrompt
    .replace("{{NICHE}}", config.niche)
    .replace("{{RESULTS}}", resultsText);

  const analysisMsg = await llm.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const analysisText =
    analysisMsg.content[0].type === "text" ? analysisMsg.content[0].text : "";

  const deepAnalysis = parseJSON<any>(analysisText);

  log("ANALYSIS", `Решений: ${deepAnalysis.existingSolutions?.length ?? 0}`);
  log("ANALYSIS", `Болей: ${deepAnalysis.painPoints?.length ?? 0}`);

  // Build TrendReport
  const trendReport: TrendReport = {
    niche: config.niche,
    marketOverview: deepAnalysis.marketOverview ?? "",
    painPoints: (deepAnalysis.painPoints ?? []).map((p: any) => ({
      pain: p.pain,
      source: p.source,
      severity: p.severity,
    })),
    competitors: deepAnalysis.competitors ?? [],
    estimatedMarketSize: deepAnalysis.estimatedMarketSize ?? "",
    rawSearchResults: allResults,
  };

  // Step 3: Balanced Critic v2
  log("CRITIC", "Balanced Critic v2...");
  const criticalReport = await devilAdvocate.critique(
    trendReport,
    (msg) => log("CRITIC", msg)
  );

  log("RESULT", `${config.label}: ${criticalReport.overallScore}/100 (${criticalReport.verdict})`);

  // Save individual report
  const report = {
    id: randomUUID(),
    niche: config.niche,
    label: config.label,
    createdAt: new Date().toISOString(),
    deepAnalysis,
    trendReport,
    criticalReport,
    searchResultsCount: allResults.length,
  };

  const filepath = path.join(OUTPUT_DIR, `${config.id}.json`);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
  log("SAVE", `→ ${filepath}`);

  return {
    id: config.id,
    label: config.label,
    score: criticalReport.overallScore,
    verdict: criticalReport.verdict,
    criticalReport,
    trendReport,
    deepAnalysis,
    searchResults: allResults.length,
  };
}

// ─── Re-evaluate existing niche ───

async function reEvaluateExistingNiche(
  devilAdvocate: DevilAdvocate,
  config: { id: string; label: string; path: string }
): Promise<AuditResult> {
  log("NICHE", `━━━ ${config.label} (RE-EVALUATE) ━━━`);

  if (!fs.existsSync(config.path)) {
    throw new Error(`Файл не найден: ${config.path}`);
  }

  const data = JSON.parse(fs.readFileSync(config.path, "utf-8"));
  const trendReport: TrendReport = data.trendReport;

  if (!trendReport) {
    throw new Error(`trendReport не найден в ${config.path}`);
  }

  log("CRITIC", "Balanced Critic v2...");
  const criticalReport = await devilAdvocate.critique(
    trendReport,
    (msg) => log("CRITIC", msg)
  );

  log("RESULT", `${config.label}: ${criticalReport.overallScore}/100 (${criticalReport.verdict})`);

  // Save to global_audit
  const report = {
    id: randomUUID(),
    niche: trendReport.niche,
    label: config.label,
    createdAt: new Date().toISOString(),
    deepAnalysis: data.deepAnalysis ?? null,
    trendReport,
    criticalReport,
    originalPath: config.path,
  };

  const filepath = path.join(OUTPUT_DIR, `${config.id}.json`);
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2), "utf-8");
  log("SAVE", `→ ${filepath}`);

  return {
    id: config.id,
    label: config.label,
    score: criticalReport.overallScore,
    verdict: criticalReport.verdict,
    criticalReport,
    trendReport,
    deepAnalysis: data.deepAnalysis,
  };
}

// ─── Main ───

async function main() {
  log("START", "═══ ГЛОБАЛЬНЫЙ РЕ-АУДИТ 5 НИШ ═══");
  log("START", "Balanced Critic v2 | docs/system_calibration.md");

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const devilAdvocate = new DevilAdvocate(llm);

  const results: AuditResult[] = [];

  // ─── 1. NEW: AI-ВЭД Консьерж (Белый Китай) ───
  const vedResult = await researchNewNiche(llm, devilAdvocate, {
    id: "ved-white-china",
    label: "AI-ВЭД Консьерж (Белый Китай)",
    niche: VED_NICHE,
    queries: VED_QUERIES,
    analysisPrompt: VED_ANALYSIS_PROMPT,
  });
  results.push(vedResult);

  // ─── 2. NEW: Юридическое сопровождение ВЭД ───
  const vedLegalResult = await researchNewNiche(llm, devilAdvocate, {
    id: "ved-legal",
    label: "Юридическое ВЭД (консалтинг)",
    niche: VED_LEGAL_NICHE,
    queries: VED_LEGAL_QUERIES,
    analysisPrompt: VED_LEGAL_ANALYSIS_PROMPT,
  });
  results.push(vedLegalResult);

  // ─── 3-5. EXISTING: Re-evaluate through Balanced Critic v2 ───
  for (const existing of EXISTING_NICHES) {
    try {
      const result = await reEvaluateExistingNiche(devilAdvocate, existing);
      results.push(result);
    } catch (err) {
      log("ERROR", `${existing.label}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── Сравнительная таблица ───

  const sorted = [...results].sort((a, b) => b.score - a.score);

  console.log("\n" + "═".repeat(100));
  console.log("ГЛОБАЛЬНЫЙ РЕ-АУДИТ — TOP-5 НИШ | Balanced Critic v2");
  console.log("═".repeat(100));

  console.log("\n┌────┬─────────────────────────────────────┬──────────┬───────────────┬───────────────────────────────────────┐");
  console.log("│ #  │ Ниша                                │ Балл     │ Вердикт       │ Ключевые факторы                      │");
  console.log("├────┼─────────────────────────────────────┼──────────┼───────────────┼───────────────────────────────────────┤");

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const rank = `${i + 1}`.padEnd(2);
    const label = r.label.padEnd(35);
    const score = `${r.score}/100`.padEnd(8);
    const verdict = r.verdict.padEnd(13);

    // Top success driver
    const topDriver = r.criticalReport.successDrivers?.[0];
    const topRisk = r.criticalReport.deathReasons?.[0];
    const factors = `+${topDriver?.driver?.slice(0, 16) ?? "?"} / -${topRisk?.reason?.slice(0, 16) ?? "?"}`.padEnd(37);

    console.log(`│ ${rank} │ ${label} │ ${score} │ ${verdict} │ ${factors} │`);
  }

  console.log("└────┴─────────────────────────────────────┴──────────┴───────────────┴───────────────────────────────────────┘");

  // ─── Детальный вывод по каждой нише ───

  for (const r of sorted) {
    console.log(`\n${"─".repeat(100)}`);
    const icon = r.score >= 60 ? "✓" : r.score >= 50 ? "~" : "✗";
    console.log(`${icon} ${r.label}: ${r.score}/100 (${r.verdict})`);
    console.log(`${"─".repeat(100)}`);

    console.log("\n  ДРАЙВЕРЫ УСПЕХА:");
    (r.criticalReport.successDrivers ?? []).forEach((s, i) => {
      console.log(`    ${i + 1}. [${s.strength}/10] ${s.driver}`);
      console.log(`       ${s.description}`);
    });

    console.log("\n  РИСКИ:");
    r.criticalReport.deathReasons.forEach((d, i) => {
      console.log(`    ${i + 1}. [${d.severity}/10] ${d.reason}`);
      console.log(`       ${d.description}`);
    });

    const sumS = (r.criticalReport.successDrivers ?? []).reduce((a, d) => a + d.strength, 0);
    const sumD = r.criticalReport.deathReasons.reduce((a, d) => a + d.severity, 0);
    console.log(`\n  Формула: ${sumS}/(${sumS}+${sumD})×100 = ${r.score}/100`);
    console.log(`  Резюме: ${r.criticalReport.summary}`);
  }

  // ─── Чемпион ───

  const champion = sorted[0];
  console.log("\n" + "═".repeat(100));
  console.log(`ЧЕМПИОН: ${champion.label} — ${champion.score}/100 (${champion.verdict})`);

  if (champion.score >= 70) {
    console.log("★★★ ПРЕВЫШАЕТ ПОРОГ 70 — ВЫСШИЙ ПРИОРИТЕТ К РЕАЛИЗАЦИИ ★★★");
  } else if (champion.score >= 60) {
    console.log("★★ ПРОХОДИТ ПОРОГ 60 — РЕКОМЕНДУЕТСЯ К РЕАЛИЗАЦИИ ★★");
  } else {
    console.log(`★ Не проходит порог 60. Ближайший: ${champion.score}/100`);
  }

  // ─── Если ВЭД > 70: список API ───

  if (vedResult.score >= 70) {
    console.log("\n" + "═".repeat(100));
    console.log("API-СЕРВИСЫ ДЛЯ MVP «БЕЛЫЙ КИТАЙ» (балл > 70)");
    console.log("═".repeat(100));
    console.log(`
  1. ТАМОЖНЯ:
     - ФТС API (Федеральная таможенная служба) — электронное декларирование
     - Альта-Софт API — справочник кодов ТН ВЭД, ставки пошлин, расчёт платежей
     - TKS.RU / CustomsOnline — таможенный калькулятор, статусы деклараций

  2. НАЛОГИ / МАРКИРОВКА:
     - Честный Знак API (честныйзнак.рф) — регистрация, маркировка, отслеживание
     - ФНС API — проверка контрагентов, налоговые данные
     - ЕГАИС (для алкоголя) / Меркурий (для продуктов) — отраслевые системы

  3. ЛОГИСТИКА:
     - СДЭК API / Boxberry API / DPD API — внутренняя логистика
     - Cainiao / YunExpress API — логистика из Китая
     - 1688.com/Alibaba API — поиск поставщиков, проверка фабрик
    `);
  }

  // ─── Сохраняем сводку ───

  const summaryReport = {
    createdAt: new Date().toISOString(),
    formula: "overallScore = round((sumStrengths / (sumStrengths + sumSeverities)) × 100)",
    threshold: 60,
    champion: {
      label: champion.label,
      score: champion.score,
      verdict: champion.verdict,
    },
    rankings: sorted.map((r, i) => ({
      rank: i + 1,
      label: r.label,
      score: r.score,
      verdict: r.verdict,
    })),
    vedApiRequired: vedResult.score >= 70,
  };

  const summaryPath = path.join(OUTPUT_DIR, "_summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2), "utf-8");
  log("SAVE", `Сводка: ${summaryPath}`);

  console.log("═".repeat(100));
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
