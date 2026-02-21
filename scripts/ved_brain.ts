/**
 * ved_brain.ts — Entry point для VED Concierge AI-агента.
 *
 * Режимы работы:
 * 1. CLI (без токенов) — интерактивный режим в терминале
 * 2. Telegram — при наличии TELEGRAM_BOT_TOKEN
 * 3. Max — при наличии MAX_BOT_TOKEN
 * 4. Все вместе — при наличии обоих токенов
 *
 * Использование:
 *   npx tsx scripts/ved_brain.ts                    # CLI mode
 *   npx tsx scripts/ved_brain.ts "текст запроса"    # одноразовый запрос
 *
 * Env:
 *   ANTHROPIC_API_KEY   — обязательно
 *   TELEGRAM_BOT_TOKEN  — опционально
 *   MAX_BOT_TOKEN       — опционально
 */

import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import readline from "readline";
import chalk from "chalk";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { VedEngine } from "../backend/src/engine/ved-engine";
import { MaxMessengerAdapter } from "../backend/src/providers/messenger-max";
import { TelegramMessengerAdapter } from "../backend/src/providers/messenger-telegram";
import { MessengerAdapter } from "../backend/src/types/messenger";

// ─── Colorize Response ───

function colorizeResponse(text: string): string {
  return text
    // Status badges
    .replace(/\*\*HIGH_RISK\*\*/g, chalk.bgRed.white.bold(" HIGH_RISK "))
    .replace(/\bHIGH_RISK\b/g, chalk.bgRed.white.bold(" HIGH_RISK "))
    .replace(/\*\*SUSPICIOUS\*\*/g, chalk.bgYellow.black.bold(" SUSPICIOUS "))
    .replace(/\bSUSPICIOUS\b/g, chalk.bgYellow.black.bold(" SUSPICIOUS "))
    .replace(/\*\*CLEAN\*\*/g, chalk.bgGreen.black.bold(" CLEAN "))
    .replace(/\bCLEAN\b(?!\s*\|)/g, chalk.bgGreen.black.bold(" CLEAN "))
    // Severity scores [8/10] and above → red
    .replace(/\[((?:[8-9]|10)\/10)\]/g, chalk.red.bold("[$1]"))
    // Severity scores [5-7/10] → yellow
    .replace(/\[((?:[5-7])\/10)\]/g, chalk.yellow("[$1]"))
    // Severity scores [1-4/10] → green
    .replace(/\[((?:[1-4])\/10)\]/g, chalk.green("[$1]"))
    // Warning emoji lines
    .replace(/(⚠️.*)/g, chalk.yellow("$1"))
    // Legal references
    .replace(/(УК РФ ст\. \d+[^\n]*)/g, chalk.red("$1"))
    .replace(/(КоАП РФ? ст\. [\d.]+[^\n]*)/g, chalk.yellow("$1"))
    // Bold markdown **text**
    .replace(/\*\*([^*]+)\*\*/g, chalk.bold("$1"))
    // Plan B
    .replace(/(🇷🇺.*План Б[^\n]*)/g, chalk.blueBright.bold("$1"))
    // Recommendations
    .replace(/(Рекомендация:)/g, chalk.cyan.bold("$1"))
    // TN VED codes
    .replace(/\b(\d{10})\b/g, chalk.magenta("$1"))
    // Money amounts
    .replace(/([\d\s]+руб\.?)/g, chalk.green("$1"));
}

// ─── CLI Adapter ───

class CliAdapter implements MessengerAdapter {
  readonly channel = "cli" as const;
  private handlers: ((msg: any) => Promise<void>)[] = [];
  private rl: readline.Interface | null = null;

  async start(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.cyan("\n╔══════════════════════════════════════════════╗"));
    console.log(chalk.cyan("║") + chalk.bold.white("  VED Concierge — AI-агент по обелению ВЭД  ") + chalk.cyan(" ║"));
    console.log(chalk.cyan("║") + chalk.gray("  Введите вопрос или 'exit' для выхода       ") + chalk.cyan(" ║"));
    console.log(chalk.cyan("╚══════════════════════════════════════════════╝\n"));

    const promptUser = () => {
      this.rl!.question(chalk.green("Вы: "), async (input) => {
        const text = input.trim();
        if (text === "exit" || text === "quit" || text === "выход") {
          console.log(chalk.cyan("\nДо встречи! Удачного импорта. 🚢"));
          process.exit(0);
        }
        if (!text) {
          promptUser();
          return;
        }

        const msg = {
          id: String(Date.now()),
          channel: "cli" as const,
          chatId: "cli",
          userId: "user",
          userName: "Seller",
          text,
          timestamp: new Date(),
        };

        for (const handler of this.handlers) {
          await handler(msg);
        }
        console.log(""); // blank line
        promptUser();
      });
    };

    promptUser();
  }

  async stop(): Promise<void> {
    this.rl?.close();
  }

  async sendMessage(msg: { chatId: string; text: string }): Promise<void> {
    console.log(chalk.cyan("\nVED Concierge:"));
    console.log(colorizeResponse(msg.text));
  }

  onMessage(handler: (msg: any) => Promise<void>): void {
    this.handlers.push(handler);
  }
}

// ─── Main ───

async function main() {
  // Check for single-query mode
  const singleQuery = process.argv[2];

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY не задан в .env");
    process.exit(1);
  }

  const adapters: MessengerAdapter[] = [];

  // Add messenger adapters if tokens are present
  if (process.env.MAX_BOT_TOKEN) {
    adapters.push(new MaxMessengerAdapter(process.env.MAX_BOT_TOKEN));
    console.log("[INIT] Max adapter: ON");
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    adapters.push(new TelegramMessengerAdapter(process.env.TELEGRAM_BOT_TOKEN));
    console.log("[INIT] Telegram adapter: ON");
  }

  // Single query mode
  if (singleQuery) {
    console.log(chalk.gray(`[INIT] Single query mode: "${singleQuery}"`));
    const engine = new VedEngine([]);
    const response = await engine.processDirectMessage(singleQuery);
    console.log(chalk.cyan("\nVED Concierge:"));
    console.log(colorizeResponse(response));
    process.exit(0);
  }

  // If no messenger tokens — use CLI adapter
  if (adapters.length === 0) {
    console.log("[INIT] No messenger tokens found → CLI mode");
    adapters.push(new CliAdapter());
  }

  const engine = new VedEngine(adapters);
  await engine.start();
}

main().catch((err) => {
  console.error("\nFATAL ERROR:", err.message ?? err);
  console.error(err.stack);
  process.exit(1);
});
