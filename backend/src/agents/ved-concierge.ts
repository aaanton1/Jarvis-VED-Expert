import Anthropic from "@anthropic-ai/sdk";
import { VedIntent, VedRequest, VedResponse, TnVedCode } from "../types/ved";
import { AltaSoftProvider } from "../providers/alta-soft";
import { SearchProvider } from "../providers/search";
import { parseJSON } from "../utils/parse-json";
import { logUnknownCode } from "../utils/market-demand";
import { VedLegalAgent } from "./ved-legal";
import { calculateDuty } from "./ved-customs";

// ─── Intent Classification Prompt ───

const INTENT_PROMPT = `Ты — VED Concierge, AI-эксперт по внешнеэкономической деятельности (ВЭД) России.
Твои клиенты — селлеры маркетплейсов (Wildberries, Ozon), которые импортируют товары из Китая.

Сообщение продавца: "{{MESSAGE}}"

Определи намерение (intent) и извлеки параметры.

Возможные intent:
1. tn_ved_lookup — хочет узнать код ТН ВЭД для товара
2. duty_calculation — хочет рассчитать пошлину / растаможку
3. certification_check — спрашивает о сертификации, маркировке, документах
4. invoice_check — хочет проверить инвойс на соответствие законам
5. general_question — общий вопрос по ВЭД, штрафам, законам, обелению

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "intent": "tn_ved_lookup | duty_calculation | certification_check | invoice_check | general_question",
  "confidence": 0.0-1.0,
  "params": {
    "product": "описание товара если есть",
    "tnVedCode": "код ТН ВЭД если указан (10 цифр)",
    "country": "страна-отправитель (по умолчанию Китай)",
    "value": цена ЗА ОДНУ ЕДИНИЦУ товара (число или null),
    "currency": "USD | EUR | RUB | null",
    "quantity": общее количество единиц (число или null)
  }
}

КРИТИЧЕСКИ ВАЖНО для поля "value":
- value — ВСЕГДА цена за ОДНУ штуку, НЕ общая сумма.
- Пример: "100 футболок по $3" → value: 3, quantity: 100
- Пример: "ноутбуки на $50000, 100 штук" → value: 500, quantity: 100
- Пример: "партия обуви 500 пар, общая стоимость €7500" → value: 15, quantity: 500
- Если указана только общая сумма без количества → value: общая сумма, quantity: 1`;

// ─── General Question Prompt ───

const GENERAL_PROMPT = `Ты — VED Concierge, AI-эксперт по ВЭД России. Отвечай кратко, по делу, на русском.

КОНТЕКСТ (февраль 2026):
- С октября 2025 ужесточён контроль серого импорта. Карго-схемы под запретом.
- Маркетплейсы (WB, Ozon) блокируют карточки без разрешительной документации с 13.01.2026.
- Штрафы за отсутствие маркировки: до 300 000 руб + конфискация партии.
- ФНС доначисляет 28% от стоимости при отсутствии документов на УСН.
- КоАП 16.2: штраф до 2x стоимости товара за недостоверное декларирование.
- УК РФ ст. 194: уклонение от уплаты пошлин >2 млн руб — уголовная ответственность.
- Обязательная маркировка Честный ЗНАК: обувь, одежда, парфюмерия, шины, электроника, фотоаппараты, табак, молочка, вода, пиво, БАДы.

Вопрос селлера: "{{MESSAGE}}"

Ответь кратко (3-5 предложений). Если нужны конкретные действия — дай пошаговый план.
Если вопрос требует расчёта — предложи уточнить данные.`;

// ─── Response Formatters ───

function formatTnVedResults(results: TnVedCode[]): string {
  if (results.length === 0) {
    return "Код ТН ВЭД не найден. Попробуйте описать товар подробнее или укажите материал и назначение.";
  }

  let msg = `Найдено ${results.length} подходящих кодов:\n\n`;
  for (const r of results) {
    msg += `**${r.code}** — ${r.description}\n`;
    msg += `  Пошлина: ${r.dutyRate}% | НДС: ${r.vatRate}%\n`;
    if (r.requiresMarking) {
      msg += `  Маркировка: ОБЯЗАТЕЛЬНА (${r.markingCategory})\n`;
    }
    if (r.requiresCertification) {
      msg += `  Сертификация: ${r.certTypes.join(", ")}\n`;
    }
    if (r.riskNote) {
      msg += `  ⚠️ РИСК: ${r.riskNote}\n`;
    }
    msg += "\n";
  }
  return msg.trim();
}

function formatDutyResult(calc: ReturnType<typeof calculateDuty>): string {
  return [
    `Расчёт таможенных платежей:`,
    ``,
    `Код ТН ВЭД: ${calc.tnVedCode}`,
    `Товар: ${calc.productDescription}`,
    `Таможенная стоимость: ${calc.customsValueRub.toLocaleString("ru-RU")} руб.`,
    ``,
    `Пошлина (${calc.dutyRate}%): ${calc.dutyAmount.toLocaleString("ru-RU")} руб.`,
    `НДС (20%): ${calc.vatAmount.toLocaleString("ru-RU")} руб.`,
    calc.exciseAmount > 0 ? `Акциз: ${calc.exciseAmount.toLocaleString("ru-RU")} руб.` : null,
    ``,
    `ИТОГО к оплате: ${calc.totalPayments.toLocaleString("ru-RU")} руб.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCertResult(code: TnVedCode): string {
  let msg = `Требования для кода ${code.code}:\n`;
  msg += `Товар: ${code.description}\n\n`;

  if (code.requiresCertification) {
    msg += `Необходимые документы:\n`;
    code.certTypes.forEach((c, i) => {
      msg += `  ${i + 1}. ${c}\n`;
    });
  } else {
    msg += `Сертификация НЕ требуется для данного кода.\n`;
  }

  if (code.requiresMarking) {
    msg += `\nМаркировка Честный ЗНАК: ОБЯЗАТЕЛЬНА (категория: ${code.markingCategory})\n`;
    msg += `Без маркировки: штраф до 300 000 руб. + конфискация партии.\n`;
  } else {
    msg += `\nМаркировка Честный ЗНАК: не требуется для данного товара.\n`;
  }

  if (code.riskNote) {
    msg += `\n⚠️ РИСК ПЕРЕКВАЛИФИКАЦИИ: ${code.riskNote}\n`;
  }

  return msg;
}

// ─── Web Search Fallback Prompt ───

const WEB_SEARCH_PARSE_PROMPT = `Из результатов поиска извлеки информацию о коде ТН ВЭД {{CODE}} (товар: "{{PRODUCT}}").

Результаты поиска:
{{SNIPPETS}}

Извлеки:
- dutyRate: ставка ввозной пошлины (число, %). Если не найдена — 0.
- vatRate: НДС (число, %). Обычно 20% или 10%.
- description: краткое описание товарной позиции (1 предложение)
- requiresCertification: нужна ли сертификация (true/false)
- requiresMarking: нужна ли маркировка Честный ЗНАК (true/false)

Верни ТОЛЬКО валидный JSON (без markdown):
{
  "dutyRate": 0,
  "vatRate": 20,
  "description": "описание",
  "requiresCertification": false,
  "requiresMarking": false
}`;

// ─── Upsell Constants ───

const UPSELL_MSG = `\n\n💡 Я могу провести глубокий анализ этого товара и добавить его в базу в течение 2 часов. Вам это интересно?`;
const FALLBACK_BADGE = `⚡ Базовый анализ на основе открытых данных (код отсутствует в БЗ)`;

// ─── Fallback result type ───

interface WebSearchFallbackResult {
  code: string;
  description: string;
  dutyRate: number;
  vatRate: number;
  requiresCertification: boolean;
  requiresMarking: boolean;
}

// ─── Main Agent ───

export class VedConcierge {
  private llm: Anthropic;
  private altaSoft: AltaSoftProvider;
  private legalAgent: VedLegalAgent;
  private search?: SearchProvider;

  constructor(llm: Anthropic, altaSoft: AltaSoftProvider, search?: SearchProvider) {
    this.llm = llm;
    this.altaSoft = altaSoft;
    this.legalAgent = new VedLegalAgent(llm);
    this.search = search;
  }

  // ─── Web Search Fallback ───

  private async webSearchFallback(
    code: string,
    product: string,
    onProgress?: (msg: string) => void
  ): Promise<WebSearchFallbackResult | null> {
    if (!this.search) return null;

    try {
      const query = code
        ? `ТН ВЭД ${code} пошлина НДС ставка 2026 site:alta.ru OR site:tks.ru OR site:kodtnved.ru`
        : `ТН ВЭД "${product}" код пошлина НДС 2026 site:alta.ru OR site:tks.ru OR site:kodtnved.ru`;

      onProgress?.(`Поиск в открытых источниках: "${code || product}"...`);
      const results = await this.search.search(query, 5);

      if (results.length === 0) return null;

      const snippets = results
        .map((r, i) => `${i + 1}. [${r.title}] ${r.snippet}`)
        .join("\n");

      const prompt = WEB_SEARCH_PARSE_PROMPT
        .replace("{{CODE}}", code || "неизвестен")
        .replace("{{PRODUCT}}", product)
        .replace("{{SNIPPETS}}", snippets);

      const message = await this.llm.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      const parsed = parseJSON<{
        dutyRate: number;
        vatRate: number;
        description: string;
        requiresCertification: boolean;
        requiresMarking: boolean;
      }>(responseText);

      onProgress?.(`Найдено в открытых данных: пошлина ${parsed.dutyRate}%, НДС ${parsed.vatRate}%`);

      return {
        code: code || "—",
        description: parsed.description ?? product,
        dutyRate: parsed.dutyRate ?? 0,
        vatRate: parsed.vatRate ?? 20,
        requiresCertification: parsed.requiresCertification ?? false,
        requiresMarking: parsed.requiresMarking ?? false,
      };
    } catch (err) {
      onProgress?.(`Web search fallback ошибка: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async classifyIntent(text: string): Promise<VedRequest> {
    const prompt = INTENT_PROMPT.replace("{{MESSAGE}}", text);

    const message = await this.llm.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const parsed = parseJSON<{
      intent: VedIntent;
      confidence: number;
      params: VedRequest["extractedParams"];
    }>(responseText);

    return {
      intent: parsed.intent,
      rawText: text,
      extractedParams: parsed.params ?? {},
      confidence: parsed.confidence ?? 0.5,
    };
  }

  async processMessage(
    text: string,
    onProgress?: (msg: string) => void
  ): Promise<VedResponse> {
    onProgress?.("Анализирую запрос...");

    // Step 0: Fast-path — if input contains a 10-digit TN VED code, look it up directly
    // Strip all non-digits, then check if there's a 10-digit code inside
    const digitsOnly = text.replace(/\D/g, "");
    const codeMatch = digitsOnly.length >= 10 ? digitsOnly.match(/(\d{10})/) : null;
    if (codeMatch) {
      onProgress?.(`Обнаружен потенциальный код ТН ВЭД: ${codeMatch[1]}`);
      const directCode = await this.altaSoft.lookupByCode(codeMatch[1]);
      if (directCode) {
        onProgress?.(`Код найден в БЗ: ${directCode.code}`);
        // If text is JUST the code (possibly with spaces/dashes), return lookup
        const isJustCode = digitsOnly.length <= 12;
        if (isJustCode) {
          return this.handleTnVedLookup(
            { intent: "tn_ved_lookup", rawText: text, extractedParams: { tnVedCode: directCode.code }, confidence: 1.0 },
            onProgress
          );
        }
      } else {
        onProgress?.(`Код ${codeMatch[1]} НЕ найден в базе знаний (${digitsOnly.length} цифр извлечено из ввода)`);
      }
    }

    // Step 1: Classify intent
    const request = await this.classifyIntent(text);
    // Inject detected code if Claude missed it
    if (codeMatch && !request.extractedParams.tnVedCode) {
      request.extractedParams.tnVedCode = codeMatch[1];
    }
    onProgress?.(`Intent: ${request.intent} (${Math.round(request.confidence * 100)}%)`);

    // Step 2: Route to module
    switch (request.intent) {
      case "tn_ved_lookup":
        return this.handleTnVedLookup(request, onProgress);

      case "duty_calculation":
        return this.handleDutyCalculation(request, onProgress);

      case "certification_check":
        return this.handleCertificationCheck(request, onProgress);

      case "invoice_check":
        return this.handleInvoiceCheck(request, onProgress);

      case "general_question":
      default:
        return this.handleGeneralQuestion(request, onProgress);
    }
  }

  private async handleTnVedLookup(
    req: VedRequest,
    onProgress?: (msg: string) => void
  ): Promise<VedResponse> {
    const product = req.extractedParams.product ?? req.rawText;
    onProgress?.(`Ищу код ТН ВЭД: "${product}"`);

    // Try by code first if provided
    if (req.extractedParams.tnVedCode) {
      const byCode = await this.altaSoft.lookupByCode(req.extractedParams.tnVedCode);
      if (byCode) {
        return {
          intent: "tn_ved_lookup",
          success: true,
          data: [byCode],
          formattedMessage: formatTnVedResults([byCode]),
          followUpSuggestions: [
            "Рассчитать пошлину для этого товара?",
            "Какие документы нужны для этого кода?",
          ],
        };
      }
    }

    // Search by description
    const results = await this.altaSoft.lookupByDescription(product);

    if (results.length > 0) {
      return {
        intent: "tn_ved_lookup",
        success: true,
        data: results,
        formattedMessage: formatTnVedResults(results),
        followUpSuggestions: ["Рассчитать пошлину?", "Нужна ли маркировка?"],
      };
    }

    // ─── Fallback: Web Search ───
    const searchCode = req.extractedParams.tnVedCode ?? "";
    logUnknownCode(searchCode, product, "tn_ved_lookup");

    const fallback = await this.webSearchFallback(searchCode, product, onProgress);
    if (fallback) {
      let msg = `${FALLBACK_BADGE}\n\n`;
      msg += `**${fallback.code}** — ${fallback.description}\n`;
      msg += `  Пошлина: ${fallback.dutyRate}% | НДС: ${fallback.vatRate}%\n`;
      if (fallback.requiresCertification) msg += `  Сертификация: требуется\n`;
      if (fallback.requiresMarking) msg += `  Маркировка Честный ЗНАК: ОБЯЗАТЕЛЬНА\n`;
      msg += UPSELL_MSG;

      return {
        intent: "tn_ved_lookup",
        success: true,
        data: fallback.description,
        formattedMessage: msg,
        followUpSuggestions: [
          "Да, проведи глубокий анализ",
          "Рассчитать пошлину?",
          "Нужна ли маркировка?",
        ],
      };
    }

    return {
      intent: "tn_ved_lookup",
      success: false,
      data: [],
      formattedMessage: formatTnVedResults([]) + UPSELL_MSG,
      followUpSuggestions: [
        "Да, проведи глубокий анализ",
        "Опишите товар подробнее: материал, назначение, состав",
      ],
    };
  }

  private async handleDutyCalculation(
    req: VedRequest,
    onProgress?: (msg: string) => void
  ): Promise<VedResponse> {
    const product = req.extractedParams.product ?? req.rawText;
    const value = req.extractedParams.value;
    const currency = (req.extractedParams.currency as "USD" | "EUR" | "RUB") ?? "USD";
    const quantity = req.extractedParams.quantity ?? 1;

    // Need a TN VED code first
    let code: TnVedCode | null = null;
    if (req.extractedParams.tnVedCode) {
      code = await this.altaSoft.lookupByCode(req.extractedParams.tnVedCode);
    }
    if (!code) {
      const results = await this.altaSoft.lookupByDescription(product);
      code = results[0] ?? null;
    }

    if (!code) {
      const searchedCode = req.extractedParams.tnVedCode ?? "";
      logUnknownCode(searchedCode, product, "duty_calculation");

      // ─── Fallback: Web Search ───
      const fallback = await this.webSearchFallback(searchedCode, product, onProgress);
      if (fallback && value) {
        // Build a synthetic TnVedCode for duty calculation
        const syntheticCode: TnVedCode = {
          code: fallback.code,
          description: fallback.description,
          section: "—",
          dutyRate: fallback.dutyRate,
          vatRate: fallback.vatRate,
          excise: 0,
          requiresCertification: fallback.requiresCertification,
          certTypes: fallback.requiresCertification ? ["Уточните у брокера"] : [],
          requiresMarking: fallback.requiresMarking,
          keywords: [],
        };
        const totalValue = value * quantity;
        const calc = calculateDuty(syntheticCode, totalValue, currency);
        let msg = `${FALLBACK_BADGE}\n\n` + formatDutyResult(calc);
        if (fallback.requiresCertification) msg += `\n\n📋 Сертификация: требуется (уточните у брокера)`;
        if (fallback.requiresMarking) msg += `\n\n⚠️ Маркировка Честный ЗНАК: вероятно требуется`;
        msg += UPSELL_MSG;
        return {
          intent: "duty_calculation",
          success: true,
          data: calc,
          formattedMessage: msg,
          followUpSuggestions: ["Да, проведи глубокий анализ", "Проверить инвойс?"],
        };
      }

      if (fallback) {
        // Found info but no value — show what we found
        let msg = `${FALLBACK_BADGE}\n\n`;
        msg += `Код ТН ВЭД: ${fallback.code} — ${fallback.description}\n`;
        msg += `Пошлина: ${fallback.dutyRate}%, НДС: ${fallback.vatRate}%\n\n`;
        msg += `Укажите стоимость партии для расчёта.`;
        msg += UPSELL_MSG;
        return {
          intent: "duty_calculation",
          success: false,
          data: msg,
          formattedMessage: msg,
          followUpSuggestions: ["Да, проведи глубокий анализ", "100 штук по $500 каждый"],
        };
      }

      onProgress?.(`Поиск не дал результатов. Код: ${searchedCode || "(не указан)"}, описание: "${product}"`);
      return {
        intent: "duty_calculation",
        success: false,
        data: `Не удалось определить код ТН ВЭД. Искали: код=${searchedCode || "(не указан)"}, товар="${product}".`,
        formattedMessage: `Не удалось определить код ТН ВЭД для расчёта.\nИскали: код=${searchedCode || "(не указан)"}, товар="${product}".\nОпишите товар подробнее или укажите 10-значный код.` + UPSELL_MSG,
        followUpSuggestions: ["Да, проведи глубокий анализ", "Какой код ТН ВЭД у моего товара?"],
      };
    }

    if (!value) {
      return {
        intent: "duty_calculation",
        success: false,
        data: `Нашёл код ${code.code} (${code.description}). Для расчёта укажите стоимость партии.`,
        formattedMessage: `Код ТН ВЭД: ${code.code} — ${code.description}\nПошлина: ${code.dutyRate}%, НДС: ${code.vatRate}%\n\nУкажите стоимость партии для расчёта (например: "$5000" или "500 000 руб").`,
        followUpSuggestions: ["100 штук по $500 каждый"],
      };
    }

    onProgress?.(`Рассчитываю пошлину: ${code.code}, ${value} ${currency} × ${quantity}`);

    // value = per-unit price (fixed prompt ensures this), totalValue = full batch
    const totalValue = value * quantity;
    const calc = calculateDuty(code, totalValue, currency);

    let msg = formatDutyResult(calc);

    // Marking check: warn if Honest ZNAK required
    if (code.requiresMarking) {
      msg += `\n\n⚠️ МАРКИРОВКА ЧЕСТНЫЙ ЗНАК: ОБЯЗАТЕЛЬНА`;
      msg += `\nКатегория: ${code.markingCategory}`;
      msg += `\nС 13.01.2026 маркетплейсы блокируют карточки без маркировки.`;
      msg += `\nШтраф за отсутствие: до 300 000 руб. + конфискация партии.`;
    }

    // Certification check
    if (code.requiresCertification) {
      msg += `\n\n📋 Необходимые документы: ${code.certTypes.join(", ")}`;
    }

    // Risk note: warn about reclassification risk
    if (code.riskNote) {
      msg += `\n\n⚠️ РИСК ПЕРЕКВАЛИФИКАЦИИ: ${code.riskNote}`;
    }

    const followUp = [
      code.requiresMarking ? "Как получить маркировку Честный Знак?" : "Нужна ли сертификация?",
      "Проверить инвойс на соответствие?",
      "Какие документы подготовить?",
    ];

    // Plan B: riskNote + high-risk product → suggest domestic contract manufacturing
    if (code.riskNote) {
      msg += `\n\n🇷🇺 **План Б — Контрактное производство в РФ:**\nРиск переквалификации кода повышает вероятность КТС и задержки на таможне. Рекомендуем рассмотреть контрактное производство аналогичных товаров в РФ для снижения таможенных рисков.`;
      followUp.push("Найти контрактное производство в РФ");
    }

    return {
      intent: "duty_calculation",
      success: true,
      data: calc,
      formattedMessage: msg,
      followUpSuggestions: followUp,
    };
  }

  private async handleCertificationCheck(
    req: VedRequest,
    onProgress?: (msg: string) => void
  ): Promise<VedResponse> {
    const product = req.extractedParams.product ?? req.rawText;

    let code: TnVedCode | null = null;
    if (req.extractedParams.tnVedCode) {
      code = await this.altaSoft.lookupByCode(req.extractedParams.tnVedCode);
    }
    if (!code) {
      const results = await this.altaSoft.lookupByDescription(product);
      code = results[0] ?? null;
    }

    if (!code) {
      const searchedCode = req.extractedParams.tnVedCode ?? "";
      logUnknownCode(searchedCode, product, "certification_check");

      // ─── Fallback: Web Search ───
      const fallback = await this.webSearchFallback(searchedCode, product, onProgress);
      if (fallback) {
        let msg = `${FALLBACK_BADGE}\n\n`;
        msg += `Код: ${fallback.code} — ${fallback.description}\n\n`;
        msg += fallback.requiresCertification
          ? `Сертификация: ТРЕБУЕТСЯ (уточните конкретные документы у таможенного брокера)\n`
          : `Сертификация: вероятно НЕ требуется (рекомендуем уточнить у брокера)\n`;
        msg += fallback.requiresMarking
          ? `\nМаркировка Честный ЗНАК: вероятно ОБЯЗАТЕЛЬНА\n`
          : `\nМаркировка Честный ЗНАК: вероятно не требуется\n`;
        msg += UPSELL_MSG;

        return {
          intent: "certification_check",
          success: true,
          data: msg,
          formattedMessage: msg,
          followUpSuggestions: ["Да, проведи глубокий анализ", "Рассчитать пошлину?"],
        };
      }

      onProgress?.(`Поиск не дал результатов. Код: ${searchedCode || "(не указан)"}, описание: "${product}"`);
      return {
        intent: "certification_check",
        success: false,
        data: `Не удалось определить код ТН ВЭД. Искали: код=${searchedCode || "(не указан)"}, товар="${product}".`,
        formattedMessage: `Не удалось определить код ТН ВЭД.\nИскали: код=${searchedCode || "(не указан)"}, товар="${product}".\nОпишите товар подробнее для определения требований к сертификации.` + UPSELL_MSG,
        followUpSuggestions: ["Да, проведи глубокий анализ", "Какой у меня код ТН ВЭД?"],
      };
    }

    onProgress?.(`Проверяю требования для ${code.code}`);

    return {
      intent: "certification_check",
      success: true,
      data: [code],
      formattedMessage: formatCertResult(code),
      followUpSuggestions: [
        "Сколько стоит сертификация?",
        "Рассчитать полную стоимость растаможки?",
      ],
    };
  }

  private async handleInvoiceCheck(
    req: VedRequest,
    onProgress?: (msg: string) => void
  ): Promise<VedResponse> {
    onProgress?.("Запускаю юридический анализ инвойса...");

    const product = req.extractedParams.product ?? "товар не указан";
    const value = req.extractedParams.value ?? 0;
    const currency = (req.extractedParams.currency as "USD" | "EUR" | "RUB") ?? "USD";
    const country = req.extractedParams.country ?? "Китай";
    const quantity = req.extractedParams.quantity ?? 1;

    const invoiceInput = {
      product,
      tnVedCode: req.extractedParams.tnVedCode,
      declaredValue: value,
      currency,
      country,
      quantity,
      unit: "шт",
    };

    // Get TN VED info for context
    let code: TnVedCode | null = null;
    if (req.extractedParams.tnVedCode) {
      code = await this.altaSoft.lookupByCode(req.extractedParams.tnVedCode);
    }
    if (!code && req.extractedParams.product) {
      const results = await this.altaSoft.lookupByDescription(product);
      code = results[0] ?? null;
    }

    const threshold = code
      ? await this.altaSoft.getMinPriceThreshold(code.code)
      : null;

    const result = await this.legalAgent.checkInvoice(invoiceInput, code, threshold);

    let msg = `Результат проверки инвойса: **${result.status}**\n\n`;

    if (result.flags.length > 0) {
      msg += "Найденные проблемы:\n";
      result.flags.forEach((f, i) => {
        msg += `\n${i + 1}. [${f.severity}/10] ${f.description}\n`;
        msg += `   Штраф: ${f.penalty}\n`;
      });
    }

    msg += `\nРекомендация: ${result.recommendation}`;

    if (result.legalReferences.length > 0) {
      msg += `\n\nПравовые основания:\n`;
      result.legalReferences.forEach((r) => {
        msg += `  - ${r}\n`;
      });
    }

    // Disclaimer + confidence
    msg += `\n\n${result.disclaimer}`;

    // Plan B: if HIGH_RISK + China → suggest RF suppliers
    const isChina = /кит|chin|гуанч|шэньч|иу|yiwu/i.test(country);
    const followUp = [
      "Как исправить инвойс?",
      "Какие документы подготовить для белого импорта?",
    ];

    if (result.status === "HIGH_RISK" && isChina) {
      msg += `\n\n🇷🇺 **План Б — Альтернативные поставщики РФ:**\nРиск по данному инвойсу из Китая критический. Рекомендуем рассмотреть поиск сертифицированных поставщиков внутри РФ для снижения таможенных и юридических рисков.`;
      followUp.push("Найти поставщика этого товара в РФ");
    }

    // Risk note from TN VED code (e.g. reclassification risk)
    if (code?.riskNote) {
      msg += `\n\n⚠️ РИСК ПЕРЕКВАЛИФИКАЦИИ: ${code.riskNote}`;
      followUp.push("Найти контрактное производство в РФ");
    }

    return {
      intent: "invoice_check",
      success: true,
      data: result,
      formattedMessage: msg,
      followUpSuggestions: followUp,
    };
  }

  private async handleGeneralQuestion(
    req: VedRequest,
    onProgress?: (msg: string) => void
  ): Promise<VedResponse> {
    onProgress?.("Формирую ответ...");

    const prompt = GENERAL_PROMPT.replace("{{MESSAGE}}", req.rawText);

    const message = await this.llm.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const answer =
      message.content[0].type === "text" ? message.content[0].text : "";

    const disclaimer =
      "\n\n⚠️ Данный анализ является предварительным AI-ассистированием и не заменяет официальную юридическую консультацию.";

    return {
      intent: "general_question",
      success: true,
      data: answer,
      formattedMessage: answer + disclaimer,
      followUpSuggestions: [
        "Проверить мой товар по коду ТН ВЭД",
        "Рассчитать пошлину",
        "Проверить инвойс",
      ],
    };
  }
}
