# Plan: Боевой Промт №3 — Глубокое погружение в нишу

**Ниша:** Микро-SaaS для аудита и улучшения ИИ-ботов для психологов

---

## Этап 1: Сбор данных (Data Mining)

**Что делаем:** Расширенный поиск через Serper API — не 3 стандартных запроса, а 6 целевых:

1. `AI chatbot builders for therapists psychologists 2025` — найти 5 конструкторов ботов
2. `chatbot platforms marketing mental health professionals` — конструкторы с фокусом на маркетинг
3. `psychologists AI chatbot complaints problems reddit` — жалобы на Reddit
4. `therapists chatbot issues ethics quora forum` — жалобы на Quora/форумах
5. `AI chatbot mental health conversion booking appointment` — проблема конверсии
6. `chatbot ethics therapy HIPAA compliance issues` — этические и правовые проблемы

**Как:** Вызываем Serper API напрямую через `SerperProvider.search()` из backend, собираем raw-результаты. Затем отправляем в Claude (через расширенный промпт TrendScout) для структурирования.

**Выход:** Расширенный TrendReport с:
- 5 конкретных конструкторов ботов для психологов
- Жалобы из соцсетей (конкретные цитаты)
- Главная техническая проблема (гипотеза)

---

## Этап 2: Фильтрация (The Critique)

**Что делаем:** Запускаем Devil's Advocate с расширенным контекстом + отдельно проверяем гипотезу.

**Гипотеза для проверки:** "Нужен ли психологам аудит бота или им проще нанять человека?"

**Как:**
1. Стандартный Devil's Advocate → 5 причин провала + score + verdict
2. Дополнительный Serper-запрос: `hire human vs AI chatbot audit cost therapist`
3. Финальный анализ Claude: сравнение стоимости аудита SaaS vs наём человека

**Выход:** Записываем развёрнутый критический отчёт в `/docs/analysis_critique.md`

---

## Этап 3: Сохранение (Database)

**Что делаем:**
1. Создаём новую запись `Idea` в SQLite через Prisma:
   - keyword: "Deep Dive: Micro-SaaS for AI chatbot audit for psychologists"
   - status: "Researching" → обновим до Validated/Rejected после анализа
   - score: рассчитывается на основе данных
2. Сохраняем полный JSON-отчёт в `/data/research/`

---

## Этап 4: Визуализация (Frontend)

**Что обновляем в `research-center/page.tsx`:**
1. Добавляем кнопку **"Развернуть детали"** на каждую карточку результата
2. По клику раскрывается панель с:
   - Полный список pain points с severity-бегунками
   - Death reasons с описанием и evidence
   - Market overview
3. Используем framer-motion `AnimatePresence` для плавного раскрытия

**Dashboard (`page.tsx`):**
- Новая карточка появится автоматически (уже fetches из `/api/ideas`)

---

## Порядок выполнения

1. **UI сначала** — доработка кнопки "Развернуть детали" в research-center
2. **Запуск research** — через Express API (POST /api/research)
3. **Запись critique** — в /docs/analysis_critique.md
4. **Верификация** — проверяем карточку на Dashboard

---

## Архитектурное замечание

Предыдущее исследование этой ниши дало 15/100 (HIGH_RISK). Промт №3 — это **глубокое погружение** с расширенным набором запросов. Мы НЕ переиспользуем старые данные, а собираем свежие с новыми углами атаки (конструкторы ботов, жалобы, этика, конверсия).
