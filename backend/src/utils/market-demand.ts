import { appendFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";

const LOG_PATH = resolve(__dirname, "../../../docs/market_demand.md");

const HEADER = `# Market Demand Log — Неизвестные коды ТН ВЭД

> Автоматический лог запросов, для которых код не найден в БЗ.
> Используй для анализа спроса и расширения базы знаний.

| Дата | Код | Запрос | Intent |
|------|-----|--------|--------|
`;

/**
 * Записывает неизвестный код в docs/market_demand.md.
 * Никогда не бросает ошибку — обёрнут в try/catch.
 */
export function logUnknownCode(
  code: string,
  query: string,
  intent: string
): void {
  try {
    if (!existsSync(LOG_PATH)) {
      writeFileSync(LOG_PATH, HEADER, "utf-8");
    }

    const now = new Date();
    const date = now.toISOString().replace("T", " ").slice(0, 16);
    const sanitizedQuery = query.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 120);
    const line = `| ${date} | ${code || "—"} | ${sanitizedQuery} | ${intent} |\n`;

    appendFileSync(LOG_PATH, line, "utf-8");
  } catch {
    // Не ломаем основной поток из-за логгирования
  }
}
