/**
 * import_navigator.ts — Навигатор Импорта для селлеров WB/Ozon.
 *
 * Проводит интервью с селлером, определяет коды ТН ВЭД,
 * генерирует полный Import Brief с расчётами, рисками и чеклистом.
 *
 * Использование:
 *   npx tsx scripts/import_navigator.ts              # интерактивный режим
 *   npx tsx scripts/import_navigator.ts --demo       # демо: школьные пеналы
 *
 * Без Claude API — всё считается локально из базы знаний.
 */

import "dotenv/config";
import readline from "readline";
import chalk from "chalk";
import { ImportProfile, ImportBrief, TnVedCode } from "../backend/src/types/ved";
import { TN_VED_DATABASE, FTS_PRICE_THRESHOLDS } from "../backend/src/utils/ved-knowledge";

// ─── Readline Helper ───

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(chalk.green(`  ${question} `), (answer) => resolve(answer.trim()));
  });
}

function askChoice(rl: readline.Interface, question: string, options: string[]): Promise<number> {
  return new Promise((resolve) => {
    console.log(chalk.yellow(`\n  ${question}`));
    options.forEach((opt, i) => {
      console.log(chalk.white(`    ${i + 1}. ${opt}`));
    });
    rl.question(chalk.green("  Ваш выбор (номер): "), (answer) => {
      const num = parseInt(answer.trim(), 10);
      resolve(num >= 1 && num <= options.length ? num : 1);
    });
  });
}

// ─── Interview ───

async function interview(rl: readline.Interface): Promise<ImportProfile> {
  console.log(chalk.cyan("\n╔══════════════════════════════════════════════════╗"));
  console.log(chalk.cyan("║") + chalk.bold.white("  НАВИГАТОР ИМПОРТА — Интервью по товару         ") + chalk.cyan("║"));
  console.log(chalk.cyan("║") + chalk.gray("  Отвечайте на вопросы, я подберу коды и риски   ") + chalk.cyan("║"));
  console.log(chalk.cyan("╚══════════════════════════════════════════════════╝"));

  // Q1: Product
  const product = await ask(rl, "Что везём? (название товара):");

  // Q2: Materials
  const matChoice = await askChoice(rl, "Из какого материала?", [
    "Текстиль (ткань, полиэстер, нейлон)",
    "Пластик (EVA, полипропилен, ПВХ)",
    "Кожа / искусственная кожа",
    "Металл (жесть, сталь)",
    "Микс (несколько материалов)",
  ]);
  const materialMap: Record<number, string[]> = {
    1: ["текстиль"],
    2: ["пластик"],
    3: ["кожа"],
    4: ["металл"],
    5: ["текстиль", "пластик"],
  };
  const materials = materialMap[matChoice] || ["текстиль", "пластик"];

  // Q3: Target audience
  const audienceChoice = await askChoice(rl, "Целевая аудитория?", [
    "Дети до 14 лет (ТР ТС 007/2011 — сертификат обязателен!)",
    "Подростки/взрослые (14+)",
    "Универсальный товар (без привязки к возрасту)",
  ]);
  const audienceMap: Record<number, "children" | "adult" | "universal"> = {
    1: "children",
    2: "adult",
    3: "universal",
  };
  const targetAudience = audienceMap[audienceChoice] || "universal";

  // Q4: Quantity and price
  const qtyStr = await ask(rl, "Количество в партии (шт):");
  const quantity = parseInt(qtyStr, 10) || 500;

  const priceStr = await ask(rl, "Закупочная цена за штуку (USD):");
  const pricePerUnit = parseFloat(priceStr) || 0.3;

  // Q5: Country & logistics
  const countryStr = await ask(rl, "Страна-поставщик (по умолчанию Китай):");
  const country = countryStr || "Китай";

  const logChoice = await askChoice(rl, "Способ доставки?", [
    "Карго (сборный груз через посредника)",
    "Авиа (DHL / FedEx / SF Express)",
    "Море (контейнер)",
    "Экспресс-почта",
  ]);
  const logMap: Record<number, "cargo" | "air" | "sea" | "express"> = {
    1: "cargo",
    2: "air",
    3: "sea",
    4: "express",
  };
  const logistics = logMap[logChoice] || "cargo";

  // Q6: License, electronics, fastener
  const licenseChoice = await askChoice(rl, "Есть лицензионные принты? (Disney, Marvel и т.д.)", [
    "Нет",
    "Да",
  ]);
  const hasLicense = licenseChoice === 2;

  const electroChoice = await askChoice(rl, "Есть встроенная электроника? (LED, батарейки)", [
    "Нет",
    "Да",
  ]);
  const hasElectronics = electroChoice === 2;

  const fastenerStr = await ask(rl, "Тип застёжки (молния / кнопка / магнит / нет):");
  const hasFastener = fastenerStr && fastenerStr !== "нет" ? fastenerStr : null;

  // Q7: Buyer workflow (expanded for direct importers)
  const buyerChoice = await askChoice(rl, "Как работаете с поставщиком?", [
    "Через байера / посредника / карго-агента в Китае",
    "Через посредника в РФ (он закупает и пересылает)",
    "Напрямую с фабрикой (есть контракт)",
    "Покупаю сам на 1688.com / Alibaba.com",
  ]);
  const worksViaBuyer = buyerChoice === 1 || buyerChoice === 2;
  const worksViaRfIntermediary = buyerChoice === 2;
  const worksDirectWithFactory = buyerChoice === 3;

  // Q8: Source platform (for direct importers and 1688/Alibaba)
  let sourcePlatform: "1688" | "alibaba" | "factory_direct" | "agent" | "other" = "agent";
  if (buyerChoice === 4) {
    const platformChoice = await askChoice(rl, "На какой площадке закупаете?", [
      "1688.com (внутренний Китай, цены в юанях)",
      "Alibaba.com (международная, цены в USD)",
      "Другая площадка / WeChat / Pinduoduo",
    ]);
    sourcePlatform = platformChoice === 1 ? "1688" : platformChoice === 2 ? "alibaba" : "other";
  } else if (buyerChoice === 3) {
    sourcePlatform = "factory_direct";
  }

  // Q9: Export license from Chinese supplier
  let hasExportLicense = false;
  if (buyerChoice === 3 || buyerChoice === 4) {
    console.log(chalk.yellow("\n  ⚠️  ВАЖНО: для легального вывоза товара из Китая поставщик"));
    console.log(chalk.yellow("  должен иметь экспортную лицензию (进出口经营权)."));
    console.log(chalk.yellow("  Без неё невозможно оформить экспортную декларацию,"));
    console.log(chalk.yellow("  а без экспортной декларации — ваш инвойс «серый»."));
    const exportChoice = await askChoice(rl, "Есть ли у вашего поставщика экспортная лицензия (进出口经营权)?", [
      "Да, поставщик имеет лицензию на экспорт",
      "Нет / не знаю",
    ]);
    hasExportLicense = exportChoice === 1;

    if (!hasExportLicense) {
      console.log(chalk.cyan("\n  💡 РЕШЕНИЕ: Используйте экспортного агента (торговую компанию)"));
      console.log(chalk.cyan("  в Китае, у которого есть экспортная лицензия. Агент:"));
      console.log(chalk.white("    1. Выкупает товар у фабрики от своего юрлица"));
      console.log(chalk.white("    2. Оформляет экспортную декларацию"));
      console.log(chalk.white("    3. Выписывает инвойс на ваше ИП/ООО"));
      console.log(chalk.white("    4. Обеспечивает возврат НДС (退税) в Китае"));
      console.log(chalk.gray("  Стоимость услуги: 3-7% от суммы заказа"));
      console.log(chalk.gray("  Мы можем порекомендовать проверенного агента — напишите 'агент' в чат\n"));
    }
  }

  let canConfirmOrigin = true;
  if (worksViaBuyer) {
    const originChoice = await askChoice(rl, "Можете подтвердить происхождение товара документами? (инвойс от фабрики, экспортная декларация)", [
      "Да, у байера/посредника есть документы",
      "Нет / не уверен",
    ]);
    canConfirmOrigin = originChoice === 1;
  } else if (buyerChoice === 4 && !hasExportLicense) {
    canConfirmOrigin = false;
  }

  return {
    product,
    materials,
    targetAudience,
    quantity,
    pricePerUnit,
    currency: "USD",
    totalValue: quantity * pricePerUnit,
    country,
    logistics,
    hasLicense,
    hasElectronics,
    hasFastener,
    worksViaBuyer,
    worksViaRfIntermediary,
    worksDirectWithFactory,
    sourcePlatform,
    hasExportLicense,
    canConfirmOrigin,
    tnVedCodes: [],
  };
}

// ─── Classify: find matching TN VED codes ───

function classifyProduct(profile: ImportProfile): TnVedCode[] {
  const searchTerms = [
    profile.product.toLowerCase(),
    ...profile.materials.map((m) => m.toLowerCase()),
  ];

  const scored: { code: TnVedCode; score: number }[] = [];

  for (const entry of TN_VED_DATABASE) {
    let score = 0;
    for (const term of searchTerms) {
      for (const kw of entry.keywords) {
        if (kw.includes(term) || term.includes(kw)) {
          score += 3;
        }
      }
      if (entry.description.toLowerCase().includes(term)) {
        score += 2;
      }
    }
    // Material match boost
    if (profile.materials.includes("текстиль") && entry.code.startsWith("4202")) score += 5;
    if (profile.materials.includes("пластик") && entry.code.startsWith("3926")) score += 5;
    if (profile.materials.includes("кожа") && entry.code.startsWith("4202")) score += 4;
    if (profile.materials.includes("металл") && entry.code.startsWith("73")) score += 4;

    if (score > 0) {
      scored.push({ code: entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // For mixed materials, try to return one code per material (max 2)
  // Otherwise return top match only
  if (profile.materials.length > 1) {
    const seen = new Set<string>();
    const result: TnVedCode[] = [];
    for (const s of scored) {
      const prefix = s.code.code.slice(0, 4);
      if (!seen.has(prefix)) {
        seen.add(prefix);
        result.push(s.code);
      }
      if (result.length >= profile.materials.length) break;
    }
    return result;
  }
  return scored.slice(0, 1).map((s) => s.code);
}

// ─── Generate Buyer Questions ───

function generateBuyerQuestions(profile: ImportProfile): string[] {
  const questions: string[] = [
    "Пришлите, пожалуйста, commercial invoice (коммерческий инвойс) с полной спецификацией товара: название, материал, количество, цена за единицу",
    "Какой точный состав материала? (например: 100% полиэстер, или 80% хлопок/20% полиэстер) — нужно для таможенной декларации",
    "Можете предоставить packing list (упаковочный лист) с указанием веса нетто/брутто и габаритов коробок?",
    "Есть ли у фабрики test report (протокол испытаний) или сертификат качества на этот товар?",
    "Фабрика может выписать export declaration (экспортную декларацию) на своё имя?",
  ];

  if (profile.targetAudience === "children") {
    questions.push(
      "ВАЖНО: товар детский — нужен сертификат ТР ТС 007/2011. Есть ли у фабрики протокол испытаний на содержание фталатов, формальдегида и миграцию красителей?",
      "Можете прислать образцы (3-5 шт) для тестирования в российской лаборатории ДО отправки основной партии?"
    );
  }

  if (profile.hasLicense) {
    questions.push(
      "На товаре есть лицензионные изображения (мультперсонажи, бренды). Есть ли у фабрики лицензионное соглашение (licensing agreement)? Без него товар задержат на таможне как контрафакт"
    );
  }

  if (profile.hasElectronics) {
    questions.push(
      "В товаре есть электроника — пришлите техническую документацию: напряжение, тип батареи, наличие шифровальных модулей (Bluetooth/WiFi)"
    );
  }

  // Questions specific to 1688/Alibaba direct importers
  if (profile.sourcePlatform === "1688" || profile.sourcePlatform === "alibaba") {
    questions.push(
      "Есть ли у вас экспортная лицензия (进出口经营权)? Можете ли вы оформить экспортную декларацию от своего имени?"
    );
    questions.push(
      "Готовы ли вы выписать commercial invoice на иностранное юрлицо/ИП (а не внутренний китайский 发票)?"
    );
  }

  if (profile.sourcePlatform === "1688") {
    questions.push(
      "Примечание для закупок на 1688: запросите у продавца его Business License (营业执照) — проверьте, что он реально существует и имеет право торговать данной категорией товаров"
    );
  }

  return questions;
}

// ─── Generate Risks ───

function generateRisks(profile: ImportProfile, codes: TnVedCode[]): { level: "HIGH" | "MEDIUM" | "LOW"; text: string }[] {
  const risks: { level: "HIGH" | "MEDIUM" | "LOW"; text: string }[] = [];

  // FTS price threshold check
  for (const code of codes) {
    const threshold = FTS_PRICE_THRESHOLDS[code.code];
    if (threshold && profile.pricePerUnit < threshold) {
      risks.push({
        level: "HIGH",
        text: `ЗАНИЖЕНИЕ СТОИМОСТИ — $${profile.pricePerUnit}/шт ниже порога ФТС ($${threshold}) для кода ${code.code}. Высокий риск КТС (корректировка таможенной стоимости). Таможня потребует доказать реальность цены: контракт, прайс-лист фабрики, скриншоты переписки, Alibaba-листинги`,
      });
    }
  }

  // Children's product risk
  if (profile.targetAudience === "children") {
    risks.push({
      level: "HIGH",
      text: "ДЕТСКАЯ ПРОДУКЦИЯ — повышенный контроль ФТС. Обязателен СЕРТИФИКАТ (не декларация!) ТР ТС 007/2011. Без него товар не выпустят. Штраф: КоАП 14.43 — до 300,000 руб + конфискация",
    });
  }

  // License risk
  if (profile.hasLicense) {
    risks.push({
      level: "HIGH",
      text: "ЛИЦЕНЗИОННЫЕ ИЗОБРАЖЕНИЯ — без лицензионного соглашения товар задержат как контрафакт. УК РФ ст. 180 — до 4 лет. Правообладатель (Disney, Marvel) может подать иск",
    });
  }

  // Cargo + no origin confirmation → 115-ФЗ risk
  if (profile.logistics === "cargo" && profile.worksViaBuyer && !profile.canConfirmOrigin) {
    risks.push({
      level: "HIGH",
      text: "115-ФЗ РИСК — оплата байеру на карту физлица без подтверждения происхождения товара. Банк может заблокировать счёт по 115-ФЗ (противодействие отмыванию). Рекомендация: перейти на контрактную схему через юрлицо или ИП, использовать услугу 'Технический импортёр'",
    });
  }

  // Cargo without DT for small amounts
  if (profile.logistics === "cargo" && profile.totalValue < 200) {
    risks.push({
      level: "MEDIUM",
      text: `Карго-доставка при сумме $${profile.totalValue.toFixed(0)} — оператор может провести без полного декларирования (ДТ). Но для продажи на WB/Ozon нужен полный пакет: сертификат + ДТ + инвойс. Без ДТ карточку могут заблокировать`,
    });
  }

  // Buyer workflow risk
  if (profile.worksViaBuyer) {
    risks.push({
      level: "MEDIUM",
      text: "РАБОТА ЧЕРЕЗ БАЙЕРА — вы не контролируете документы напрямую. Байер может: занизить стоимость в инвойсе, указать неверный код ТН ВЭД, не предоставить экспортную декларацию. Перешлите байеру список вопросов из раздела 'Вопросы для байера'",
    });
  }

  // RF intermediary risks
  if (profile.worksViaRfIntermediary) {
    risks.push({
      level: "HIGH",
      text: "ПОСРЕДНИК В РФ БЕЗ ГТД — если посредник не предоставляет номер грузовой таможенной декларации (ГТД), товар юридически «серый». С 2026 года WB/Ozon требуют номер ГТД в карточке товара. Без ГТД: блокировка карточки, штраф КоАП 14.10 (до 200,000 руб + конфискация), невозможность подтвердить легальность при проверке ФНС/ФТС",
    });
    risks.push({
      level: "HIGH",
      text: "ТОРГОВЛЯ БЕЗ ГТД НА WB В 2026 — последствия: (1) Wildberries блокирует карточку при отсутствии разрешительных документов и номера ДТ; (2) ФНС вправе запросить подтверждение легальности ввоза при выездной проверке; (3) ФТС может возбудить дело по ст. 16.21 КоАП (приобретение незаконно ввезённых товаров — штраф до стоимости товара); (4) Покупатель вправе подать жалобу в Роспотребнадзор — штраф по ст. 14.43 КоАП до 300,000 руб",
    });
  }

  // 1688/Alibaba specific risks
  if (profile.sourcePlatform === "1688") {
    risks.push({
      level: "HIGH",
      text: "ЗАКУПКА НА 1688.COM — площадка для внутреннего рынка Китая. Продавцы на 1688 часто НЕ имеют экспортной лицензии (进出口经营权). Без экспортной декларации ваш инвойс недействителен для российской таможни. Решение: работайте через экспортного агента или торговую компанию",
    });
    if (!profile.hasExportLicense) {
      risks.push({
        level: "HIGH",
        text: "НЕТ ЭКСПОРТНОЙ ЛИЦЕНЗИИ У ПОСТАВЩИКА — без 进出口经营权 поставщик не может оформить экспортную декларацию. Варианты: (1) Найти экспортного агента в Китае (3-7% комиссия), (2) Попросить поставщика оформить лицензию (долго, 1-2 мес), (3) Переключиться на Alibaba.com — там продавцы чаще имеют лицензию",
      });
    }
  }

  if (profile.sourcePlatform === "alibaba") {
    risks.push({
      level: "MEDIUM",
      text: "ЗАКУПКА НА ALIBABA.COM — проверьте статус поставщика: Gold Supplier + Trade Assurance. Запросите Business License и Export License ДО оплаты. Verified Supplier — надёжнее, но дороже",
    });
  }

  // Export license missing for direct importers
  if ((profile.worksDirectWithFactory || profile.sourcePlatform !== "agent") && !profile.hasExportLicense) {
    risks.push({
      level: "HIGH",
      text: "БЕЗ ЭКСПОРТНОЙ ЛИЦЕНЗИИ — ваш поставщик не сможет оформить легальный инвойс для российской таможни. Таможня РФ может запросить экспортную декларацию Китая для подтверждения стоимости. Рекомендация: привлечь экспортного агента",
    });
  }

  // Risk notes from TN VED codes
  for (const code of codes) {
    if (code.riskNote) {
      risks.push({
        level: "MEDIUM",
        text: `${code.code}: ${code.riskNote}`,
      });
    }
  }

  // Electronics certification
  if (profile.hasElectronics) {
    risks.push({
      level: "MEDIUM",
      text: "Встроенная электроника — потребуется дополнительная сертификация: ТР ТС 004/2011 (НВО) и/или ТР ТС 020/2011 (ЭМС). При наличии Bluetooth/WiFi — нотификация ФСБ",
    });
  }

  return risks;
}

// ─── Generate First Steps ───

function generateFirstSteps(profile: ImportProfile, risks: { level: "HIGH" | "MEDIUM" | "LOW"; text: string }[]): string[] {
  const steps: string[] = [];

  // Step 1: always about data from supplier
  if (profile.worksViaBuyer) {
    steps.push(
      "ЗАВТРА УТРОМ: Перешлите байеру список вопросов из раздела «Вопросы для байера» — потребуйте инвойс, состав материала и packing list. Без этих данных растаможка невозможна"
    );
  } else {
    steps.push(
      "ЗАВТРА УТРОМ: Запросите у фабрики commercial invoice + packing list + точный состав материала (% содержания). Эти данные нужны для таможенной декларации"
    );
  }

  // Step 2: certification
  if (profile.targetAudience === "children") {
    steps.push(
      "СЕРТИФИКАЦИЯ: Найдите аккредитованную лабораторию для ТР ТС 007/2011 (например: Ростест, SGS, Intertek). Запросите образцы у поставщика (3-5 шт) ДО отправки основной партии. Срок сертификации: 2-4 недели, стоимость: 15-30K руб"
    );
  } else {
    steps.push(
      "СЕРТИФИКАЦИЯ: Определите, какая декларация нужна для вашего кода ТН ВЭД. Найдите аккредитованную лабораторию и закажите протокол испытаний"
    );
  }

  // Step 3: depends on risks
  const hasUndervaluation = risks.some((r) => r.text.includes("ЗАНИЖЕНИЕ"));
  const has115fz = risks.some((r) => r.text.includes("115-ФЗ"));

  if (has115fz) {
    steps.push(
      "ЛЕГАЛИЗАЦИЯ ОПЛАТЫ: Переходите на контрактную схему — оформите договор с поставщиком через юрлицо/ИП. Оплата через банк по контракту, а не на карту байера. Рассмотрите услугу «Технический импортёр» — мы поможем оформить белый контракт"
    );
  } else if (hasUndervaluation) {
    steps.push(
      "ЗАЩИТА ОТ КТС: Соберите доказательства реальности цены — скриншоты с Alibaba/1688, прайс-лист фабрики, переписку с поставщиком. Эти документы понадобятся, если таможня запросит корректировку стоимости"
    );
  } else {
    steps.push(
      "ПРОВЕРКА КОНТРАКТА: Убедитесь, что в контракте/инвойсе правильно указан код ТН ВЭД и описание товара совпадает с реальным содержимым. Несоответствие = штраф по КоАП 16.2"
    );
  }

  return steps;
}

// ─── Generate Documents Checklist ───

function generateDocChecklist(profile: ImportProfile): string[] {
  const docs = [
    "Контракт с поставщиком (ВЭД-контракт, на англ/кит + русский перевод)",
    "Commercial invoice (коммерческий инвойс от поставщика)",
    "Packing list (упаковочный лист с весом и габаритами)",
    "Транспортная накладная (от карго-оператора / экспедитора)",
    "Платёжное поручение (подтверждение оплаты поставщику)",
  ];

  if (profile.targetAudience === "children") {
    docs.push("Сертификат соответствия ТР ТС 007/2011 (безопасность детской продукции)");
    docs.push("Протокол испытаний из аккредитованной лаборатории");
  }

  // Add cert types from matched codes
  const certsSeen = new Set<string>();
  for (const code of profile.tnVedCodes) {
    const found = TN_VED_DATABASE.find((c) => c.code === code);
    if (found) {
      for (const cert of found.certTypes) {
        if (!certsSeen.has(cert)) {
          certsSeen.add(cert);
          // Don't duplicate children cert
          if (!cert.includes("007/2011") || profile.targetAudience !== "children") {
            docs.push(cert);
          }
        }
      }
    }
  }

  if (profile.hasLicense) {
    docs.push("Лицензионное соглашение от правообладателя (Disney, Marvel и т.д.)");
  }

  docs.push("Декларация на товары (ДТ) — оформляет таможенный брокер");

  return docs;
}

// ─── Build Full Brief ───

function buildBrief(profile: ImportProfile): ImportBrief {
  const codes = classifyProduct(profile);

  // Assign found codes to profile
  profile.tnVedCodes = codes.map((c) => c.code);

  // Duty breakdown
  const perCodeQty = codes.length > 1 ? Math.floor(profile.quantity / codes.length) : profile.quantity;
  const dutyBreakdown = codes.map((code) => {
    const baseValue = perCodeQty * profile.pricePerUnit;
    const duty = baseValue * (code.dutyRate / 100);
    const vatBase = baseValue + duty + (baseValue * code.excise) / 100;
    const vat = vatBase * (code.vatRate / 100);
    return {
      code: code.code,
      description: code.description,
      duty: Math.round(duty * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round((duty + vat) * 100) / 100,
    };
  });

  const totalPayments = dutyBreakdown.reduce((sum, d) => sum + d.total, 0);

  // Cert requirements
  const certRequirements: string[] = [];
  if (profile.targetAudience === "children") {
    certRequirements.push("СЕРТИФИКАТ соответствия ТР ТС 007/2011 — безопасность продукции для детей (обязательная сертификация, НЕ декларирование)");
    certRequirements.push("Протокол испытаний в аккредитованной лаборатории: фталаты, формальдегид, миграция красителей, механическая безопасность");
    certRequirements.push("Стоимость: ~15,000–30,000 руб за 1 сертификат | Срок: 2-4 недели");
  }
  const certsSeen = new Set<string>();
  for (const code of codes) {
    for (const cert of code.certTypes) {
      if (!certsSeen.has(cert)) {
        certsSeen.add(cert);
        if (!cert.includes("007/2011")) {
          certRequirements.push(cert);
        }
      }
    }
  }

  const risks = generateRisks(profile, codes);
  const buyerQuestions = profile.worksViaBuyer ? generateBuyerQuestions(profile) : [];
  const firstSteps = generateFirstSteps(profile, risks);
  const documentsChecklist = generateDocChecklist(profile);

  return {
    profile,
    codes,
    dutyBreakdown,
    totalPayments: Math.round(totalPayments * 100) / 100,
    certRequirements,
    risks,
    buyerQuestions,
    firstSteps,
    documentsChecklist,
  };
}

// ─── Render Brief ───

function renderBrief(brief: ImportBrief): string {
  const p = brief.profile;
  const lines: string[] = [];

  // Header
  lines.push("");
  lines.push(chalk.cyan("╔═══════════════════════════════════════════════════════╗"));
  lines.push(chalk.cyan("║") + chalk.bold.white(`  IMPORT BRIEF — ${p.product}`.padEnd(53)) + chalk.cyan("║"));
  lines.push(chalk.cyan("╚═══════════════════════════════════════════════════════╝"));

  // Product
  lines.push("");
  lines.push(chalk.bold.white("📦 ТОВАР"));
  lines.push(`  ${p.product} (${p.materials.join(" + ")})`);
  lines.push(`  Аудитория: ${p.targetAudience === "children" ? chalk.red.bold("дети до 14 лет") : p.targetAudience === "adult" ? "14+" : "универсальный"}`);
  lines.push(`  Застёжка: ${p.hasFastener || "нет"} | Электроника: ${p.hasElectronics ? "да" : "нет"} | Лицензия: ${p.hasLicense ? chalk.red("да") : "нет"}`);

  // Batch
  lines.push("");
  lines.push(chalk.bold.white("📊 ПАРТИЯ"));
  lines.push(`  Кол-во: ${p.quantity} шт`);
  lines.push(`  Цена: $${p.pricePerUnit}/шт → $${p.totalValue.toFixed(2)} итого`);
  lines.push(`  Страна: ${p.country} | Логистика: ${p.logistics}`);
  lines.push(`  Поставщик: ${p.worksViaBuyer ? chalk.yellow("через байера") : "напрямую с фабрикой"}`);

  // TN VED codes
  lines.push("");
  lines.push(chalk.bold.white("🏷  КОДЫ ТН ВЭД"));
  for (let i = 0; i < brief.codes.length; i++) {
    const code = brief.codes[i];
    const prefix = i === brief.codes.length - 1 ? "└─" : "├─";
    lines.push(`  ${prefix} ${chalk.magenta(code.code)} — ${code.description}`);
    lines.push(`  ${i === brief.codes.length - 1 ? "  " : "│ "} Пошлина: ${code.dutyRate}% | НДС: ${code.vatRate}% | Акциз: ${code.excise}%`);
    if (code.requiresMarking) {
      lines.push(`  ${i === brief.codes.length - 1 ? "  " : "│ "} ${chalk.yellow("⚠ Маркировка Честный ЗНАК: " + (code.markingCategory || "да"))}`);
    }
  }

  // Duty calculation
  lines.push("");
  lines.push(chalk.bold.white("💰 РАСЧЁТ ТАМОЖЕННЫХ ПЛАТЕЖЕЙ"));
  const perCodeQty = brief.codes.length > 1 ? Math.floor(p.quantity / brief.codes.length) : p.quantity;
  for (const bd of brief.dutyBreakdown) {
    const baseValue = perCodeQty * p.pricePerUnit;
    lines.push(`  ${chalk.magenta(bd.code)}: ${perCodeQty} шт × $${p.pricePerUnit} = $${baseValue.toFixed(2)}`);
    lines.push(`    Пошлина: $${bd.duty.toFixed(2)} | НДС: $${bd.vat.toFixed(2)} | Итого: ${chalk.green("$" + bd.total.toFixed(2))}`);
  }
  lines.push(`  ${"─".repeat(50)}`);
  lines.push(`  ${chalk.bold.green("ВСЕГО таможенных платежей: $" + brief.totalPayments.toFixed(2))}`);

  // Certification
  lines.push("");
  lines.push(chalk.bold.white("📋 СЕРТИФИКАЦИЯ"));
  for (const cert of brief.certRequirements) {
    const icon = cert.includes("СЕРТИФИКАТ") ? chalk.red("⚠️") : "  •";
    lines.push(`  ${icon} ${cert}`);
  }

  // Risks
  if (brief.risks.length > 0) {
    lines.push("");
    lines.push(chalk.bold.white("⚠️  РИСКИ"));
    for (let i = 0; i < brief.risks.length; i++) {
      const risk = brief.risks[i];
      const levelBadge =
        risk.level === "HIGH"
          ? chalk.bgRed.white.bold(` ${risk.level} `)
          : risk.level === "MEDIUM"
            ? chalk.bgYellow.black.bold(` ${risk.level} `)
            : chalk.bgGreen.black.bold(` ${risk.level} `);
      lines.push(`  ${i + 1}. ${levelBadge} ${risk.text}`);
    }
  }

  // RF intermediary: mandatory docs + GTD legal reference
  if (p.worksViaRfIntermediary) {
    lines.push("");
    lines.push(chalk.bold.red("📌 РАБОТА ЧЕРЕЗ ПОСРЕДНИКА В РФ — ОБЯЗАТЕЛЬНЫЕ ДОКУМЕНТЫ"));
    lines.push(chalk.gray("  Потребуйте у посредника эти 3 документа ДО оплаты:"));
    lines.push("");
    lines.push(`  ${chalk.bold("1. ИНВОЙС (Commercial Invoice)")}`);
    lines.push("     Оригинал от китайской фабрики, а не от посредника.");
    lines.push("     Должен содержать: название товара на англ., количество,");
    lines.push("     цену за единицу, общую сумму, реквизиты фабрики.");
    lines.push("     Если посредник отказывается — товар, скорее всего, без таможни.");
    lines.push("");
    lines.push(`  ${chalk.bold("2. УПАКОВОЧНЫЙ ЛИСТ (Packing List)")}`);
    lines.push("     Количество мест, вес нетто/брутто, габариты.");
    lines.push("     Без него невозможно оформить ДТ (декларацию на товары).");
    lines.push("");
    lines.push(`  ${chalk.bold("3. СЕРТИФИКАТ / ТЕСТ-РЕПОРТ КИТАЯ")}`);
    lines.push("     Протокол испытаний от китайской лаборатории (SGS, TUV, CQC).");
    lines.push("     Не заменяет российский сертификат ТР ТС, но нужен для его");
    lines.push("     оформления (ускоряет процесс в 2 раза).");
    lines.push("");
    lines.push(chalk.red.bold("  ⚖️  ЮРИДИЧЕСКАЯ СПРАВКА: ТОРГОВЛЯ НА WB БЕЗ ГТД В 2026"));
    lines.push(chalk.red("  ─".repeat(27)));
    lines.push("  ГТД (грузовая таможенная декларация, она же ДТ) — единственное");
    lines.push("  доказательство легального ввоза товара на территорию РФ.");
    lines.push("");
    lines.push("  " + chalk.bold("Что грозит при отсутствии ГТД:"));
    lines.push(`  ${chalk.red("•")} WB/Ozon: блокировка карточки товара и требование`);
    lines.push("    загрузить разрешительную документацию (с января 2026)");
    lines.push(`  ${chalk.red("•")} КоАП 14.10: продажа товаров без маркировки и`);
    lines.push("    документов — штраф до 200,000 руб + конфискация товара");
    lines.push(`  ${chalk.red("•")} КоАП 16.21: приобретение товаров, незаконно`);
    lines.push("    перемещённых через границу — штраф до стоимости товара");
    lines.push(`  ${chalk.red("•")} КоАП 14.43: нарушение ТР ТС (особенно детские`);
    lines.push("    товары) — штраф до 300,000 руб + конфискация");
    lines.push(`  ${chalk.red("•")} 115-ФЗ: банк вправе заблокировать счёт при`);
    lines.push("    подозрительных переводах физлицам за «товар»");
    lines.push(`  ${chalk.red("•")} УК 171.1: при обороте >2.25 млн руб без`);
    lines.push("    маркировки — уголовное дело (до 3 лет)");
    lines.push("");
    lines.push("  " + chalk.bold("Вывод: без ГТД торговать на маркетплейсе нельзя."));
    lines.push("  Если посредник не даёт ГТД — переходите на белую схему.");
    lines.push(chalk.red("  ─".repeat(27)));
  }

  // Buyer questions (if applicable)
  if (brief.buyerQuestions.length > 0) {
    lines.push("");
    lines.push(chalk.bold.white("📨 ВОПРОСЫ ДЛЯ БАЙЕРА / ПОСРЕДНИКА"));
    lines.push(chalk.gray("  (скопируйте и перешлите своему посреднику)"));
    lines.push(chalk.gray("  ─".repeat(25)));
    for (let i = 0; i < brief.buyerQuestions.length; i++) {
      lines.push(`  ${i + 1}. ${brief.buyerQuestions[i]}`);
    }
    lines.push(chalk.gray("  ─".repeat(25)));
  }

  // First steps
  lines.push("");
  lines.push(chalk.bold.white("🚀 ПЕРВЫЕ ШАГИ (сделайте завтра утром)"));
  for (let i = 0; i < brief.firstSteps.length; i++) {
    lines.push(`  ${chalk.bold.cyan(`${i + 1}.`)} ${brief.firstSteps[i]}`);
  }

  // Tech importer offer (if cargo + buyer + no origin)
  if (p.logistics === "cargo" && p.worksViaBuyer && !p.canConfirmOrigin) {
    lines.push("");
    lines.push(chalk.bold.blueBright("🤝 УСЛУГА «ТЕХНИЧЕСКИЙ ИМПОРТЁР»"));
    lines.push(chalk.blueBright("  Если вы не можете подтвердить происхождение товара —"));
    lines.push(chalk.blueBright("  мы (или наши партнёры) выступим связующим звеном:"));
    lines.push("    • Оформим белый контракт с поставщиком от юрлица");
    lines.push("    • Проведём таможенное оформление (ДТ) под своим именем");
    lines.push("    • Предоставим полный пакет документов для WB/Ozon");
    lines.push("    • Вы получаете «чистый» товар с легальной растаможкой");
    lines.push(chalk.gray("  → Стоимость: от 5% от таможенной стоимости партии"));
    lines.push(chalk.gray("  → Свяжитесь: напишите 'техимпортёр' в чат бота"));
  } else if (p.worksViaBuyer) {
    // Soft upsell even if they claim to have docs
    lines.push("");
    lines.push(chalk.bold.blueBright("💡 СОВЕТ: КОНТРАКТНАЯ СХЕМА"));
    lines.push("  Сейчас вы работаете через байера. Для полной легализации");
    lines.push("  рекомендуем перейти на контрактную схему:");
    lines.push("    • Договор ВЭД между вашим ИП/ООО и фабрикой");
    lines.push("    • Оплата через банк (валютный контроль)");
    lines.push("    • Полный пакет документов для маркетплейса");
    lines.push(chalk.gray("  → Или воспользуйтесь услугой «Технический импортёр»"));
  }

  // 1688/Alibaba agent recommendation
  if ((p.sourcePlatform === "1688" || p.sourcePlatform === "alibaba") && !p.hasExportLicense) {
    lines.push("");
    lines.push(chalk.bold.blueBright("🇨🇳 РЕШЕНИЕ: ЭКСПОРТНЫЙ АГЕНТ В КИТАЕ"));
    lines.push(chalk.blueBright("  У вашего поставщика нет экспортной лицензии."));
    lines.push(chalk.blueBright("  Без неё белая растаможка невозможна. Решение:"));
    lines.push("");
    lines.push("  Экспортный агент (торговая компания) в Китае:");
    lines.push("    1. Выкупает товар у фабрики/продавца от своего юрлица");
    lines.push("    2. Оформляет экспортную декларацию (报关单)");
    lines.push("    3. Выписывает international invoice на ваше ИП/ООО");
    lines.push("    4. Получает возврат НДС в Китае (退税 — до 13%)");
    lines.push("    5. Организует отгрузку через порт/аэропорт");
    lines.push("");
    lines.push(chalk.gray("  Стоимость: 3-7% от суммы заказа (часть компенсируется 退税)"));
    lines.push(chalk.gray("  → Напишите 'агент' в чат — подберём проверенного партнёра"));
  }

  // Documents checklist
  lines.push("");
  lines.push(chalk.bold.white("✅ ЧЕКЛИСТ ДОКУМЕНТОВ"));
  for (const doc of brief.documentsChecklist) {
    lines.push(`  □ ${doc}`);
  }

  // Disclaimer
  lines.push("");
  lines.push(chalk.gray("─".repeat(55)));
  lines.push(chalk.gray("⚖️  Информация носит справочный характер и не является"));
  lines.push(chalk.gray("юридической консультацией. Для окончательного определения"));
  lines.push(chalk.gray("кода ТН ВЭД обратитесь к таможенному брокеру."));
  lines.push(chalk.gray("Confidence < 95% → рекомендуется проверка брокером."));

  return lines.join("\n");
}

// ─── Demo Mode ───

function demoProfile(): ImportProfile {
  return {
    product: "Школьные пеналы",
    materials: ["текстиль", "пластик"],
    targetAudience: "children",
    quantity: 500,
    pricePerUnit: 0.3,
    currency: "USD",
    totalValue: 150,
    country: "Китай",
    logistics: "cargo",
    hasLicense: false,
    hasElectronics: false,
    hasFastener: "молния",
    worksViaBuyer: true,
    worksViaRfIntermediary: true,
    worksDirectWithFactory: false,
    sourcePlatform: "agent",
    hasExportLicense: false,
    canConfirmOrigin: false,
    tnVedCodes: [],
  };
}

// ─── Main ───

async function main() {
  const isDemo = process.argv.includes("--demo");

  let profile: ImportProfile;

  if (isDemo) {
    console.log(chalk.gray("[DEMO] Используем профиль: Школьные пеналы, 500 шт, $0.30, карго, Китай, через байера"));
    profile = demoProfile();
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    profile = await interview(rl);
    rl.close();
  }

  console.log(chalk.gray("\n[PROCESSING] Классификация товара..."));
  const brief = buildBrief(profile);

  if (brief.codes.length === 0) {
    console.log(chalk.red("\n❌ Не удалось подобрать код ТН ВЭД автоматически."));
    console.log(chalk.yellow("Рекомендация: обратитесь к таможенному брокеру для ручной классификации."));
    console.log(chalk.gray(`Поисковые термины: ${profile.product}, ${profile.materials.join(", ")}`));
    process.exit(1);
  }

  console.log(renderBrief(brief));
}

main().catch((err) => {
  console.error(chalk.red("\nFATAL ERROR:"), err.message ?? err);
  process.exit(1);
});
