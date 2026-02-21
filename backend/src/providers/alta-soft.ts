import { TnVedCode } from "../types/ved";
import { TN_VED_DATABASE, FTS_PRICE_THRESHOLDS } from "../utils/ved-knowledge";

// ─── Interface (same shape as real Alta-Soft API) ───

export interface AltaSoftProvider {
  lookupByDescription(product: string): Promise<TnVedCode[]>;
  lookupByCode(code: string): Promise<TnVedCode | null>;
  getDutyRate(code: string): Promise<number>;
  getCertRequirements(code: string): Promise<string[]>;
  getMinPriceThreshold(code: string): Promise<number | null>;
}

// ─── Mock Implementation ───

export class MockAltaSoftProvider implements AltaSoftProvider {
  async lookupByDescription(product: string): Promise<TnVedCode[]> {
    const query = product.toLowerCase().trim();
    const words = query.split(/\s+/);

    const scored = TN_VED_DATABASE.map((entry) => {
      let score = 0;

      for (const word of words) {
        if (word.length < 2) continue;

        // Match against keywords
        for (const kw of entry.keywords) {
          if (kw.toLowerCase().includes(word) || word.includes(kw.toLowerCase())) {
            score += 3;
          }
        }

        // Match against description
        if (entry.description.toLowerCase().includes(word)) {
          score += 2;
        }

        // Match against section
        if (entry.section.toLowerCase().includes(word)) {
          score += 1;
        }
      }

      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => s.entry);
  }

  async lookupByCode(code: string): Promise<TnVedCode | null> {
    const cleaned = code.replace(/\s/g, "");
    return TN_VED_DATABASE.find((e) => e.code.startsWith(cleaned)) ?? null;
  }

  async getDutyRate(code: string): Promise<number> {
    const entry = await this.lookupByCode(code);
    return entry?.dutyRate ?? 0;
  }

  async getCertRequirements(code: string): Promise<string[]> {
    const entry = await this.lookupByCode(code);
    return entry?.certTypes ?? [];
  }

  async getMinPriceThreshold(code: string): Promise<number | null> {
    return FTS_PRICE_THRESHOLDS[code] ?? null;
  }
}
