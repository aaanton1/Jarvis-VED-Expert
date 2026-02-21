import Anthropic from "@anthropic-ai/sdk";
import { createSearchProvider } from "../providers/search";
import { TrendScout, TrendReport } from "../agents/trend-scout";
import { DevilAdvocate, CriticalReport } from "../agents/devil-advocate";
import { saveReport, FullReport } from "../utils/report";
import { randomUUID } from "crypto";

export type ResearchStage =
  | "started"
  | "trend_search"
  | "trend_analysis"
  | "critical_analysis"
  | "saving_report"
  | "completed"
  | "error";

export interface ResearchProgress {
  stage: ResearchStage;
  message: string;
  progress: number; // 0-100
}

export interface ResearchResult {
  id: string;
  report: FullReport;
  filepath: string;
}

export class ResearchEngine {
  private llm: Anthropic;

  constructor() {
    this.llm = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async run(
    niche: string,
    onProgress?: (p: ResearchProgress) => void
  ): Promise<ResearchResult> {
    const id = randomUUID();

    const emit = (stage: ResearchStage, message: string, progress: number) => {
      onProgress?.({ stage, message, progress });
    };

    emit("started", `Запуск исследования: "${niche}"`, 0);

    // Цикл 1: Trend Scout
    const searchProvider = createSearchProvider();
    const trendScout = new TrendScout(searchProvider, this.llm);

    emit("trend_search", "Цикл 1: Поиск трендов и болей клиентов...", 10);

    let trendReport: TrendReport;
    try {
      trendReport = await trendScout.analyze(niche, (msg) => {
        emit("trend_analysis", msg, 30);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      emit("error", `Ошибка Trend Scout: ${message}`, -1);
      throw err;
    }

    emit("trend_analysis", "Цикл 1 завершён. Запуск критического анализа...", 50);

    // Цикл 2: Devil's Advocate
    const devilAdvocate = new DevilAdvocate(this.llm);

    let criticalReport: CriticalReport;
    try {
      criticalReport = await devilAdvocate.critique(trendReport, (msg) => {
        emit("critical_analysis", msg, 70);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      emit("error", `Ошибка Devil's Advocate: ${message}`, -1);
      throw err;
    }

    emit("saving_report", "Сохранение отчёта...", 90);

    const fullReport: FullReport = {
      id,
      niche,
      createdAt: new Date().toISOString(),
      trendReport,
      criticalReport,
    };

    const filepath = saveReport(fullReport);

    emit("completed", `Исследование завершено. Вердикт: ${criticalReport.verdict}`, 100);

    return { id, report: fullReport, filepath };
  }
}
