export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string, numResults?: number): Promise<SearchResult[]>;
}

export class SerperProvider implements SearchProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, numResults = 10): Promise<SearchResult[]> {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: numResults }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    const organic = data.organic ?? [];

    return organic.map((item) => ({
      title: item.title ?? "",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
    }));
  }
}

export function createSearchProvider(): SearchProvider {
  const provider = process.env.SEARCH_PROVIDER ?? "serper";

  if (provider === "serper") {
    const key = process.env.SERPER_API_KEY;
    if (!key) throw new Error("SERPER_API_KEY is not set in .env");
    return new SerperProvider(key);
  }

  throw new Error(`Unknown search provider: ${provider}`);
}
