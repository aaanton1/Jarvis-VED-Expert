# VED Concierge MVP — Project State

> Last updated: 2026-02-18 (end of day)
> Entry point: `scripts/ved_brain.ts`
> Import Navigator: `scripts/import_navigator.ts`
> Bot profile: `config/bot_profile.json`
> 7-day plan: `docs/ved-mvp-plan.md`

---

## Status: Day 3 COMPLETE

### What Works

| Feature | Status | Details |
|---------|--------|---------|
| Intent classification (5 intents) | OK | tn_ved_lookup, duty_calculation, certification_check, invoice_check, general_question |
| TN VED code lookup (fuzzy search) | OK | 43 codes in knowledge base, keyword scoring |
| Fast-path code detection | OK | 10-digit code in input → instant lookup, no Claude API call |
| Duty calculator | OK | Pure math, no LLM. Fixed double-multiply bug (value = per-unit now) |
| Invoice check (legal module) | OK | Claude analysis + hardcoded legal triggers |
| Confidence score | OK | <95% → "broker review required" |
| Disclaimer | OK | Auto-appended to every legal/general response |
| Hardcoded legal articles | OK | UK 194, UK 226.1, KoAP 16.2, 16.3, PP 313 — guaranteed on matching flags |
| Plan B (RF suppliers) | OK | HIGH_RISK + China → suggest domestic sourcing |
| Marking check (Honest ZNAK) | OK | Auto-warning in duty_calculation if category requires marking |
| Colored CLI output (chalk@4) | OK | HIGH_RISK red, SUSPICIOUS yellow, CLEAN green, severity color-coded |
| CLI interactive mode | OK | readline prompt, exit/quit/vykhod |
| Single-query mode | OK | `npx tsx scripts/ved_brain.ts "query"` |
| Telegram adapter (skeleton) | OK | Dynamic import telegraf, graceful fallback |
| Max adapter (skeleton) | OK | Dynamic import @maxhub/max-bot-api, graceful fallback |
| **Import Navigator** | **NEW** | Interview → classify → Import Brief (no Claude API) |
| **Buyer questions generator** | **NEW** | Auto-generates questions to forward to buyer/agent |
| **115-FZ risk detection** | **NEW** | Cargo + buyer + no origin docs → bank block warning |
| **Tech Importer upsell** | **NEW** | White contract service offer when origin unconfirmed |
| **First Steps generator** | **NEW** | 3 concrete actions for seller's next morning |
| **RF intermediary branch** | **NEW** | 3 mandatory docs from intermediary + GTD legal reference |
| **GTD legal справка** | **NEW** | КоАП 14.10, 16.21, 14.43, 115-ФЗ, УК 171.1 — consequences of no ГТД |

### Knowledge Base Stats

- **44 TN VED codes** across 16 categories (+1 Fashion Expert Mode)
- **25 FTS price thresholds** (minimum per-unit prices)
- **14 Honest ZNAK marking categories**
- Categories: Electronics (16), **Clothing (5)**, Shoes (2), Cosmetics (3), Food (3), Toys (1), Auto (2), Home (3), Bags (2), Sports (1), Photo (1), Furniture (1), Jewelry (1), Kids (1), Stationery/School (2)

---

## Architecture

```
scripts/ved_brain.ts              ← Entry point (CLI + TG + Max)
  ↓
backend/src/engine/ved-engine.ts  ← Orchestrator
  ↓
backend/src/agents/ved-concierge.ts  ← Brain (intent + routing)
  ↓ routes to:
  ├── AltaSoft (mock)              ← TN VED lookup
  ├── ved-legal.ts                 ← Invoice analysis (Claude + hardcoded triggers)
  ├── ved-customs.ts               ← Duty calculator (pure math)
  └── Claude (general FAQ)         ← General questions

scripts/import_navigator.ts       ← Import Navigator (standalone CLI)
  ├── interview()                  ← 7-question seller interview
  ├── classifyProduct()            ← Fuzzy match TN VED codes by keywords + material
  ├── generateBuyerQuestions()     ← Questions to forward to buyer/agent
  ├── generateRisks()              ← FTS thresholds, 115-FZ, children cert, license
  ├── generateFirstSteps()         ← 3 concrete morning actions
  ├── buildBrief()                 ← Compile full Import Brief
  └── renderBrief()                ← Colorized CLI output
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/types/ved.ts` | Domain types: VedIntent, TnVedCode, DutyCalculation, InvoiceCheckResult, **ImportProfile, ImportBrief** |
| `backend/src/types/messenger.ts` | Channel types: UnifiedMessage, MessengerAdapter |
| `backend/src/utils/ved-knowledge.ts` | **44** TN VED codes + FTS thresholds + marking categories |
| **`docs/fashion-import-brief.md`** | **Fashion Import Brief — худи через байера + Честный ЗНАК** |
| **`docs/database_structure.md`** | **DB Schema: users, calculations, subscriptions, leads + resolveUser logic** |
| `backend/src/providers/alta-soft.ts` | Mock AltaSoft: fuzzy keyword search, lookupByCode |
| `backend/src/agents/ved-concierge.ts` | Brain: intent classification + routing + fast-path |
| `backend/src/agents/ved-legal.ts` | Legal: invoice analysis + confidence + disclaimer + hardcoded triggers |
| `backend/src/agents/ved-customs.ts` | Duty: pure math calculator (dutyRate + VAT + excise) |
| `backend/src/engine/ved-engine.ts` | Orchestrator: adapter → brain → response |
| `backend/src/providers/messenger-telegram.ts` | Telegram adapter (telegraf, skeleton) |
| `backend/src/providers/messenger-max.ts` | Max adapter (@maxhub/max-bot-api, skeleton) |
| `scripts/ved_brain.ts` | Entry point: CLI + colored output + single-query mode |
| **`scripts/import_navigator.ts`** | **Import Navigator: interview → classify → brief → risks → buyer questions → first steps** |
| `docs/prompts/ved-concierge.md` | Intent classification prompt docs |
| `docs/prompts/ved-legal.md` | Legal module prompt docs |
| `docs/ved-mvp-plan.md` | 7-day plan |
| **`config/bot_profile.json`** | **Bot personality, commands (/start, /code, /navigator, /help), monetization plans** |

---

## Known Bugs

### BUG-001: 10-digit code parsing in interactive CLI
- **Severity:** Low
- **Description:** In interactive readline mode, if user types a bare 10-digit code, the fast-path detection works. But if the code is embedded in a complex sentence with other numbers, regex `\b(\d{10})\b` may false-match phone numbers or other 10-digit sequences.
- **Workaround:** Works correctly for standard inputs. Edge case with phone numbers not yet handled.
- **Fix plan:** Add validation that matched code starts with valid TN VED section prefixes (01-97).

### BUG-002: Shell $ sign in single-query mode
- **Severity:** Low
- **Description:** `npx tsx scripts/ved_brain.ts "100 футболок по $3"` — shell interprets `$3` as variable. Use single quotes or escape: `'100 футболок по $3'`.
- **Workaround:** Use single quotes in shell, or spell out "3 доллара".

---

## Day 1 Deliverables (DONE 2026-02-16)
- [x] Types, knowledge base, mock AltaSoft
- [x] Brain (intent classification + routing)
- [x] Legal module, duty calculator
- [x] Messenger adapters (skeleton)
- [x] Orchestrator + entry point
- [x] Prompts documented
- [x] 7-day plan written

## Day 2 Deliverables (DONE 2026-02-17)
- [x] Disclaimer on every response
- [x] Confidence score + broker referral (<95%)
- [x] Fixed duty_calculation double-multiply bug
- [x] Marking check in duty_calculation
- [x] Plan B (RF suppliers) on HIGH_RISK + China
- [x] Hardcoded legal triggers (UK 194, 226.1, KoAP 16.2, 16.3)
- [x] Expanded KB: 30 → 41 codes (+11 electronics)
- [x] Fast-path: 10-digit code → instant lookup
- [x] Colored CLI (chalk@4)

## Day 3 Deliverables (2026-02-18)
- [x] Import Navigator module (`scripts/import_navigator.ts`)
- [x] 7-question seller interview (product, material, audience, qty, price, country, logistics, license, electronics, fastener, buyer workflow)
- [x] Auto TN VED classification (fuzzy keyword + material match)
- [x] Duty calculation per code (split by material)
- [x] Buyer questions generator (7 questions for children's products)
- [x] 115-FZ risk detection (cargo + buyer + no origin → bank block warning)
- [x] Tech Importer upsell (white contract service)
- [x] First Steps generator (3 morning actions)
- [x] Full Import Brief with colorized CLI output
- [x] Demo mode: `npx tsx scripts/import_navigator.ts --demo`
- [x] KB expanded: 41 → 43 codes (+2 stationery/pencil cases)
- [x] FTS thresholds: 22 → 24 (+2 pencil case thresholds)
- [x] Types: ImportProfile + ImportBrief in ved.ts
- [x] Installed @types/node for IDE type checking
- [x] RF intermediary dialogue branch (3 mandatory docs from intermediary)
- [x] GTD legal справка (КоАП 14.10, 16.21, 14.43, 115-ФЗ, УК 171.1)
- [x] worksViaRfIntermediary field in ImportProfile type
- [x] Bot profile config (`config/bot_profile.json`) — personality, commands, monetization

## Day 3 Late Addition (2026-02-18 evening)
- [x] Fashion Expert Mode: interview flow (5 questions → TN VED classification)
- [x] Added code 6110209100 (худи мужские хлопок) to knowledge base
- [x] FTS threshold: $4/шт for 6110209100
- [x] Fashion Import Brief: `docs/fashion-import-brief.md`
- [x] Честный ЗНАК through buyer: 7-step scheme documented
- [x] Hook for bot greeting: «Везёшь худи из Китая? Я за 5 минут определю код...»
- [x] KB: 43 → 44 codes, FTS: 24 → 25 thresholds
- [x] Database schema: `docs/database_structure.md` (users, calculations, subscriptions, leads)
- [x] User recognition logic: externalId + messenger → returning user → history recall
- [x] Subscription tiers: free (3/мес), basic (30/мес, 990₽), pro (∞, 4990₽)
- [x] Lead scoring: painLevel 1-5, auto-qualification by intent depth

## Day 4 TODO (Messenger Max + Telegram live)
- [ ] Register bot in Max Developer Portal
- [ ] Get MAX_BOT_TOKEN, add to .env
- [ ] Install: `npm install @maxhub/max-bot-api`
- [ ] Implement /start, /code, /navigator, /help commands from bot_profile.json
- [ ] Test all 5 intents in Max
- [ ] Register Telegram bot via @BotFather
- [ ] Get TELEGRAM_BOT_TOKEN, add to .env
- [ ] Install telegraf: `npm install telegraf`
- [ ] Test all 5 intents in Telegram

---

## Test Commands

```bash
# ─── VED Brain (existing) ───

# Fast-path code lookup (no API call)
npx tsx scripts/ved_brain.ts "8473302000"

# Duty calculation with marking
npx tsx scripts/ved_brain.ts 'Рассчитай пошлину на 200 пар кроссовок по 15 евро'

# Invoice check HIGH_RISK + Plan B
npx tsx scripts/ved_brain.ts "Инвойс на 500 видеокарт RTX 4090 по 200 долларов из Гуанчжоу"

# New electronics codes
npx tsx scripts/ved_brain.ts "Какой код для умных часов Apple Watch?"

# General question
npx tsx scripts/ved_brain.ts "Штрафы за серый импорт в 2026"

# Interactive CLI
npx tsx scripts/ved_brain.ts

# ─── Import Navigator (new) ───

# Demo mode (школьные пеналы, no input needed)
npx tsx scripts/import_navigator.ts --demo

# Interactive interview
npx tsx scripts/import_navigator.ts
```

## Dependencies

```
chalk@4            — colored CLI output
dotenv             — env vars from .env
@anthropic-ai/sdk  — Claude API
@types/node        — Node.js type definitions (devDep)
telegraf           — Telegram (not yet installed)
@maxhub/max-bot-api — Max (not yet installed)
```
