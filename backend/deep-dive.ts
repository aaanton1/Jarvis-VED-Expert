/**
 * deep-dive.ts — Боевой Промт №3: Глубокое погружение в нишу.
 *
 * Расширенная версия researcher.ts:
 * - 6 целевых поисковых запросов (вместо стандартных 3)
 * - Фокус: конструкторы ботов, жалобы, этика, конверсия, HIPAA
 * - Проверка гипотезы: "аудит SaaS vs нанять человека"
 * - Запись в analysis_critique.md
 * - Сохранение в Prisma DB + JSON
 *
 * Использование: npx tsx deep-dive.ts
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

const NICHE = "Micro-SaaS for AI chatbot audit and improvement for psychologists";

const DEEP_DIVE_QUERIES = [
  // Конструкторы ботов для психологов
  "AI chatbot builders for therapists psychologists mental health 2025",
  "chatbot platforms marketing mental health professionals private practice",
  // Жалобы и боли
  "psychologists AI chatbot complaints problems reddit",
  "therapists chatbot issues ethics quora forum discussion",
  // Специфические проблемы
  "AI chatbot mental health conversion booking appointment lead",
  "chatbot ethics therapy HIPAA compliance data privacy issues 2025",
  // Проверка гипотезы
  "hire human vs AI chatbot audit cost therapist practice",
];

const DEEP_ANALYSIS_PROMPT = `You are an expert business research analyst specializing in HealthTech and SaaS markets.

NICHE: {{NICHE}}

SEARCH RESULTS:
{{RESULTS}}

Perform a DEEP analysis. You must extract and return ONLY valid JSON:

{
  "marketOverview": "3-4 sentence comprehensive overview of the market, including growth dynamics and recent shifts",
  "chatbotBuilders": [
    {
      "name": "product name",
      "description": "what it does for therapists/psychologists",
      "pricing": "pricing info if found",
      "weaknesses": "known issues or gaps"
    }
  ],
  "painPoints": [
    { "pain": "specific customer pain point — quote from forums if possible", "source": "exact source (reddit thread, quora, article)", "severity": 1-10, "category": "ethics|privacy|conversion|ux|cost|compliance" }
  ],
  "competitors": ["list of ALL competitors/solutions found in results"],
  "estimatedMarketSize": "rough estimate with source",
  "forumComplaints": [
    { "complaint": "paraphrased complaint from real user", "platform": "reddit|quora|forum", "context": "who said it and why" }
  ],
  "coreHypothesis": "Based on ALL data, what is the #1 technical problem that this SaaS should solve? Be specific.",
  "humanVsAiVerdict": "Based on search results about hiring humans vs AI audit — is SaaS audit actually needed, or is hiring a human simpler and cheaper? Give a concrete answer with cost comparison."
}

IMPORTANT:
- Find at least 5 chatbot builders that target therapists/psychologists
- Find at least 7 pain points with real sources
- Find at least 3 forum complaints with context
- Be brutally honest in humanVsAiVerdict
- Return ONLY valid JSON. No markdown fences.`;

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

  // ─── Этап 1: Data Mining (6+ запросов через Serper) ───

  log("SEARCH", `Запускаю ${DEEP_DIVE_QUERIES.length} целевых запросов через Serper API...`);

  const searchProvider = createSearchProvider();
  const allResults: SearchResult[] = [];

  for (const query of DEEP_DIVE_QUERIES) {
    log("SEARCH", `→ "${query}"`);
    try {
      const results = await searchProvider.search(query, 6);
      log("SEARCH", `  ← ${results.length} результатов`);
      allResults.push(...results);
    } catch (err) {
      log("ERROR", `  Ошибка поиска: ${err instanceof Error ? err.message : err}`);
      // Продолжаем даже при ошибке одного запроса
    }
  }

  log("SEARCH", `Всего собрано: ${allResults.length} результатов`);

  // ─── Этап 1b: Расширенный анализ через Claude ───

  log("ANALYSIS", "Отправляю в Claude для глубокого анализа...");

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const resultsText = allResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join("\n\n");

  const prompt = DEEP_ANALYSIS_PROMPT
    .replace("{{NICHE}}", NICHE)
    .replace("{{RESULTS}}", resultsText);

  const analysisMsg = await llm.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const analysisText =
    analysisMsg.content[0].type === "text" ? analysisMsg.content[0].text : "";

  const deepAnalysis = parseJSON<{
    marketOverview: string;
    chatbotBuilders: Array<{
      name: string;
      description: string;
      pricing: string;
      weaknesses: string;
    }>;
    painPoints: Array<{
      pain: string;
      source: string;
      severity: number;
      category: string;
    }>;
    competitors: string[];
    estimatedMarketSize: string;
    forumComplaints: Array<{
      complaint: string;
      platform: string;
      context: string;
    }>;
    coreHypothesis: string;
    humanVsAiVerdict: string;
  }>(analysisText);

  log("ANALYSIS", "Claude анализ завершён.");
  log("ANALYSIS", `  Конструкторов найдено: ${deepAnalysis.chatbotBuilders.length}`);
  log("ANALYSIS", `  Болей найдено: ${deepAnalysis.painPoints.length}`);
  log("ANALYSIS", `  Жалоб с форумов: ${deepAnalysis.forumComplaints.length}`);
  log("ANALYSIS", `  Гипотеза: ${deepAnalysis.coreHypothesis.substring(0, 80)}...`);

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

## 2026-02-15 (Deep Dive) | Ниша: "${NICHE}"

> Боевой Промт №3 — Глубокое погружение. 7 целевых запросов, расширенный анализ.

- **Вердикт:** ${criticalReport.verdict}
- **Оценка:** ${criticalReport.overallScore}/100
- **Размер рынка:** ${deepAnalysis.estimatedMarketSize}
- **Конкуренты:** ${deepAnalysis.competitors.join(", ")}

### 5 Конструкторов ботов для психологов:
${deepAnalysis.chatbotBuilders
  .map(
    (b, i) =>
      `${i + 1}. **${b.name}** — ${b.description}\n   - Цена: ${b.pricing}\n   - Слабости: ${b.weaknesses}`
  )
  .join("\n")}

### Жалобы психологов (форумы):
${deepAnalysis.forumComplaints
  .map(
    (c, i) =>
      `${i + 1}. **[${c.platform}]** "${c.complaint}"\n   — Контекст: ${c.context}`
  )
  .join("\n")}

### Главная техническая проблема (гипотеза):
> ${deepAnalysis.coreHypothesis}

### Проверка гипотезы: "Аудит SaaS vs нанять человека"
> ${deepAnalysis.humanVsAiVerdict}

### Причины провала:
${criticalReport.deathReasons
  .map(
    (r, i) =>
      `${i + 1}. **${r.reason} (${r.severity}/10)** — ${r.description}\n   - Доказательства: ${r.evidence}`
  )
  .join("\n")}

### Боли клиентов (${deepAnalysis.painPoints.length} найдено):
${deepAnalysis.painPoints
  .map(
    (p, i) =>
      `${i + 1}. ${p.pain} (${p.severity}/10, ${p.category}) — ${p.source}`
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

  const status = criticalReport.verdict === "HIGH_RISK" ? "Rejected" : "Validated";

  const idea = await prisma.idea.create({
    data: {
      keyword: `Deep Dive: ${NICHE}`,
      status,
      score: criticalReport.overallScore,
    },
  });

  log("DB", `Idea создана: id=${idea.id}, status=${status}, score=${criticalReport.overallScore}`);

  // Сохраняем полный JSON-отчёт
  const fullReport: FullReport = {
    id,
    niche: NICHE,
    createdAt: new Date().toISOString(),
    trendReport,
    criticalReport,
  };

  const filepath = saveReport(fullReport);
  log("DB", `JSON-отчёт: ${filepath}`);

  // Обновляем Idea с reportPath
  await prisma.idea.update({
    where: { id: idea.id },
    data: { reportPath: filepath },
  });

  // ─── Финальный вывод ───

  console.log("\n" + "=".repeat(70));
  console.log("ОТЧЁТ ГОТОВ. Давай обсудим слабые места идеи.");
  console.log("=".repeat(70));
  console.log(`\nНиша: ${NICHE}`);
  console.log(`Вердикт: ${criticalReport.verdict}`);
  console.log(`Оценка: ${criticalReport.overallScore}/100`);
  console.log(`Статус в БД: ${status}`);
  console.log(`JSON-отчёт: ${filepath}`);
  console.log(`\nГлавная проблема: ${deepAnalysis.coreHypothesis}`);
  console.log(`\nSaaS vs Человек: ${deepAnalysis.humanVsAiVerdict}`);
  console.log(`\nПричины провала:`);
  criticalReport.deathReasons.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.reason} (${r.severity}/10)`);
  });
  console.log("\n" + "=".repeat(70));

  // Записываем reportPath в critique
  const currentCritique = fs.readFileSync(critiquePath, "utf-8");
  fs.writeFileSync(
    critiquePath,
    currentCritique.replace("- **Отчёт:** (см. JSON ниже)", `- **Отчёт:** \`${filepath}\``),
    "utf-8"
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
