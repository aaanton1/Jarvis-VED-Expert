import Anthropic from "@anthropic-ai/sdk";
import { MessengerAdapter, UnifiedMessage } from "../types/messenger";
import { VedConcierge } from "../agents/ved-concierge";
import { MockAltaSoftProvider } from "../providers/alta-soft";
import { createSearchProvider, SearchProvider } from "../providers/search";

/**
 * VedEngine — оркестратор VED Concierge.
 *
 * Связывает мессенджер-адаптеры с мозгом (VedConcierge).
 * Каждое входящее сообщение проходит:
 *   adapter → normalize → VedConcierge.processMessage() → format → adapter.send()
 */

export class VedEngine {
  private llm: Anthropic;
  private concierge: VedConcierge;
  private adapters: MessengerAdapter[];

  constructor(adapters: MessengerAdapter[]) {
    this.llm = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const altaSoft = new MockAltaSoftProvider();

    // SearchProvider — optional, graceful fallback if SERPER_API_KEY not set
    let search: SearchProvider | undefined;
    try {
      search = createSearchProvider();
    } catch {
      console.log("[VED Engine] SearchProvider не настроен — web fallback отключён");
    }

    this.concierge = new VedConcierge(this.llm, altaSoft, search);
    this.adapters = adapters;
  }

  async start(): Promise<void> {
    console.log(`[VED Engine] Запуск с ${this.adapters.length} адаптерами...`);

    for (const adapter of this.adapters) {
      adapter.onMessage((msg) => this.handleMessage(msg, adapter));
      await adapter.start();
      console.log(`[VED Engine] Адаптер ${adapter.channel} подключён`);
    }

    console.log("[VED Engine] Готов к работе!");
  }

  async stop(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.stop();
    }
    console.log("[VED Engine] Остановлен");
  }

  private async handleMessage(
    msg: UnifiedMessage,
    adapter: MessengerAdapter
  ): Promise<void> {
    const text = msg.text.trim();
    if (!text) return;

    console.log(`[${msg.channel}] ${msg.userName}: ${text}`);

    try {
      const response = await this.concierge.processMessage(text, (progress) => {
        console.log(`  [progress] ${progress}`);
      });

      // Send main response
      await adapter.sendMessage({
        chatId: msg.chatId,
        text: response.formattedMessage,
      });

      // Send follow-up suggestions
      if (response.followUpSuggestions.length > 0) {
        const suggestions = response.followUpSuggestions
          .map((s, i) => `${i + 1}. ${s}`)
          .join("\n");
        await adapter.sendMessage({
          chatId: msg.chatId,
          text: `\nМогу помочь ещё:\n${suggestions}`,
        });
      }

      console.log(`  [response] ${response.intent} → ${response.success ? "OK" : "FAIL"}`);
    } catch (err) {
      console.error(`  [error] ${err instanceof Error ? err.message : err}`);
      await adapter.sendMessage({
        chatId: msg.chatId,
        text: "Произошла ошибка при обработке запроса. Попробуйте переформулировать вопрос.",
      });
    }
  }

  /** Direct message processing (for CLI mode / testing) */
  async processDirectMessage(text: string): Promise<string> {
    const response = await this.concierge.processMessage(text, (progress) => {
      console.log(`  [progress] ${progress}`);
    });

    let output = response.formattedMessage;
    if (response.followUpSuggestions.length > 0) {
      output += "\n\nМогу помочь ещё:\n";
      output += response.followUpSuggestions.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
    }
    return output;
  }
}
