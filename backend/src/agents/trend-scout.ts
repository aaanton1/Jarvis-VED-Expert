import Anthropic from "@anthropic-ai/sdk";
import { SearchProvider, SearchResult } from "../providers/search";
import { parseJSON } from "../utils/parse-json";

export interface TrendReport {
  niche: string;
  marketOverview: string;
  painPoints: Array<{
    pain: string;
    source: string;
    severity: number;
  }>;
  competitors: string[];
  estimatedMarketSize: string;
  rawSearchResults: SearchResult[];
}

const ANALYSIS_PROMPT = `You are a business research analyst. Analyze the following search results about a specific niche market.

NICHE: {{NICHE}}

SEARCH RESULTS:
{{RESULTS}}

Based on these results, provide a structured JSON analysis:
{
  "marketOverview": "2-3 sentence overview of the market/niche",
  "painPoints": [
    { "pain": "specific customer pain point", "source": "where this was found", "severity": 1-10 }
  ],
  "competitors": ["list of existing competitors or solutions found"],
  "estimatedMarketSize": "rough estimate if data is available, otherwise 'Data insufficient'"
}

Return ONLY valid JSON. No markdown, no explanation. Identify at least 5 pain points.
IMPORTANT: Always answer in Russian. All text fields must be in Russian language.`;

export class TrendScout {
  private search: SearchProvider;
  private llm: Anthropic;

  constructor(search: SearchProvider, llm: Anthropic) {
    this.search = search;
    this.llm = llm;
  }

  async analyze(
    niche: string,
    onProgress?: (msg: string) => void
  ): Promise<TrendReport> {
    onProgress?.("Поиск трендов в нише...");

    const queries = [
      `${niche} market trends 2024 2025`,
      `${niche} customer problems complaints pain points`,
      `${niche} reddit forum discussion challenges`,
    ];

    const allResults: SearchResult[] = [];

    for (const query of queries) {
      onProgress?.(`Поиск: "${query}"`);
      const results = await this.search.search(query, 8);
      allResults.push(...results);
    }

    onProgress?.(`Найдено ${allResults.length} результатов. Анализ через Claude...`);

    const resultsText = allResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
      .join("\n\n");

    const prompt = ANALYSIS_PROMPT.replace("{{NICHE}}", niche).replace(
      "{{RESULTS}}",
      resultsText
    );

    const message = await this.llm.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const analysis = parseJSON<{
      marketOverview: string;
      painPoints: Array<{ pain: string; source: string; severity: number }>;
      competitors: string[];
      estimatedMarketSize: string;
    }>(responseText);

    onProgress?.("Trend Scout завершил анализ.");

    return {
      niche,
      marketOverview: analysis.marketOverview,
      painPoints: analysis.painPoints,
      competitors: analysis.competitors,
      estimatedMarketSize: analysis.estimatedMarketSize,
      rawSearchResults: allResults,
    };
  }
}
