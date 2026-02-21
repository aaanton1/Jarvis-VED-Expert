# JARVIS — System Snapshot

> Контекстный файл для переноса в новую AI-сессию.
> Дай этот файл любому AI — он сразу поймёт, на чём мы остановились.
> Последнее обновление: 2026-02-15

---

## 1. Что такое JARVIS

Автономная система валидации бизнес-идей через AI-агентов. Пользователь вводит нишу → система ищет тренды через Serper API → анализирует через Claude (sonnet-4-5) → находит 5 причин провала → выдаёт вердикт (HIGH / MEDIUM / LOW RISK) с оценкой 0–100.

---

## 2. Архитектура

```
┌─────────────────────┐     proxy      ┌──────────────────────┐
│  Frontend (Next.js)  │ ──────────── → │  Backend (Express)    │
│  порт 3000           │  API Routes    │  порт 3001            │
│  App Router, TS      │                │  TypeScript (tsx)      │
│  Tailwind 4          │                │                        │
│  lucide + framer     │                │  ┌──────────────────┐ │
└─────────────────────┘                │  │ Serper API        │ │
                                        │  │ (поиск трендов)   │ │
                                        │  └──────────────────┘ │
                                        │  ┌──────────────────┐ │
                                        │  │ Claude API        │ │
                                        │  │ (анализ + критика)│ │
                                        │  └──────────────────┘ │
                                        │  ┌──────────────────┐ │
                                        │  │ SQLite (Prisma 7) │ │
                                        │  │ /data/jarvis.db   │ │
                                        │  └──────────────────┘ │
                                        └──────────────────────┘
```

**Стек:**
- Frontend: Next.js 16 (App Router, TypeScript, Tailwind 4, lucide-react, framer-motion)
- Backend: Express + TypeScript, запуск через `tsx`
- DB: SQLite через Prisma 7 + adapter-better-sqlite3
- AI поиск: Serper.dev API (обёртка над Google Search)
- AI анализ: Anthropic Claude API (claude-sonnet-4-5)

**Data flow:**
1. Пользователь вводит нишу в Research Center (localhost:3000)
2. Frontend POST → Next.js API Route → Express :3001
3. Prisma создаёт запись Idea (status: Researching)
4. **Цикл 1 (Trend Scout):** 3 поисковых запроса через Serper → Claude → TrendReport
5. **Цикл 2 (Devil's Advocate):** TrendReport → Claude → 5 причин провала + оценка 0–100
6. Результат сохраняется в SQLite + JSON-файл в `/data/research/`
7. SSE-стрим обновляет UI в реальном времени

---

## 3. Результаты исследований — НИША ПСИХОЛОГОВ ПРОВАЛЕНА

Проверена ниша: **"Micro-SaaS for AI chatbot audit for psychologists"**

| Запуск | Тип | Score | Вердикт |
|--------|-----|-------|---------|
| Стандартный (3 запроса) | Research Center UI | **15/100** | HIGH_RISK |
| Deep Dive (7 запросов) | CLI deep-dive.ts | **12/100** | HIGH_RISK |

**Топ-5 причин провала:**
1. **Регуляторная катастрофа** — HIPAA, FDA. Штрафы от $50K за инцидент. Аудит нерегулируемых мед. девайсов превращает тебя в регулируемый девайс.
2. **Невозможная экономика** — CAC $5–15K при подписке $50–200/мес. Цикл продаж 18–24 месяца в healthcare. Рынок ~5,000–10,000 практиков.
3. **Этический парадокс** — Психологи против AI-ботов. Покупка инструмента аудита = легитимизация того, против чего они выступают. "Продаёшь фильтры для сигарет пульмонологам."
4. **Нет доступа к данным** — Replika, ChatGPT не дадут API конкуренту, анализирующему их "манипуляции". Copy-paste убивает UX.
5. **$2M+ R&D** — Нужны NLP-эксперты, клинические психологи, HIPAA-инженеры. Это venture-scale проблема при micro-SaaS бюджете.

**Вывод: ниша закрыта навсегда. Не возвращаемся.**

Подробные отчёты: `/docs/analysis_critique.md`, JSON в `/data/research/`

---

## 4. Локализация — ПЕРЕХОД НА РУССКИЙ

Интерфейс **полностью переведён на русский:**
- Navbar: «Главная» / «Исследования»
- Статусы: Черновик / Исследуется / Одобрено / Отклонено
- Вердикты: Высокий риск / Средний риск / Низкий риск
- Все кнопки, заголовки, подписи — русский
- Промпты агентов (TrendScout, DevilAdvocate) — на русском, ответы тоже на русском

---

## 5. Технические нюансы (КРИТИЧНО)

### Конфликт портов — ЧАСТАЯ ПРОБЛЕМА
- **Frontend:** порт **3000** (Next.js) — то, что открывает пользователь
- **Backend:** порт **3001** (Express) — JSON API, SSE
- **Оба сервера нужны одновременно** (два терминала)
- macOS: порт 5000 занят AirPlay Receiver — не использовать
- Если порт 3000 занят, Next.js автоматически прыгнет на 3001 → **конфликт с Express**. Убедись, что порт 3000 свободен.

### API-ключи — НУЖЕН EXPORT
Ключи в `/.env`, но процесс иногда не подхватывает. **Гарантированный способ:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export SERPER_API_KEY="..."
```
Выполни это в терминале **перед** `npm run dev`.

### Prisma 7 breaking changes
- В `schema.prisma` **НЕТ** поля `url` в datasource — это ломающее изменение Prisma 7
- URL задаётся в `backend/prisma.config.ts` (для миграций) и через `PrismaBetterSqlite3` adapter (в рантайме в `db.ts`)
- Adapter: `adapter-better-sqlite3`

### Claude JSON parsing
Claude иногда оборачивает JSON в ` ```json ``` `. Утилита `parse-json.ts` стрипает markdown-обёртки. Уже работает, не трогай.

---

## 6. Что реализовано (11 фич)

- [x] Apple Dark layout + glassmorphism
- [x] Research Engine: Double-Loop (TrendScout → DevilAdvocate)
- [x] Research Center UI (SSE прогресс + карточки)
- [x] Dashboard с кликабельными карточками из БД
- [x] Детальная страница /research/[id] (вердикт, обзор рынка, боли, 5 факторов)
- [x] Deep Dive скрипт (7 запросов, расширенный анализ)
- [x] Кнопка «Развернуть детали» с framer-motion анимацией
- [x] Авто-запись в analysis_critique.md после deep-dive
- [x] Полная русификация интерфейса
- [x] API: полный JSON-отчёт по ID идеи
- [x] Промпты агентов переведены на русский

Полный реестр: `/docs/features.md`

---

## 7. Структура ключевых файлов

```
backend/
  researcher.ts             — CLI: стандартное исследование (3 запроса)
  deep-dive.ts              — CLI: deep dive (7 запросов)
  prisma.config.ts          — конфиг Prisma 7 (datasource URL)
  prisma/schema.prisma      — модель Idea (Draft/Researching/Validated/Rejected)
  src/
    index.ts                — Express: 4 эндпоинта + SSE + чтение JSON-отчёта
    agents/trend-scout.ts   — Цикл 1: Serper → Claude → TrendReport
    agents/devil-advocate.ts — Цикл 2: TrendReport → Claude → 5 причин провала
    engine/research.ts      — оркестратор Double-Loop, SSE-прогресс
    utils/db.ts             — Prisma client (adapter-better-sqlite3)
    utils/parse-json.ts     — стрипает markdown-обёртки из JSON Claude
    utils/report.ts         — сохранение отчётов в /data/research/

frontend/src/app/
  layout.tsx                — Apple Dark layout, glassmorphism навбар
  page.tsx                  — Dashboard: кликабельные карточки идей
  research-center/page.tsx  — Ввод ниши, SSE-прогресс, результаты
  research/[id]/page.tsx    — Детальный отчёт по идее
  api/research/             — Next.js API Routes (прокси на Express)
```

---

## 8. Следующий шаг

**Цель: найти жизнеспособную нишу (score > 50).**

Направления для исследования:
1. **B2B продажи** — SaaS-инструменты для автоматизации отделов продаж, лидогенерация, CRM
2. **Недвижимость** — AI-инструменты для агентов, оценка, поиск, автоматизация

Как запустить:
```bash
# Стандартное исследование (через UI)
# 1. Запусти оба сервера, открой localhost:3000 → «Исследования»

# Стандартное исследование (CLI)
cd backend && npx tsx researcher.ts "ваша ниша"

# Deep Dive (CLI)
cd backend && npx tsx deep-dive.ts   # ниша задаётся внутри скрипта
```

---

## 9. Правила работы

1. **Перед крупным шагом** → создай `plan.md`, опиши план, жди "ОК"
2. **Каждая фича** → зафиксируй в `/docs/features.md`
3. **Ошибки агентов** → пиши в `/logs/agent_errors.log`
4. **Архитектурно неверные требования** → критикуй, предлагай лучше
5. **UI стиль** → Apple Dark, glassmorphism, минимализм
6. **Язык** → общение на русском, код на английском

---

## 10. Ссылки на документацию

| Документ | Путь | Описание |
|----------|------|----------|
| Handoff | `/docs/handoff.md` | Полная техническая документация |
| Features | `/docs/features.md` | Реестр фич (11 позиций) |
| Critique | `/docs/analysis_critique.md` | Журнал критических отчётов |
| Prompts | `/docs/prompts/` | Промпты агентов |
| Errors | `/logs/agent_errors.log` | Лог ошибок |
