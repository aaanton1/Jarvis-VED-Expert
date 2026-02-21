import {
  Channel,
  UnifiedMessage,
  OutboundMessage,
  MessengerAdapter,
} from "../types/messenger";

/**
 * Max Messenger Adapter — Day 4 implementation.
 *
 * Handles commands: /start, /code, /navigator, /help
 * Использует @maxhub/max-bot-api (установить: npm install @maxhub/max-bot-api).
 * В MVP: polling mode. В продакшене: webhook.
 *
 * Для работы нужен MAX_BOT_TOKEN в .env.
 */

type MessageHandler = (msg: UnifiedMessage) => Promise<void>;

// ─── Bot command responses ───

const WELCOME_MESSAGE = `Привет! Я Jarvis VED — твой консьерж в мире белого импорта 🇨🇳→🇷🇺

Везёшь худи из Китая? Я за 5 минут определю код, посчитаю пошлину и покажу, как получить Честный ЗНАК — без брокера и без выезда из дома.

Что я умею:
• /code — подобрать код ТН ВЭД для товара
• /navigator — полное интервью + Import Brief
• /help — справка по всем возможностям

Или просто напиши название товара — и я начну работу.

📊 База: 44 кода ТН ВЭД | 25 порогов ФТС | 14 категорий маркировки`;

const HELP_MESSAGE = `Jarvis VED — AI-консьерж по белому импорту

Что я умею:
1. Поиск кода ТН ВЭД — напиши товар или 10-значный код
2. Расчёт пошлин — «Рассчитай пошлину на 500 футболок по $3»
3. Проверка инвойса — «Инвойс на 200 видеокарт по $150 из Китая»
4. Навигатор импорта — /navigator (полное интервью + отчёт)
5. Юридические вопросы — «Штрафы за серый импорт»

Для прямых импортёров (1688/Alibaba):
• Проверка экспортной лицензии поставщика
• Подбор экспортного агента в Китае
• Схема Честного ЗНАКа через байера

⚖️ Дисклеймер: информация справочная, не заменяет консультацию таможенного брокера.`;

const NAVIGATOR_START_MESSAGE = `🗺 Навигатор Импорта — запускаю интервью!

Я задам несколько вопросов о вашем товаре и сгенерирую полный Import Brief:
• Код ТН ВЭД
• Расчёт пошлин и НДС
• Список рисков
• Чеклист документов
• Первые шаги

Начнём! Напишите название товара, который хотите везти:`;

// Commands that are handled locally (not forwarded to VedConcierge)
const LOCAL_COMMANDS: Record<string, string> = {
  "/start": WELCOME_MESSAGE,
  "/help": HELP_MESSAGE,
  "/navigator": NAVIGATOR_START_MESSAGE,
};

export class MaxMessengerAdapter implements MessengerAdapter {
  readonly channel: Channel = "max";
  private token: string;
  private handlers: MessageHandler[] = [];
  private bot: any = null; // Will be typed when @maxhub/max-bot-api is installed
  constructor(token: string) {
    this.token = token;
  }

  async start(): Promise<void> {
    try {
      // Dynamic import — don't crash if package not installed
      const { Bot } = await import("@maxhub/max-bot-api");
      this.bot = new Bot(this.token);

      this.bot.on("message", async (ctx: any) => {
        const text = (ctx.message?.text ?? "").trim();
        const chatId = String(ctx.chat?.id ?? "");

        // Handle local commands (don't forward to VedConcierge)
        const lowerText = text.toLowerCase();
        if (LOCAL_COMMANDS[lowerText]) {
          await this.sendMessage({ chatId, text: LOCAL_COMMANDS[lowerText] });
          return;
        }

        // Handle /code <query> — strip command prefix and forward
        const codeMatch = text.match(/^\/code\s+(.+)/i);
        const forwardText = codeMatch ? codeMatch[1] : text;

        const unified: UnifiedMessage = {
          id: String(ctx.message?.id ?? Date.now()),
          channel: "max",
          chatId,
          userId: String(ctx.from?.id ?? ""),
          userName: ctx.from?.name ?? ctx.from?.username ?? "unknown",
          text: forwardText,
          timestamp: new Date(),
          rawEvent: ctx,
        };

        for (const handler of this.handlers) {
          await handler(unified);
        }
      });

      await this.bot.start();
      console.log("[MAX] Bot started (polling mode)");
      console.log("[MAX] Commands: /start, /code, /navigator, /help");
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "MODULE_NOT_FOUND") {
        console.warn("[MAX] @maxhub/max-bot-api not installed. Skipping Max adapter.");
        console.warn("[MAX] Install: npm install @maxhub/max-bot-api");
      } else {
        throw err;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stop?.();
      console.log("[MAX] Bot stopped");
    }
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.bot) return;
    await this.bot.sendMessage(msg.chatId, { text: msg.text });
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }
}
