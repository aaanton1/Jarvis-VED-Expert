# VED Concierge — Database Schema

> Created: 2026-02-18
> DB: SQLite via Prisma 7 + adapter-better-sqlite3
> Path: `/data/jarvis.db`

---

## ER-диаграмма

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│   users     │──1:N──│  calculations    │       │  subscriptions  │
│             │       │                  │       │                 │
│ id (PK)     │       │ id (PK)          │       │ id (PK)         │
│ externalId  │──1:1──│ userId (FK)      │       │ userId (FK)     │──1:1──┐
│ messenger   │       │ tnVedCode        │       │ plan            │       │
│ name        │       │ productName      │       │ status          │       │
│ phone       │       │ quantity         │       │ expiresAt       │       │
│ createdAt   │       │ unitPrice        │       │ createdAt       │       │
│ lastSeenAt  │       │ totalDuty        │       └─────────────────┘       │
│ isReturning │       │ totalVat         │                                 │
└─────────────┘       │ totalCost        │       ┌─────────────────┐       │
                      │ currency         │       │     leads       │       │
                      │ markingRequired  │       │                 │       │
                      │ createdAt        │       │ id (PK)         │       │
                      └──────────────────┘       │ userId (FK)     │───────┘
                                                 │ productCategory │
                                                 │ painLevel       │
                                                 │ dealAmount      │
                                                 │ intent          │
                                                 │ status          │
                                                 │ notes           │
                                                 │ createdAt       │
                                                 └─────────────────┘
```

---

## Таблицы

### 1. `users` — пользователи бота

| Поле | Тип | Описание |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | PK |
| `externalId` | `String @unique` | ID в мессенджере (TG: `chat_id`, Max: `user_id`) |
| `messenger` | `String` | Платформа: `telegram`, `max`, `cli` |
| `name` | `String?` | Имя / username |
| `phone` | `String?` | Телефон (если поделился) |
| `createdAt` | `DateTime @default(now())` | Дата первого контакта |
| `lastSeenAt` | `DateTime @updatedAt` | Дата последней активности |
| `isReturning` | `Boolean @default(false)` | Флаг: возвращающийся клиент |

**Индексы:**
- `@@unique([externalId, messenger])` — один юзер = один аккаунт в одном мессенджере

```prisma
model User {
  id          Int            @id @default(autoincrement())
  externalId  String
  messenger   String         // "telegram" | "max" | "cli"
  name        String?
  phone       String?
  createdAt   DateTime       @default(now())
  lastSeenAt  DateTime       @updatedAt
  isReturning Boolean        @default(false)

  calculations Calculation[]
  subscription Subscription?
  leads        Lead[]

  @@unique([externalId, messenger])
}
```

---

### 2. `calculations` — история расчётов пошлин

| Поле | Тип | Описание |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | PK |
| `userId` | `Int` | FK → users |
| `tnVedCode` | `String` | 10-значный код ТН ВЭД |
| `productName` | `String` | Описание товара (свободный текст) |
| `quantity` | `Int` | Количество единиц |
| `unitPrice` | `Float` | Цена за единицу (USD) |
| `currency` | `String @default("USD")` | Валюта |
| `dutyRate` | `Float` | Ставка пошлины (%) |
| `totalDuty` | `Float` | Итоговая пошлина ($) |
| `totalVat` | `Float` | Итоговый НДС ($) |
| `totalCost` | `Float` | Общая сумма платежей ($) |
| `markingRequired` | `Boolean` | Требуется ли Честный ЗНАК |
| `createdAt` | `DateTime @default(now())` | Дата расчёта |

```prisma
model Calculation {
  id              Int      @id @default(autoincrement())
  userId          Int
  tnVedCode       String
  productName     String
  quantity        Int
  unitPrice       Float
  currency        String   @default("USD")
  dutyRate        Float
  totalDuty       Float
  totalVat        Float
  totalCost       Float
  markingRequired Boolean
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

---

### 3. `subscriptions` — подписки и оплата

| Поле | Тип | Описание |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | PK |
| `userId` | `Int @unique` | FK → users (1:1) |
| `plan` | `String @default("free")` | Тариф: `free`, `basic`, `pro` |
| `status` | `String @default("active")` | Статус: `active`, `expired`, `cancelled` |
| `calculationsUsed` | `Int @default(0)` | Счётчик расчётов в текущем периоде |
| `calculationsLimit` | `Int @default(3)` | Лимит расчётов (free=3, basic=30, pro=∞) |
| `paidAt` | `DateTime?` | Дата оплаты |
| `expiresAt` | `DateTime?` | Дата истечения подписки |
| `createdAt` | `DateTime @default(now())` | Дата создания |

```prisma
model Subscription {
  id                Int       @id @default(autoincrement())
  userId            Int       @unique
  plan              String    @default("free")   // "free" | "basic" | "pro"
  status            String    @default("active") // "active" | "expired" | "cancelled"
  calculationsUsed  Int       @default(0)
  calculationsLimit Int       @default(3)
  paidAt            DateTime?
  expiresAt         DateTime?
  createdAt         DateTime  @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

**Тарифная сетка:**

| Тариф | Лимит расчётов | Цена | Фишки |
|---|---|---|---|
| `free` | 3/мес | 0 ₽ | Базовый расчёт, 1 код |
| `basic` | 30/мес | 990 ₽/мес | Полный расчёт + Честный ЗНАК схема |
| `pro` | ∞ | 4 990 ₽/мес | Всё + приоритетная поддержка + API |

---

### 4. `leads` — лиды (потенциальные сделки)

| Поле | Тип | Описание |
|---|---|---|
| `id` | `Int @id @default(autoincrement())` | PK |
| `userId` | `Int` | FK → users |
| `productCategory` | `String` | Категория товара: `fashion`, `electronics`, `cosmetics`... |
| `painLevel` | `Int` | Уровень боли 1-5 (5 = «горит, нужен брокер вчера») |
| `dealAmount` | `Float?` | Потенциальная сумма сделки (USD) |
| `intent` | `String` | Последний интент: `duty_calculation`, `certification_check`... |
| `status` | `String @default("new")` | Статус: `new`, `warm`, `hot`, `converted`, `lost` |
| `notes` | `String?` | Заметки (автоматические + ручные) |
| `createdAt` | `DateTime @default(now())` | Дата создания лида |

```prisma
model Lead {
  id              Int      @id @default(autoincrement())
  userId          Int
  productCategory String   // "fashion" | "electronics" | "cosmetics" ...
  painLevel       Int      // 1-5
  dealAmount      Float?
  intent          String   // last VED intent
  status          String   @default("new") // "new" | "warm" | "hot" | "converted" | "lost"
  notes           String?
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
}
```

**Автоматическая квалификация лида:**

| Сигнал | painLevel | status |
|---|---|---|
| Просто спросил код | 1 | `new` |
| Посчитал пошлину | 2 | `warm` |
| Спросил про Честный ЗНАК | 3 | `warm` |
| Спросил про сертификацию + маркировку | 4 | `hot` |
| Попросил контакт брокера / готов платить | 5 | `hot` |

---

## Логика распознавания «старого» клиента

### Алгоритм

```
Входящее сообщение
    │
    ▼
Извлечь externalId + messenger из контекста
    │
    ▼
SELECT * FROM users
WHERE externalId = ? AND messenger = ?
    │
    ├── НЕ НАЙДЕН ──► Создать нового user
    │                  isReturning = false
    │                  Создать subscription (plan: "free", limit: 3)
    │                  Создать lead (painLevel: 1, status: "new")
    │                  ──► Приветствие + Hook
    │
    └── НАЙДЕН ──► Обновить lastSeenAt
                   isReturning = true
                   │
                   ▼
                   Загрузить историю:
                   ├── calculations (ORDER BY createdAt DESC LIMIT 5)
                   ├── subscription (проверить лимит)
                   └── leads (последний статус)
                   │
                   ▼
                   Персонализированный ответ:
                   «Рад снова видеть! Последний раз считали
                    худи 6110209100 — хочешь обновить расчёт?»
```

### Реализация в коде

```typescript
async function resolveUser(externalId: string, messenger: string): Promise<User> {
  let user = await prisma.user.findUnique({
    where: { externalId_messenger: { externalId, messenger } },
    include: {
      calculations: { orderBy: { createdAt: "desc" }, take: 5 },
      subscription: true,
      leads: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        externalId,
        messenger,
        subscription: { create: { plan: "free", calculationsLimit: 3 } },
      },
      include: { calculations: true, subscription: true, leads: true },
    });
    return user; // new user → show Hook greeting
  }

  // returning user
  await prisma.user.update({
    where: { id: user.id },
    data: { isReturning: true },
  });

  return user;
}
```

### Проверка лимита перед расчётом

```typescript
async function canCalculate(userId: number): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub) return false;
  if (sub.plan === "pro") return true;
  if (sub.status === "expired") return false;
  return sub.calculationsUsed < sub.calculationsLimit;
}
```

### Вызов истории расчётов

```typescript
async function getHistory(userId: number): Promise<string> {
  const calcs = await prisma.calculation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (calcs.length === 0) return "У вас пока нет расчётов.";

  return calcs.map((c, i) =>
    `${i + 1}. ${c.productName} (${c.tnVedCode}) — ${c.quantity} шт × $${c.unitPrice} → пошлина $${c.totalCost}`
  ).join("\n");
}
```

---

## Миграция

```bash
# Генерация миграции
npx prisma migrate dev --name add_users_calculations_subscriptions_leads

# Применение на проде
npx prisma migrate deploy
```

---

## Метрики для дашборда (будущее)

| Метрика | SQL |
|---|---|
| Всего пользователей | `SELECT COUNT(*) FROM users` |
| Возвращающиеся | `SELECT COUNT(*) FROM users WHERE isReturning = true` |
| Расчётов сегодня | `SELECT COUNT(*) FROM calculations WHERE date(createdAt) = date('now')` |
| Hot leads | `SELECT COUNT(*) FROM leads WHERE status = 'hot'` |
| Конверсия free→basic | `SELECT COUNT(*) FROM subscriptions WHERE plan = 'basic'` |
| Средний чек лида | `SELECT AVG(dealAmount) FROM leads WHERE dealAmount > 0` |
| Топ категории | `SELECT productCategory, COUNT(*) FROM leads GROUP BY 1 ORDER BY 2 DESC` |
