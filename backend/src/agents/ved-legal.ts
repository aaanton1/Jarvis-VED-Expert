import Anthropic from "@anthropic-ai/sdk";
import { InvoiceInput, InvoiceCheckResult, TnVedCode } from "../types/ved";
import { parseJSON } from "../utils/parse-json";

// ─── Legal Analysis Prompt ───

const LEGAL_PROMPT = `Ты — юрист-эксперт по таможенному праву РФ с 15-летним стажем.
Анализируй данные инвойса на признаки нарушений при импорте.

ДАННЫЕ ИНВОЙСА:
- Товар: {{PRODUCT}}
- Код ТН ВЭД: {{CODE}}
- Описание кода: {{CODE_DESC}}
- Заявленная стоимость: {{VALUE}} {{CURRENCY}} ({{QUANTITY}} {{UNIT}})
- Цена за единицу: {{UNIT_PRICE}} {{CURRENCY}}
- Страна отправления: {{COUNTRY}}
- Минимальный ценовой порог ФТС: {{THRESHOLD}}
- Требуется маркировка: {{MARKING}}
- Требуется сертификация: {{CERT}}

══════════════════════════════════════════════════
БАЗА ЗНАНИЙ — ЗАКОНОДАТЕЛЬСТВО 2025-2026:
══════════════════════════════════════════════════

1. ЗАНИЖЕНИЕ ТАМОЖЕННОЙ СТОИМОСТИ:
   - ФТС с октября 2025 применяет профили риска с минимальными ценовыми порогами по кодам ТН ВЭД.
   - Если цена в инвойсе ниже порога — автоматическая КТС (корректировка таможенной стоимости).
   - Штраф по КоАП 16.2 ч.2: от 50% до 200% стоимости товара за недостоверное декларирование.
   - УК РФ ст. 194: уклонение от уплаты пошлин свыше 2 000 000 руб. — до 5 лет лишения свободы.

2. МАРКИРОВКА ЧЕСТНЫЙ ЗНАК:
   - С 13.01.2026 маркетплейсы (WB, Ozon) блокируют карточки без разрешительной документации.
   - Штраф за отсутствие маркировки: до 300 000 руб. (юрлица) + конфискация партии.
   - Категории: обувь, одежда, парфюмерия, шины, электроника, фотоаппараты, табак, молочка, вода, пиво, БАДы.

3. СЕРТИФИКАЦИЯ:
   - Ввоз без необходимой декларации/сертификата: КоАП 16.3 — штраф 50 000-300 000 руб.
   - Для детских товаров и продуктов питания — обязательный сертификат ТР ТС.
   - СГР (свидетельство о гос. регистрации) для косметики и бытовой химии.

4. СЕРЫЙ ИМПОРТ (КАРГО):
   - ФНС доначисляет 28% от стоимости товаров, ввезённых без документов (ИП на УСН).
   - Расхождение между данными площадки и налоговой декларацией — автоматическая проверка.
   - С 2026 года ФТС и ФНС обмениваются данными в реальном времени.

5. САНКЦИИ:
   - Параллельный импорт: только по списку Минпромторга (приказ 1532).
   - Товары двойного назначения: нотификация ФСБ обязательна для шифровальных средств.

══════════════════════════════════════════════════
ЗАДАНИЕ:
══════════════════════════════════════════════════

Проверь инвойс по 5 критериям:
1. Не занижена ли стоимость (сравни с рыночной ценой и порогом ФТС)
2. Соответствует ли код ТН ВЭД описанию товара
3. Нужна ли обязательная маркировка
4. Какие документы отсутствуют
5. Есть ли санкционные риски

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "status": "CLEAN | SUSPICIOUS | HIGH_RISK",
  "confidenceScore": 0-100,
  "flags": [
    {
      "type": "undervaluation | wrong_code | missing_docs | sanctions_risk | marking_violation",
      "severity": 1-10,
      "description": "Описание проблемы на русском",
      "penalty": "Конкретный штраф (статья + сумма)"
    }
  ],
  "recommendation": "Что делать селлеру (2-3 предложения)",
  "legalReferences": ["Конкретные статьи законов"]
}

ПРАВИЛО УВЕРЕННОСТИ (confidenceScore):
- 95-100: Однозначная ситуация, чёткие признаки нарушения или их отсутствие
- 80-94: Вероятное нарушение, но возможны нюансы
- 60-79: Неоднозначная ситуация, недостаточно данных для точного вывода
- 0-59: Требуется значительно больше информации для анализа

ВАЖНО:
- Если стоимость ниже порога ФТС — это ВСЕГДА флаг severity 8+
- Если маркировка обязательна но не указана — severity 7+
- Если всё в порядке — верни status "CLEAN" с пустым массивом flags
- Ответ на русском языке`;

// ─── Agent ───

export class VedLegalAgent {
  private llm: Anthropic;

  constructor(llm: Anthropic) {
    this.llm = llm;
  }

  async checkInvoice(
    invoice: InvoiceInput,
    code: TnVedCode | null,
    minPriceThreshold: number | null
  ): Promise<InvoiceCheckResult> {
    const unitPrice =
      invoice.quantity > 0
        ? (invoice.declaredValue / invoice.quantity).toFixed(2)
        : invoice.declaredValue.toFixed(2);

    const prompt = LEGAL_PROMPT
      .replace("{{PRODUCT}}", invoice.product)
      .replace("{{CODE}}", code?.code ?? "не определён")
      .replace("{{CODE_DESC}}", code?.description ?? "не определён")
      .replace("{{VALUE}}", String(invoice.declaredValue))
      .replace(/\{\{CURRENCY\}\}/g, invoice.currency)
      .replace("{{QUANTITY}}", String(invoice.quantity))
      .replace("{{UNIT}}", invoice.unit)
      .replace("{{UNIT_PRICE}}", unitPrice)
      .replace("{{COUNTRY}}", invoice.country)
      .replace(
        "{{THRESHOLD}}",
        minPriceThreshold !== null
          ? `$${minPriceThreshold} за единицу`
          : "не установлен для данного кода"
      )
      .replace(
        "{{MARKING}}",
        code?.requiresMarking ? `ДА (${code.markingCategory})` : "НЕТ"
      )
      .replace(
        "{{CERT}}",
        code?.requiresCertification
          ? `ДА: ${code.certTypes.join(", ")}`
          : "НЕТ"
      );

    const message = await this.llm.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const result = parseJSON<InvoiceCheckResult>(responseText);

    const confidenceScore = result.confidenceScore ?? 70;
    const needsBrokerReview = confidenceScore < 95;

    const disclaimer =
      "⚠️ Данный анализ является предварительным AI-ассистированием и не заменяет официальную юридическую консультацию.";

    const brokerNote = needsBrokerReview
      ? `\n🔍 Уверенность AI: ${confidenceScore}% — Требуется ручная проверка таможенным брокером.`
      : "";

    // ─── Hardcoded legal triggers — guarantee critical articles are always present ───
    const flags = result.flags ?? [];
    const refs = new Set(result.legalReferences ?? []);

    const hasUndervaluation = flags.some(
      (f) => f.type === "undervaluation" && f.severity >= 8
    );
    const hasSanctionsOrFSB = flags.some(
      (f) => f.type === "sanctions_risk" || /фсб|нотификац|шифров|двойного назначен/i.test(f.description)
    );
    const hasMissingDocs = flags.some((f) => f.type === "missing_docs");

    if (hasUndervaluation) {
      refs.add("КоАП РФ ст. 16.2 ч.2 — недостоверное декларирование (штраф 50-200% стоимости)");
      refs.add("УК РФ ст. 194 — уклонение от уплаты таможенных платежей свыше 2 млн руб. (до 5 лет)");
    }
    if (hasSanctionsOrFSB) {
      refs.add("УК РФ ст. 226.1 — контрабанда стратегически важных товаров и товаров двойного назначения (до 7 лет)");
      refs.add("Постановление Правительства РФ №313 — нотификация ФСБ для шифровальных средств");
    }
    if (hasMissingDocs) {
      refs.add("КоАП РФ ст. 16.3 — несоблюдение запретов и ограничений при ввозе (50 000-300 000 руб.)");
    }

    return {
      status: result.status ?? "SUSPICIOUS",
      flags,
      recommendation: result.recommendation ?? "",
      legalReferences: Array.from(refs),
      confidenceScore,
      disclaimer: disclaimer + brokerNote,
    };
  }
}
