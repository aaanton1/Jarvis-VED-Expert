import Anthropic from "@anthropic-ai/sdk";
import { TrendReport } from "./trend-scout";
import { parseJSON } from "../utils/parse-json";

export interface DeathReason {
  reason: string;
  description: string;
  severity: number;
  evidence: string;
}

export interface SuccessDriver {
  driver: string;
  description: string;
  strength: number;
  evidence: string;
}

export interface CriticalReport {
  verdict: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
  overallScore: number;
  deathReasons: DeathReason[];
  successDrivers: SuccessDriver[];
  summary: string;
}

const BALANCED_PROMPT = `Ты — опытный венчурный аналитик. Твоя задача — дать СБАЛАНСИРОВАННУЮ оценку бизнес-идеи: найти как риски, так и точки роста.

Ты получил отчёт об исследовании ниши:

НИША: {{NICHE}}

ОБЗОР РЫНКА: {{OVERVIEW}}

НАЙДЕННЫЕ БОЛИ:
{{PAIN_POINTS}}

КОНКУРЕНТЫ: {{COMPETITORS}}

РАЗМЕР РЫНКА: {{MARKET_SIZE}}

═══════════════════════════════════════
ЗАДАНИЕ: Проведи ДВУСТОРОННЮЮ оценку.
═══════════════════════════════════════

ЧАСТЬ 1 — РИСКИ (Death Reasons):
Найди ровно 5 конкретных причин, почему бизнес может провалиться в первый год.
Оценивай severity ЧЕСТНО:
- 1-3: незначительный риск, легко митигируется
- 4-6: умеренный риск, требует внимания и ресурсов
- 7-8: серьёзный риск, может убить бизнес без правильной стратегии
- 9-10: ТОЛЬКО для рисков уровня "регуляторный запрет" или "физическая невозможность"
НЕ СТАВЬ 8-10 всем подряд. Если риск решается деньгами или временем — это НЕ 9-10.

ЧАСТЬ 2 — ДРАЙВЕРЫ УСПЕХА (Success Drivers):
Найди ровно 5 конкретных причин, почему бизнес МОЖЕТ ВЗЛЕТЕТЬ.
Оценивай strength ЧЕСТНО:
- 1-3: слабое преимущество, легко копируется
- 4-6: умеренное преимущество, даёт фору на 6-12 месяцев
- 7-8: сильное преимущество, создаёт устойчивый конкурентный барьер
- 9-10: ТОЛЬКО для уникальных, неповторимых преимуществ

Учитывай при оценке:
1. КОЭФФИЦИЕНТ КОМПЕНСАЦИИ: Если юнит-экономика сходится (LTV/CAC > 5), снижай severity рисков внедрения на 2-3 пункта. Прибыль оправдывает усилия.
2. СТОИМОСТЬ ОШИБКИ: Если ошибка бота НЕ ведёт к смерти, потере здоровья или многомиллионным искам — снижай severity юридических рисков на 2-3 пункта.
3. ГОЛУБОЙ ОКЕАН: Если конкуренты не используют данный канал (например, мессенджер Max) — это сильный success driver, а не "платформа-призрак".
4. МАСШТАБИРУЕМОСТЬ: SaaS с AI масштабируется без найма штата — это драйвер, а не риск.

ЧАСТЬ 3 — ИТОГОВЫЙ БАЛЛ (overallScore):
Формула: overallScore = round((sumSuccessStrengths / (sumSuccessStrengths + sumDeathSeverities)) × 100)
Пример: если сумма strengths = 35, сумма severities = 25 → score = 35/(35+25)×100 = 58

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "deathReasons": [
    {
      "reason": "Короткое название риска",
      "description": "2-3 предложения с деталями",
      "severity": 1-10,
      "evidence": "Данные или паттерн, подтверждающий риск"
    }
  ],
  "successDrivers": [
    {
      "driver": "Короткое название драйвера",
      "description": "2-3 предложения с деталями",
      "strength": 1-10,
      "evidence": "Данные или паттерн, подтверждающий преимущество"
    }
  ],
  "overallScore": 1-100,
  "verdict": "HIGH_RISK | MEDIUM_RISK | LOW_RISK",
  "summary": "3-4 предложения: сбалансированный вердикт — главные риски И главные возможности"
}

Шкала вердикта:
- 1-33 = HIGH_RISK (фатальные проблемы перевешивают)
- 34-59 = MEDIUM_RISK (есть шанс, но нужна сильная команда)
- 60-100 = LOW_RISK (преимущества перевешивают, стоит строить)

ВАЖНО:
- Ответь СТРОГО на русском (кроме verdict: HIGH_RISK/MEDIUM_RISK/LOW_RISK)
- НЕ будь параноиком. Задача — помочь принять решение, а не убить идею.
- Средняя severity рисков для нормального B2B SaaS: 4-6, не 8-10.
- ОБЯЗАТЕЛЬНО рассчитай overallScore по формуле. Покажи расчёт в summary.`;

export class DevilAdvocate {
  private llm: Anthropic;

  constructor(llm: Anthropic) {
    this.llm = llm;
  }

  async critique(
    trendReport: TrendReport,
    onProgress?: (msg: string) => void
  ): Promise<CriticalReport> {
    onProgress?.("Balanced Critic v2 запущен. Ищу риски И точки роста...");

    const painPointsText = trendReport.painPoints
      .map((p, i) => `${i + 1}. ${p.pain} (severity: ${p.severity}/10, source: ${p.source})`)
      .join("\n");

    const prompt = BALANCED_PROMPT
      .replace("{{NICHE}}", trendReport.niche)
      .replace("{{OVERVIEW}}", trendReport.marketOverview)
      .replace("{{PAIN_POINTS}}", painPointsText)
      .replace("{{COMPETITORS}}", trendReport.competitors.join(", "))
      .replace("{{MARKET_SIZE}}", trendReport.estimatedMarketSize);

    const message = await this.llm.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    onProgress?.("Balanced Critic v2 завершил анализ.");

    const analysis = parseJSON<CriticalReport>(responseText);

    // Server-side score validation: recalculate from raw data
    const sumStrengths = (analysis.successDrivers ?? []).reduce(
      (acc, d) => acc + (d.strength ?? 0),
      0
    );
    const sumSeverities = (analysis.deathReasons ?? []).reduce(
      (acc, r) => acc + (r.severity ?? 0),
      0
    );
    const total = sumStrengths + sumSeverities;
    const calculatedScore = total > 0 ? Math.round((sumStrengths / total) * 100) : 50;

    // Use calculated score, not LLM's self-reported score (prevents hallucination)
    const overallScore = calculatedScore;

    let verdict: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
    if (overallScore <= 33) verdict = "HIGH_RISK";
    else if (overallScore <= 59) verdict = "MEDIUM_RISK";
    else verdict = "LOW_RISK";

    return {
      verdict,
      overallScore,
      deathReasons: analysis.deathReasons ?? [],
      successDrivers: analysis.successDrivers ?? [],
      summary: analysis.summary ?? "",
    };
  }
}
