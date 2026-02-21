/**
 * Извлекает JSON из ответа LLM, который может быть обёрнут в markdown ```json ... ```
 * Использует jsonrepair для починки типичных ошибок LLM.
 */
import { jsonrepair } from "jsonrepair";

export function extractJSON(text: string): string {
  // Remove ```json ... ``` wrapper if present (greedy to capture full JSON)
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*)\n\s*```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Fallback: find first { and last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

export function parseJSON<T = unknown>(text: string): T {
  const extracted = extractJSON(text);
  try {
    return JSON.parse(extracted);
  } catch {
    // Use jsonrepair to fix common LLM JSON issues
    const repaired = jsonrepair(extracted);
    return JSON.parse(repaired);
  }
}
