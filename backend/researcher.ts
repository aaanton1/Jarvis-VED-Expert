/**
 * researcher.ts — Фасад для запуска полного цикла исследования.
 *
 * Этот файл объединяет:
 * - SerperProvider (providers/search.ts) — запросы к Serper API
 * - TrendScout (agents/trend-scout.ts) — Цикл 1: поиск трендов и болей
 * - DevilAdvocate (agents/devil-advocate.ts) — Цикл 2: критический анализ
 * - ResearchEngine (engine/research.ts) — оркестратор Double-Loop
 *
 * Использование:
 *   import { runResearch } from './researcher';
 *   const result = await runResearch('автоматизация для стоматологий');
 */

import "dotenv/config";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { ResearchEngine, ResearchProgress } from "./src/engine/research";
import { createSearchProvider, SerperProvider } from "./src/providers/search";
import { TrendScout } from "./src/agents/trend-scout";
import { DevilAdvocate } from "./src/agents/devil-advocate";

// Re-export всех ключевых модулей для удобного доступа
export { createSearchProvider, SerperProvider } from "./src/providers/search";
export { TrendScout } from "./src/agents/trend-scout";
export { DevilAdvocate } from "./src/agents/devil-advocate";
export { ResearchEngine } from "./src/engine/research";
export type { SearchProvider, SearchResult } from "./src/providers/search";
export type { TrendReport } from "./src/agents/trend-scout";
export type { CriticalReport, DeathReason } from "./src/agents/devil-advocate";
export type { ResearchProgress, ResearchResult } from "./src/engine/research";

/**
 * Запускает полный цикл исследования ниши.
 * Serper API → Claude (Trend Scout) → Claude (Devil's Advocate) → JSON-отчёт
 */
export async function runResearch(
  niche: string,
  onProgress?: (p: ResearchProgress) => void
) {
  const engine = new ResearchEngine();
  return engine.run(niche, onProgress);
}

// Если запущен напрямую: node researcher.ts "ниша"
if (require.main === module) {
  const niche = process.argv[2];
  if (!niche) {
    console.error('Usage: npx tsx researcher.ts "ваша ниша"');
    process.exit(1);
  }

  console.log(`\nЗапуск исследования: "${niche}"\n`);

  runResearch(niche, (p) => {
    const bar = p.progress >= 0 ? `[${p.progress}%]` : "[ERR]";
    console.log(`${bar} ${p.stage}: ${p.message}`);
  })
    .then((result) => {
      console.log(`\nГотово! Отчёт сохранён: ${result.filepath}`);
      console.log(`Вердикт: ${result.report.criticalReport.verdict}`);
      console.log(`Оценка: ${result.report.criticalReport.overallScore}/100`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("\nОшибка:", err.message);
      process.exit(1);
    });
}
