import {
  Channel,
  UnifiedMessage,
  OutboundMessage,
  MessengerAdapter,
} from "../types/messenger";

/**
 * Telegram Adapter (скелет).
 *
 * Использует telegraf (установить: npm install telegraf).
 * В MVP: polling mode. В продакшене: webhook.
 *
 * Для работы нужен TELEGRAM_BOT_TOKEN в .env.
 */

type MessageHandler = (msg: UnifiedMessage) => Promise<void>;

export class TelegramMessengerAdapter implements MessengerAdapter {
  readonly channel: Channel = "telegram";
  private token: string;
  private handlers: MessageHandler[] = [];
  private bot: any = null; // Will be typed when telegraf is installed

  constructor(token: string) {
    this.token = token;
  }

  async start(): Promise<void> {
    try {
      const { Telegraf } = await import("telegraf");
      this.bot = new Telegraf(this.token);

      this.bot.on("text", async (ctx: any) => {
        const unified: UnifiedMessage = {
          id: String(ctx.message?.message_id ?? Date.now()),
          channel: "telegram",
          chatId: String(ctx.chat?.id ?? ""),
          userId: String(ctx.from?.id ?? ""),
          userName:
            ctx.from?.first_name ??
            ctx.from?.username ??
            "unknown",
          text: ctx.message?.text ?? "",
          timestamp: new Date(ctx.message?.date * 1000),
          rawEvent: ctx,
        };

        for (const handler of this.handlers) {
          await handler(unified);
        }
      });

      await this.bot.launch();
      console.log("[TG] Bot started (polling mode)");

      // Graceful shutdown
      process.once("SIGINT", () => this.bot?.stop("SIGINT"));
      process.once("SIGTERM", () => this.bot?.stop("SIGTERM"));
    } catch (err: any) {
      if (err.code === "ERR_MODULE_NOT_FOUND" || err.code === "MODULE_NOT_FOUND") {
        console.warn("[TG] telegraf not installed. Skipping Telegram adapter.");
        console.warn("[TG] Install: npm install telegraf");
      } else {
        throw err;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      this.bot.stop?.();
      console.log("[TG] Bot stopped");
    }
  }

  async sendMessage(msg: OutboundMessage): Promise<void> {
    if (!this.bot) return;

    const options: any = {};
    if (msg.parseMode === "markdown") {
      options.parse_mode = "Markdown";
    } else if (msg.parseMode === "html") {
      options.parse_mode = "HTML";
    }

    await this.bot.telegram.sendMessage(msg.chatId, msg.text, options);
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }
}
