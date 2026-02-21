/**
 * recalibrate.ts — Пересчёт оценок 3 ниш из ночного марафона
 * через новый Balanced Critic v2 (devil-advocate.ts).
 *
 * Читает существующие JSON-отчёты, прогоняет trendReport через
 * обновлённый DevilAdvocate, выводит сравнительную таблицу.
 *
 * Использование: npx tsx recalibrate.ts
 */

import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import Anthropic from "@anthropic-ai/sdk";
import { DevilAdvocate, CriticalReport, SuccessDriver } from "./src/agents/devil-advocate";
import { TrendReport } from "./src/agents/trend-scout";

// ─── Config ───

interface NicheFile {
  label: string;
  path: string;
}

const NICHES: NicheFile[] = [
  {
    label: "Премиум стоматология",
    path: path.resolve(__dirname, "../data/research/dental-prime.json"),
  },
  {
    label: "Загородная недвижимость",
    path: path.resolve(__dirname, "../data/research/night/suburban-realestate.json"),
  },
  {
    label: "Инженерные системы ЦОД",
    path: path.resolve(__dirname, "../data/research/night/datacenter-engineering.json"),
  },
];

// ─── Helpers ───

function log(stage: string, msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${stage}] ${msg}`);
}

// ─── Main ───

async function main() {
  log("START", "Рекалибровка: Balanced Critic v2");
  log("START", `Ниш для пересчёта: ${NICHES.length}`);

  const llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const devilAdvocate = new DevilAdvocate(llm);

  const results: Array<{
    label: string;
    oldScore: number;
    newScore: number;
    oldVerdict: string;
    newVerdict: string;
    report: CriticalReport;
  }> = [];

  for (const niche of NICHES) {
    log("NICHE", `━━━ ${niche.label} ━━━`);

    if (!fs.existsSync(niche.path)) {
      log("ERROR", `Файл не найден: ${niche.path}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(niche.path, "utf-8"));
    const oldScore = data.criticalReport?.overallScore ?? 0;
    const oldVerdict = data.criticalReport?.verdict ?? "N/A";

    log("OLD", `Старая оценка: ${oldScore}/100 (${oldVerdict})`);

    // Extract trendReport from saved data
    const trendReport: TrendReport = data.trendReport;

    if (!trendReport) {
      log("ERROR", "trendReport не найден в файле");
      continue;
    }

    // Run new Balanced Critic v2
    const newReport = await devilAdvocate.critique(
      trendReport,
      (msg) => log("CRITIC", msg)
    );

    log("NEW", `Новая оценка: ${newReport.overallScore}/100 (${newReport.verdict})`);

    // Save updated report back to file
    data.criticalReport = newReport;
    data.recalibratedAt = new Date().toISOString();
    fs.writeFileSync(niche.path, JSON.stringify(data, null, 2), "utf-8");
    log("SAVE", `Обновлён: ${niche.path}`);

    results.push({
      label: niche.label,
      oldScore,
      newScore: newReport.overallScore,
      oldVerdict,
      newVerdict: newReport.verdict,
      report: newReport,
    });
  }

  // ─── Итоговая таблица ───

  console.log("\n" + "═".repeat(80));
  console.log("РЕКАЛИБРОВКА ЗАВЕРШЕНА — Balanced Critic v2");
  console.log("═".repeat(80));

  console.log("\n┌────────────────────────────────┬──────────┬──────────┬──────────────────────┐");
  console.log("│ Ниша                           │ Старая   │ Новая    │ Вердикт              │");
  console.log("├────────────────────────────────┼──────────┼──────────┼──────────────────────┤");

  for (const r of results) {
    const label = r.label.padEnd(30);
    const old = `${r.oldScore}/100`.padEnd(8);
    const nw = `${r.newScore}/100`.padEnd(8);
    const verdict = `${r.oldVerdict} → ${r.newVerdict}`.padEnd(20);
    console.log(`│ ${label} │ ${old} │ ${nw} │ ${verdict} │`);
  }

  console.log("└────────────────────────────────┴──────────┴──────────┴──────────────────────┘");

  // Detailed output for each niche
  for (const r of results) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`${r.label}: ${r.newScore}/100 (${r.newVerdict})`);
    console.log(`${"─".repeat(80)}`);

    console.log("\n  РИСКИ:");
    r.report.deathReasons.forEach((d, i) => {
      console.log(`    ${i + 1}. [${d.severity}/10] ${d.reason}`);
      console.log(`       ${d.description}`);
    });

    console.log("\n  ДРАЙВЕРЫ УСПЕХА:");
    (r.report.successDrivers ?? []).forEach((s: SuccessDriver, i: number) => {
      console.log(`    ${i + 1}. [${s.strength}/10] ${s.driver}`);
      console.log(`       ${s.description}`);
    });

    const sumS = (r.report.successDrivers ?? []).reduce((a: number, d: SuccessDriver) => a + d.strength, 0);
    const sumD = r.report.deathReasons.reduce((a, d) => a + d.severity, 0);
    console.log(`\n  Формула: ${sumS}/(${sumS}+${sumD})×100 = ${r.newScore}/100`);
    console.log(`\n  Резюме: ${r.report.summary}`);
  }

  // Winner
  const sorted = [...results].sort((a, b) => b.newScore - a.newScore);
  console.log("\n" + "═".repeat(80));
  console.log(`ЛИДЕР: ${sorted[0]?.label} — ${sorted[0]?.newScore}/100`);
  if (sorted[0]?.newScore >= 60) {
    console.log("✓ ПРОХОДИТ ПОРОГ 60 БАЛЛОВ — РЕКОМЕНДУЕТСЯ К РЕАЛИЗАЦИИ");
  } else {
    console.log(`✗ Не проходит порог 60. Ближайший кандидат: ${sorted[0]?.label} (${sorted[0]?.newScore})`);
  }
  console.log("═".repeat(80));

  process.exit(0);
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
