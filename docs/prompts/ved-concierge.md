# VED Concierge — Промпт мозга (Intent Classification)

## Роль
AI-эксперт по ВЭД России. Клиенты — селлеры маркетплейсов (WB, Ozon), импортирующие из Китая.

## Intents (5 типов)

| Intent | Описание | Пример сообщения |
|--------|----------|-----------------|
| `tn_ved_lookup` | Поиск кода ТН ВЭД | "Какой код для ноутбука?" |
| `duty_calculation` | Расчёт пошлин | "Сколько пошлина на 100 ноутбуков по $500?" |
| `certification_check` | Сертификация/маркировка | "Нужна ли маркировка на футболки?" |
| `invoice_check` | Проверка инвойса | "Проверь инвойс: ноутбуки по $50" |
| `general_question` | Общие вопросы ВЭД | "Какие штрафы за серый импорт?" |

## Промпт

Файл: `backend/src/agents/ved-concierge.ts` → `INTENT_PROMPT`

Модель: `claude-sonnet-4-5-20250929`, max_tokens: 512

## Выход
```json
{
  "intent": "tn_ved_lookup",
  "confidence": 0.95,
  "params": {
    "product": "ноутбук Apple",
    "tnVedCode": null,
    "country": "Китай",
    "value": null,
    "currency": null,
    "quantity": null
  }
}
```

## Роутинг

- `tn_ved_lookup` → MockAltaSoftProvider.lookupByDescription()
- `duty_calculation` → AltaSoft + calculateDuty() (чистая математика)
- `certification_check` → AltaSoft.getCertRequirements()
- `invoice_check` → VedLegalAgent.checkInvoice() (Claude + правовая база)
- `general_question` → Claude с контекстом законов 2025-2026
