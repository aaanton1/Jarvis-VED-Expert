# Handoff Snapshot — Jarvis VED Expert
Дата: 2026-03-08

---

## 1. Текущая архитектура

### Стек
- **Telegram Bot**: Telegraf v4 (long polling)
- **AI**: Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) — классификация товара + определение ТН ВЭД
- **DB**: Supabase (PostgreSQL) — хранение диалоговых сессий и лидов
- **Деплой**: Railway (Docker builder, 1 реплика)
- **Единый файл бота**: `backend/server.ts`

### Пользовательский флоу (state machine)

```
Пользователь пишет товар
        │
        ▼
[classifyProduct] → Claude Haiku → MACHINE | CLOTHING | ELECTRONICS | OTHER
        │
        ▼
[getQuestionsForCategory]
  MACHINE   → 2 вопроса с кнопками (ЧПУ, материал)
  CLOTHING  → 2 вопроса с кнопками (состав ткани, для кого)
  ELECTRONICS/OTHER → 3 текстовых вопроса (QUESTIONS_DEFAULT)
        │
        ▼
Шаги диалога (step_index в dialog_sessions)
  С кнопками → bot.action(/^qa:userId:step:answer$/)
  Текстом    → bot.on(message("text")) при session.stage === "questions"
        │
        ▼
[runFinalCalculation]
  1. classifyHsCode() → Claude Haiku → { hs_code, confidence, reason }
  2. findProduct() — поиск по TN_VED_DATABASE (44 кода)
  3. calculateDuty() — пошлина + НДС
  4. INSERT в leads → получаем lead_id
  5. Вопрос о сроках поставки [urgent | month3 | research]
        │
        ▼
bot.action("urgent" | "month3" | "research") → handleTiming()
  - Ищет последний лид user_id WHERE delivery_timing IS NULL
  - UPDATE leads SET delivery_timing, is_urgent
  - Отправляет полный расчёт + CTA кнопку
        │
        ▼
bot.action(/^quote:\d+$/)
  - UPDATE leads SET status = 'requested_quote'
  - Уведомление администратору (ADMIN_CHAT_ID)
  - Пользователю: "Заявка принята"
```

### Ключевые функции в server.ts

| Функция | Назначение |
|---|---|
| `classifyProduct(query)` | Claude Haiku → MACHINE/CLOTHING/ELECTRONICS/OTHER |
| `getQuestionsForCategory(cat)` | Возвращает статические вопросы для категории |
| `classifyHsCode(query, answers, cat)` | Claude Haiku → { hs_code, confidence, reason } |
| `findProduct(query)` | Keyword-search по TN_VED_DATABASE |
| `generateProfessionalResponse(...)` | Строит 4-секционный ответ (код/налоги/документы/советы) |
| `sendQuestion(ctx, q, step, total, uid)` | Отправляет один вопрос с кнопками или текстом |
| `runFinalCalculation(ctx, session, answers)` | Полный расчёт + сохранение лида |
| `handleTiming(ctx, key)` | Обработка кнопки выбора срока поставки |
| `getSession / saveSession / updateSessionStep / deleteSession` | CRUD для dialog_sessions |

---

## 2. Изменения в server.ts за последние сессии

1. **Улучшен лог сохранения лида** — показывает код ТН ВЭД, lead_id, username
2. **`generateProfessionalResponse()`** — 4-секционный ответ вместо inline-строки
3. **Диалоговый режим (state machine)** — сессии в Supabase, 2-стадийный флоу
4. **CTA-кнопка** — `quote:{leadId}` + уведомление администратору + статус `requested_quote`
5. **Классификация категории** — `classifyProduct()` → ветки MACHINE/CLOTHING/OTHER
6. **Статические вопросы с кнопками** — STATIC_QUESTIONS для MACHINE и CLOTHING
7. **Шаговый диалог** — `sendQuestion()` со счётчиком "Шаг N из total"
8. **`bot.action(/^qa:/)` handler** — обработка inline-кнопок ответов
9. **`classifyHsCode()`** — AI-классификация ТН ВЭД с уровнем уверенности
10. **Timing-шаг** — вопрос о сроках поставки перед финальным расчётом
11. **`handleTiming()`** — поиск лида по `user_id + delivery_timing IS NULL`
12. **Упрощение callback_data** — timing кнопки: `"urgent"/"month3"/"research"` (без leadId)
13. **`answerCbQuery()` первой строкой** — исправлено во всех action-обработчиках
14. **`getSession` error logging** — логирует реальную ошибку Supabase (не молчит)
15. **`bot.use()` debug middleware** — логирует все `MIDDLEWARE CALLBACK: <data>`
16. **`bot.launch({ allowedUpdates, dropPendingUpdates: true })`** — явный список типов + сброс при рестарте
17. **QUESTIONS_DEFAULT** — заменены на короткие деловые формулировки (без Claude)
18. **Удалён `generateClarifyingQuestions()`** — больше не вызывается Claude для вопросов OTHER

---

## 3. Схема БД (Supabase)

### Таблица `dialog_sessions` (активные диалоги)

| Колонка | Тип | Описание |
|---|---|---|
| `user_id` | BIGINT (PK) | Telegram user ID |
| `original_query` | TEXT | Первоначальный запрос пользователя |
| `bot_questions` | TEXT | JSON-строка Question[] |
| `stage` | TEXT | Стадия: `'questions'` |
| `category` | TEXT | MACHINE / CLOTHING / ELECTRONICS / OTHER |
| `step_index` | INTEGER | Текущий шаг (0-based) |
| `collected_answers` | TEXT | JSON-строка string[] |

> ⚠️ Если колонки `stage`, `category`, `step_index`, `collected_answers` не были добавлены — нужно выполнить SQL:
> ```sql
> ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'questions';
> ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS category TEXT;
> ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS step_index INTEGER DEFAULT 0;
> ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS collected_answers TEXT DEFAULT '[]';
> ```

### Таблица `leads` (завершённые расчёты)

| Колонка | Тип | Описание |
|---|---|---|
| `id` | SERIAL (PK) | Auto-increment, используется в callback `quote:{id}` |
| `user_id` | BIGINT | Telegram user ID |
| `username` | TEXT | Telegram username (без @) |
| `product_query` | TEXT | Итоговый запрос (original + answers) |
| `initial_query` | TEXT | Только первоначальный запрос |
| `bot_questions` | TEXT | JSON вопросов |
| `user_answers` | TEXT | Ответы через ` | ` |
| `hs_code` | TEXT | Итоговый код ТН ВЭД |
| `ai_hs_code` | TEXT | Код предложенный Claude |
| `ai_confidence` | TEXT | high / medium / low |
| `category` | TEXT | Классификационная категория |
| `duty_info` | JSONB | { duty_amount, vat_amount, total_payments, currency, qty } |
| `ai_response` | TEXT | Полный сгенерированный ответ (сохраняется, потом показывается) |
| `delivery_timing` | TEXT | urgent / month_3 / research |
| `is_urgent` | BOOLEAN | true если urgent |
| `status` | TEXT | new / requested_quote |

> ⚠️ SQL для недостающих колонок:
> ```sql
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_query TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS bot_questions TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_answers TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_response TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_hs_code TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_confidence TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS category TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_timing TEXT;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;
> ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
> ```

---

## 4. Нерешённые проблемы

### 🔴 Кнопки тайминга не реагируют (главная проблема)
**Симптом**: Нажатие на [В течение месяца] / [1-3 месяца] / [Пока изучаю] — иконка часов, ничего не происходит.
**Диагностика добавлена**: `MIDDLEWARE CALLBACK:` в логах Railway — если строка НЕ появляется, значит Telegram не доставляет callback_query в бот.
**Вероятные причины**:
1. **SQL-миграции не применены** — `delivery_timing` колонки нет → INSERT в leads падает → `leadId = null` → кнопки не показываются (значит пользователь видит кнопки из предыдущего деплоя со старым форматом callback_data)
2. **Старый формат кнопок в чате** — кнопки с callback_data `timing_urgent:123` были созданы до рефакторинга; текущий код их не обрабатывает (ожидает `"urgent"`)
3. **409 Conflict** — два экземпляра бота одновременно, второй забирает часть updates

**Что проверить**:
- Railway → Settings → Replicas = 1
- В логах после нажатия: есть ли `MIDDLEWARE CALLBACK: urgent`?
- Запустить SQL-миграции в Supabase

### 🟡 409 Conflict при деплое
**Симптом**: В логах Railway `Error: 409: Conflict`
**Причина**: Rolling deployment — новый контейнер стартует до остановки старого
**Фикс в коде**: `dropPendingUpdates: true` добавлен
**Оставшееся действие**: В Railway UI → Settings → Replicas → убедиться что 1

### 🟡 Debug middleware в продакшне
`bot.use()` с `console.log("MIDDLEWARE CALLBACK:")` оставлен для диагностики. После решения проблемы с кнопками — удалить или убрать под `if (process.env.NODE_ENV !== 'production')`.

---

## 5. Следующий шаг

**Прямо сейчас:**

1. **Применить SQL-миграции** в Supabase → SQL Editor:
```sql
ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'questions';
ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS step_index INTEGER DEFAULT 0;
ALTER TABLE dialog_sessions ADD COLUMN IF NOT EXISTS collected_answers TEXT DEFAULT '[]';

ALTER TABLE leads ADD COLUMN IF NOT EXISTS initial_query TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS bot_questions TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_answers TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_response TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_hs_code TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_confidence TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_timing TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new';
```

2. **Проверить Railway** → Settings → Replicas = 1

3. **Протестировать заново** весь флоу с новым запросом (старые кнопки в чате со старым callback_data работать не будут — это нормально)

4. **Убедиться** что в логах появляется:
```
MIDDLEWARE CALLBACK: urgent
TIMING ACTION TRIGGERED: urgent user: XXXXXXX
```

5. **После подтверждения работы** — удалить debug `bot.use()` middleware из кода
