# JARVIS — Handoff Document

> Документ для передачи контекста между сессиями.
> Последнее обновление: 2026-02-15 20:00 MSK

---

## Что это за проект

JARVIS — автономная система валидации бизнес-идей через AI-агентов. Вводишь нишу → система ищет тренды через Serper API → анализирует через Claude → находит 5 причин провала → выдаёт вердикт (HIGH/MEDIUM/LOW RISK) с оценкой 0-100.

## Стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | Next.js (App Router, TypeScript) | 16.1.6 |
| UI | Tailwind CSS + lucide-react + framer-motion | 4.x |
| Backend | Express + TypeScript (tsx) | 5.x |
| DB | SQLite через Prisma 7 + adapter-better-sqlite3 | 7.4.0 |
| AI (поиск) | Serper.dev API | — |
| AI (анализ) | Anthropic Claude API (claude-sonnet-4-5) | — |

## Как запустить

```bash
# Backend (порт 3001)
cd backend && npm run dev

# Frontend (порт 3000)
cd frontend && npm run dev

# CLI — запуск исследования без UI
cd backend && npx tsx researcher.ts "ваша ниша"
```

## Структура проекта

```
/
├── .env                          — API ключи (SERPER_API_KEY, ANTHROPIC_API_KEY)
├── .env.example                  — шаблон без ключей
├── .gitignore
├── project_manifest.md           — манифест проекта
├── plan.md                       — текущий план (перезаписывается)
│
├── backend/
│   ├── researcher.ts             — ФАСАД: точка входа + CLI
│   ├── prisma.config.ts          — конфиг Prisma 7 (datasource URL)
│   ├── prisma/schema.prisma      — модель Idea (Draft/Researching/Validated/Rejected)
│   └── src/
│       ├── index.ts              — Express сервер, 4 эндпоинта, SSE
│       ├── providers/
│       │   └── search.ts         — интерфейс SearchProvider + SerperProvider
│       ├── agents/
│       │   ├── trend-scout.ts    — Цикл 1: 3 поисковых запроса → Claude → TrendReport
│       │   └── devil-advocate.ts — Цикл 2: TrendReport → Claude → 5 причин провала
│       ├── engine/
│       │   └── research.ts       — оркестратор Double-Loop, SSE-прогресс
│       └── utils/
│           ├── db.ts             — Prisma client (с adapter-better-sqlite3)
│           ├── parse-json.ts     — извлечение JSON из markdown-обёрток LLM
│           └── report.ts         — сохранение отчётов в /data/research/
│
├── frontend/
│   └── src/app/
│       ├── layout.tsx            — Apple Dark layout, glassmorphism navbar
│       ├── globals.css           — тёмная тема, Inter font
│       ├── page.tsx              — Dashboard: список идей из SQLite
│       ├── research-center/
│       │   └── page.tsx          — UI: ввод ниши, прогресс SSE, карточки результатов
│       └── api/
│           └── research/
│               ├── route.ts      — POST (запуск) + GET (список) — прокси на Express
│               └── [id]/stream/
│                   └── route.ts  — SSE прокси
│
├── data/
│   ├── jarvis.db                 — SQLite база
│   └── research/                 — JSON-отчёты исследований
│
├── docs/
│   ├── features.md               — реестр фич
│   ├── research_log.md           — журнал архитектурных решений
│   ├── analysis_critique.md      — критические отчёты Devil's Advocate
│   ├── handoff.md                — ЭТО ты сейчас читаешь
│   └── prompts/
│       ├── trend-scout.md        — промпт Цикла 1
│       └── devil-advocate.md     — промпт Цикла 2
│
└── logs/
    └── agent_errors.log          — лог ошибок агентов
```

## API эндпоинты (Express :3001)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/research` | Запуск исследования `{ keyword: string }` |
| GET | `/api/research/:id/stream` | SSE-стрим прогресса |
| GET | `/api/research/:id` | Статус/результат идеи |
| GET | `/api/ideas` | Все идеи из SQLite |

Frontend проксирует через свои API Routes (`/api/research/*` → Express).

## Prisma модель

```prisma
model Idea {
  id         String   @id @default(uuid())
  keyword    String
  status     String   @default("Draft")  // Draft | Researching | Validated | Rejected
  score      Float?
  reportPath String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Важно:** Prisma 7 убрал `url` из datasource в schema. URL задаётся в `prisma.config.ts` (для миграций) и через `PrismaBetterSqlite3` adapter (в рантайме в `db.ts`).

## Текущее состояние БД

```
11 записей (все Rejected):
1. Психологи (аудит)         — 15/100
2. Психологи (улучшение)     — 12/100
3. Недвижимость CRM          — 28/100
4. Юридические документы     — 22/100
5. Барбершопы v1             — 22/100
6. Барбершопы v2             — 15/100
7. Спецтехника B2B + Max     — 22/100 (deep-dive-machinery.ts)
8. Премиум стоматология      — 18/100 (deep-dive-dentistry.ts)
9. Загородная недвижимость   — 18/100 (deep-dive-suburban.ts)
10. Инженерные системы ЦОД   — 22/100 (deep-dive-datacenter.ts)
```

## Data Flow (цепочка данных)

```
User вводит нишу
  → Frontend POST /api/research (Next.js proxy)
    → Express :3001 POST /api/research
      → Prisma INSERT Idea (status: Researching)
      → ResearchEngine.run() [async]:
        → Цикл 1: SerperProvider.search() × 3 запроса → Claude → TrendReport
        → Цикл 2: TrendReport → Claude → CriticalReport (5 причин провала)
        → saveReport() → /data/research/[slug].json
        → Prisma UPDATE Idea (score, status: Validated|Rejected)
      → SSE-события на каждом шаге
    ← SSE proxy
  ← EventSource → UI обновляется в реальном времени
```

## Правила разработки (установлены владельцем)

1. **Перед крупным шагом** → создать `plan.md`, описать план, ждать "ОК"
2. **Каждая фича** → зафиксировать в `/docs/features.md`
3. **Ошибки агентов** → записывать в `/logs/agent_errors.log`
4. **Если требования архитектурно неверны** → немедленно критиковать и предлагать лучший вариант
5. **Промпты агентов** → хранить в `/docs/prompts/`
6. **Критические отчёты** → записывать в `/docs/analysis_critique.md`

## Известные нюансы

- **Prisma 7 breaking changes:** Нет `url` в datasource, нужен adapter в PrismaClient, `prisma.config.ts` для миграций
- **Claude иногда оборачивает JSON в markdown:** Решено утилитой `parse-json.ts` — стрипает ` ```json ``` `
- **researcher.ts работает без Express:** При CLI-запуске Idea не создаётся в SQLite автоматически (оркестратор не вызывает Prisma напрямую, это делает Express handler). Если нужно — вставлять вручную
- **SSE через Next.js proxy:** Frontend обращается к `/api/research/[id]/stream` на своём домене, Next.js проксирует на Express

## Что сделано

- [x] Фундамент: структура, манифест, docs
- [x] Backend: Express + TypeScript + модульная архитектура
- [x] Search Provider (Serper API)
- [x] Trend Scout агент (Цикл 1)
- [x] Devil's Advocate агент (Цикл 2)
- [x] Research Engine оркестратор + SSE
- [x] Prisma 7 + SQLite + миграции
- [x] Frontend: Apple Dark layout + glassmorphism
- [x] Research Center: input + прогресс + карточки результатов
- [x] lucide-react иконки + framer-motion анимации
- [x] Next.js API Routes (прокси на Express)
- [x] Dashboard с карточками идей из БД
- [x] Боевое тестирование: "AI chatbot audit for psychologists" → HIGH_RISK 15/100

## Хронология последней сессии (2026-02-15)

1. Создан фундамент: манифест, директории, docs
2. Инициализирован Next.js 16 в /frontend (App Router, TS, Tailwind 4)
3. Создан Apple Dark layout с glassmorphism навбаром
4. Написан plan.md для Module A: Research Engine → получено "ОК"
5. Реализован backend: Express + модульная архитектура (6 модулей)
6. Настроен Prisma 7 + SQLite (с adapter-better-sqlite3)
7. Создан Research Center UI (lucide-react, framer-motion)
8. Аудит: добавлены researcher.ts (фасад), API routes (прокси), analysis_critique.md
9. Боевое тестирование: "AI chatbot audit for psychologists" → **HIGH_RISK 15/100**
10. Исправлен баг: Claude оборачивал JSON в markdown → создан parse-json.ts
11. Результат записан в SQLite, JSON-отчёт, analysis_critique.md
12. Dashboard обновлён: показывает карточки идей из БД
13. Создан handoff.md (этот файл)

## Ключевые открытия (сессия 15 февраля)

### Мессенджер Max (VK) — реальная платформа
- Национальный мессенджер РФ, запущен март 2025
- Предустановлен на все смартфоны с сентября 2025
- 50+ млн пользователей, WhatsApp заблокирован, Telegram замедлён
- Bot API бесплатный до 2027, публикация только через юрлица РФ
- Критически важен для любой ниши в РФ на февраль 2026

### Паттерн провала всех ниш
Devil's Advocate слишком агрессивен — все 8 исследований получили 12-28/100.
Нужна калибровка: сейчас он ищет 5 причин провала и всегда находит,
что математически тянет оценку вниз. Предложено: добавить баланс
(5 причин провала + 5 факторов успеха → взвешенная оценка).

### Сравнительный анализ 3 ниш-кандидатов (прогноз Score > 70)
1. **Премиум стоматология** — ЛИДЕР (прогноз 65-75): 26K клиник, маржа 40-60%, 70% типовых вопросов, простая база ~50 услуг
2. **Загородная недвижимость** — ВТОРОЕ МЕСТО (прогноз 55-65): чек 10-30M, маржа 30-40%, простая фильтрация
3. **Автодилеры** — АУТСАЙДЕР (прогноз 35-45): маржа 6-7% убивает юнит-экономику

## Файлы, созданные в этой сессии

- `backend/deep-dive-machinery.ts` — deep-dive скрипт для спецтехники + Max
- `backend/deep-dive-dentistry.ts` — deep-dive скрипт для стоматологии
- `backend/deep-dive-suburban.ts` — deep-dive скрипт для загородной недвижимости
- `backend/deep-dive-datacenter.ts` — deep-dive скрипт для инженерных систем ЦОД
- `data/research/heavy-machinery.json` — результат исследования (22/100)
- `data/research/dental-prime.json` — результат исследования (18/100)
- `data/research/night/suburban-realestate.json` — результат исследования (18/100)
- `data/research/night/datacenter-engineering.json` — результат исследования (22/100)
- `docs/system_snapshot.md` — снимок проекта для переноса контекста

### Ночной марафон (3 ниши) — Ключевые находки

| Ниша | Оценка DA | Маржа | Средний чек | AI автоматизация | Юнит-экономика |
|------|-----------|-------|-------------|------------------|----------------|
| Стоматология | 18/100 | 40-60% | 60K-450K | 60-75% вопросов | Данные не заполнены (баг) |
| Загородка | 18/100 | 25-35% | 18M | Хорошая | LTV/CAC=17.3 — СХОДИТСЯ |
| ЦОД инженерия | 22/100 | 15-30% | 5-50M | Средняя | LTV/CAC=2.4 — на грани |

**Вывод:** Devil's Advocate сломан — все 11 ниш получили 12-28/100. Проблема №1 — калибровка критика.

## Что НЕ сделано (следующие шаги)

- [ ] **ПРИОРИТЕТ: Калибровка Devil's Advocate** (добавить факторы успеха для баланса)
- [ ] Детальная страница отчёта (клик по карточке → полный отчёт)
- [ ] История исследований на Dashboard с фильтрами
- [ ] Git init + первый коммит
- [ ] Деплой (Vercel для frontend, Railway/Fly для backend)
- [ ] Rate limiting и error retry для API-вызовов
